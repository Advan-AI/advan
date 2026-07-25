/**
 * Public chat intake endpoint.
 *
 * POST /api/chat/intake
 *
 * Accepts a visitor message from the embedded chat widget and funnels it
 * through the shared auto-intake pipeline (creates/resolves customer,
 * ticket, and conversation; inserts the user message; enqueues the
 * copilot-triage job).
 *
 * ── Authentication ────────────────────────────────────────────────────────────
 * Every call must include the session JWT issued by POST /api/chat/session,
 * either as:
 *   • JSON body field "token"
 *   • Authorization header: "Bearer <token>"
 *
 * The token is verified via lib/chat/verify-widget-token.ts — the same
 * function used by the /chat-widget Socket.IO namespace middleware.
 *
 * orgId, widgetKey, and visitorId are derived EXCLUSIVELY from the
 * verified token claims. No client-supplied orgId is ever trusted.
 *
 * If no valid token is present, the endpoint returns 401.
 *
 * ── Online mode (agent available) ────────────────────────────────────────────
 * Caller should connect to /chat-widget Socket.IO namespace with
 * handshake.auth = { token, conversationId } to receive real-time events:
 *   agent:message   — AI auto-replied or human agent sent a reply
 *   triage:pending  — Escalated; show "an agent will respond shortly"
 *
 * ── Offline mode ──────────────────────────────────────────────────────────────
 * Pass `visitorEmail` and optionally `visitorName`. The intake creates the
 * customer with their email address and marks the conversation as
 * chatOfflineDelivery=true so the triage worker routes the first reply
 * through the existing email path.
 *
 * ── Rate limiting ─────────────────────────────────────────────────────────────
 * 30 requests per 60-second window per IP (in-process sliding window).
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { resolveOrCreateIntake } from "@/lib/tickets/auto-intake"
import { isOrgChatAccepting } from "@/lib/realtime/event-bus"
import { sanitizeInboundText } from "@/lib/email/parse-inbound"
import { PIIMasker } from "@/lib/governance/pii-masker"
import { verifyWidgetSession } from "@/lib/chat/widget-session-auth"

export const runtime = "nodejs"

// ─── Rate limiting (best-effort, in-memory) ───────────────────────────────────

let widgetRatelimit: Ratelimit | null = null

function getWidgetRatelimit(): Ratelimit | null {
  if (widgetRatelimit) return widgetRatelimit
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  // Secondary rate limit keyed by widgetKey to prevent tenant starvation.
  // We allow up to 120 messages per minute per widgetKey. This allows a higher,
  // burstable throughput for actual active chat sessions (bursty behavior),
  // while preventing broad exhaustion or DDoS-style flooding.
  widgetRatelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(120, "60 s"),
    analytics: true,
    prefix: "advan:chat:intake:widget",
  })
  return widgetRatelimit
}

async function applyWidgetRateLimit(widgetKey: string): Promise<Response | null> {
  const rl = getWidgetRatelimit()
  if (!rl) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[ChatIntake] Upstash widget rate limit env is missing in production. Bypassing rate limit.")
    }
    return null
  }

  const { success, limit, remaining, reset } = await rl.limit(widgetKey)
  if (success) return null

  return new Response(
    JSON.stringify({ error: "Too many messages for this widget. Please slow down.", limit, remaining }),
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

const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 30 // messages per window per IP

type WindowEntry = { count: number; resetAt: number }
const rateBuckets = new Map<string, WindowEntry>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateBuckets.get(ip)
  if (!entry || now > entry.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count += 1
  return true
}

// Prune stale entries periodically so the map doesn't grow unboundedly.
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateBuckets) {
    if (now > entry.resetAt) rateBuckets.delete(key)
  }
}, RATE_WINDOW_MS * 5)

// ─── Input schema ─────────────────────────────────────────────────────────────
//
// orgId is intentionally absent — it is derived from the verified JWT, never
// from the request body. Any client-supplied orgId is silently ignored.

const IntakeSchema = z.object({
  /**
   * The widget session JWT from POST /api/chat/session.
   * May also be supplied via Authorization: Bearer <token> header.
   * Required — requests missing a valid token receive 401.
   */
  token: z.string().optional(),

  /** Message text from the visitor. */
  content: z.string().min(1, "content is required").max(8000).trim(),

  /**
   * Pre-chat form: visitor's email address.
   * Required when the widget is in offline mode (no agents online).
   * Stored on the customer row and used to deliver the agent reply via email.
   */
  visitorEmail: z.string().trim().email("visitorEmail must be a valid email").optional(),

  /**
   * Pre-chat form: visitor's display name (optional).
   * Stored as customers.name when creating a new visitor customer row.
   */
  visitorName: z.string().trim().max(120).optional(),

  /** Optional subject line; falls back to the first 120 chars of content. */
  subject: z.string().max(255).optional(),
})

// ─── Resolve token from request ───────────────────────────────────────────────

function extractRawToken(req: NextRequest, body: z.infer<typeof IntakeSchema>): string | null {
  // 1. Authorization: Bearer <token> header
  const auth = req.headers.get("authorization")
  if (auth?.startsWith("Bearer ")) {
    const t = auth.slice(7).trim()
    if (t) return t
  }
  // 2. JSON body field "token"
  if (body.token) return body.token

  return null
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Rate limit ─────────────────────────────────────────────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anonymous"

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = IntakeSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  // ── Verify session token — reject if missing or invalid ────────────────────
  const rawToken = extractRawToken(req, parsed.data)
  if (!rawToken) {
    return NextResponse.json(
      { error: "Missing session token. Call POST /api/chat/session first." },
      { status: 401 }
    )
  }

  let orgId: string
  let visitorId: string
  let widgetKey: string
  try {
    const authReq = new NextRequest(req.url, {
      method: req.method,
      headers: { authorization: `Bearer ${rawToken}` },
    })
    const claims = await verifyWidgetSession(authReq)
    orgId = claims.orgId
    visitorId = claims.visitorId
    widgetKey = claims.widgetKey
  } catch {
    return NextResponse.json(
      { error: "Invalid or expired session token." },
      { status: 401 }
    )
  }

  // Apply secondary rate limit keyed by widgetKey to prevent tenant starvation
  const widgetRateLimited = await applyWidgetRateLimit(widgetKey)
  if (widgetRateLimited) return widgetRateLimited

  const { content, visitorEmail, visitorName, subject } = parsed.data

  // ── Sanitize content ───────────────────────────────────────────────────────
  const sanitized = PIIMasker.mask(sanitizeInboundText(content))

  // ── Determine delivery mode ────────────────────────────────────────────────
  const agentsOnline = await isOrgChatAccepting(orgId)
  const offlineMode = !agentsOnline
  const chatOfflineDelivery = offlineMode && Boolean(visitorEmail)

  // ── Intake ─────────────────────────────────────────────────────────────────
  try {
    const customerIdentifier = visitorEmail
      ? { visitorId, email: visitorEmail }
      : { visitorId }

    const result = await resolveOrCreateIntake({
      orgId,
      channel: "chat",
      customerIdentifier,
      content: sanitized,
      subject,
      customerName: visitorName,
      chatOfflineDelivery,
    })

    return NextResponse.json(
      {
        conversationId: result.conversationId,
        messageId: result.messageId,
        ticketId: result.ticketId,
        isNewTicket: result.isNewTicket,
        offlineMode: chatOfflineDelivery,
        status: "received",
      },
      { status: 202 }
    )
  } catch (err) {
    console.error("[ChatIntake] Error processing message:", (err as Error).message)
    return NextResponse.json(
      { error: "Failed to process message. Please try again." },
      { status: 500 }
    )
  }
}
