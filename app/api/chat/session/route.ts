/**
 * POST /api/chat/session
 *
 * Public endpoint — issues a short-lived signed JWT for an embedded chat widget.
 *
 * Token expiry: 1 hour (TOKEN_EXPIRY). The short window is intentional:
 * the forthcoming socket auth layer will re-issue on reconnect anyway, so
 * holding a stale token open for days adds risk without benefit.
 *
 * Flow:
 *   1. Look up widget_configs by widgetKey.
 *   2. Reject if unknown, or if origin is not an exact match in allowedOrigins.
 *      Strict equality prevents bypass via subdomain-prefix tricks such as
 *      evil-example.com.attacker.com matching a prefix check on example.com.
 *   3. Mint (or reuse, on resume) a visitorSessionId UUID.
 *   4. Sign a JWT containing { orgId, widgetKey, visitorSessionId } using
 *      AUTH_SECRET / NEXTAUTH_SECRET via jose (already a project dependency
 *      through NextAuth — no second JWT library added).
 *   5. Return { token, visitorSessionId }.
 *
 * Authentication: NONE — intentionally unauthenticated public endpoint.
 * Rate limit: Upstash slidingWindow(20, "60 s") per IP.
 *             Fails closed (503) in production if Upstash env vars are absent.
 *             Fails open in development/test.
 */

import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { eq } from "drizzle-orm"
import { SignJWT } from "jose"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { widgetConfigs } from "@/lib/db/schema"

export const runtime = "nodejs"

// ─── Token config ─────────────────────────────────────────────────────────────

/**
 * Short-lived: 1 hour.
 * Re-issue on socket reconnect so a stolen token has a small blast radius.
 */
const TOKEN_EXPIRY = "1h"

// ─── Rate limiting ────────────────────────────────────────────────────────────

let ratelimit: Ratelimit | null = null

function getRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(20, "60 s"),
    analytics: true,
    prefix: "advan:chat:session",
  })
  return ratelimit
}

async function applyRateLimit(req: NextRequest): Promise<Response | null> {
  const rl = getRatelimit()
  if (!rl) {
    if (process.env.NODE_ENV === "production") {
      console.error("[ChatSession] Upstash rate limit env is missing in production")
      return NextResponse.json({ error: "Rate limit unavailable" }, { status: 503 })
    }
    return null
  }

  const identifier =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anonymous"

  const { success, limit, remaining, reset } = await rl.limit(identifier)
  if (success) return null

  return new Response(
    JSON.stringify({ error: "Too many requests", limit, remaining }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": String(remaining),
        "Retry-After": String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))),
      },
    },
  )
}

// ─── JWT ──────────────────────────────────────────────────────────────────────

function getSigningKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET / NEXTAUTH_SECRET is not configured")
  return new TextEncoder().encode(secret)
}

export async function signWidgetToken(payload: {
  orgId: string
  widgetKey: string
  visitorSessionId: string
}): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .setIssuer("advan:chat-session")
    .sign(getSigningKey())
}

// ─── Input schema ─────────────────────────────────────────────────────────────

export const SessionSchema = z.object({
  widgetKey: z.string().min(1).max(128),
  /**
   * The widget sends window.location.origin (e.g. "https://example.com").
   * Must be an exact match against widget_configs.allowed_origins — no prefix
   * or substring matching.
   */
  origin: z.string().url(),
  /**
   * Present when the visitor is resuming from browser storage.
   * Must be a UUID; free-form strings are rejected so the column stays clean
   * for future indexed lookups.
   */
  visitorSessionId: z.string().uuid().optional(),
})

export type SessionRequest = z.infer<typeof SessionSchema>

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rateLimited = await applyRateLimit(req)
  if (rateLimited) return rateLimited

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = SessionSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { widgetKey, origin, visitorSessionId: resumeSessionId } = parsed.data

  const config = await db.query.widgetConfigs.findFirst({
    where: eq(widgetConfigs.widgetKey, widgetKey),
  })

  if (!config) {
    return NextResponse.json({ error: "Unknown widgetKey" }, { status: 404 })
  }

  // Exact-match origin check — allowedOrigins is a jsonb string array.
  // Strict equality prevents bypass via subdomain-prefix tricks.
  const allowedOrigins = config.allowedOrigins as string[]
  if (!allowedOrigins.includes(origin)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 })
  }

  // Reuse the caller's session ID on resume; mint a fresh UUID otherwise.
  const visitorSessionId = resumeSessionId ?? crypto.randomUUID()

  let token: string
  try {
    token = await signWidgetToken({ orgId: config.orgId, widgetKey, visitorSessionId })
  } catch (err) {
    console.error("[ChatSession] Failed to sign JWT:", (err as Error).message)
    return NextResponse.json({ error: "Token signing failed" }, { status: 500 })
  }

  return NextResponse.json({ token, visitorSessionId }, { status: 200 })
}
