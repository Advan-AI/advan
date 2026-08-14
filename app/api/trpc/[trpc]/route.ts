import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { appRouter } from "@/lib/api/root"
import { getEffectiveSession } from "@/lib/auth/effective-session"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

/**
 * Advan AI tRPC Route Handler
 *
 * Rate limiting: 60 requests per 60-second window per user (or IP for guests).
 * Uses Upstash Redis sliding window — gracefully skipped if UPSTASH env vars
 * are absent (e.g. local dev without Redis configured).
 */

let ratelimit: Ratelimit | null = null

function getRatelimit() {
  if (ratelimit) return ratelimit
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(60, "60 s"),
    analytics: true,
    prefix: "advan:trpc",
  })
  return ratelimit
}

async function handler(req: Request) {
  const session = await getEffectiveSession()

  // Rate limiting
  const rl = getRatelimit()
  if (rl) {
    const identifier = session?.user?.id ?? req.headers.get("x-forwarded-for") ?? "anonymous"
    const { success, limit, remaining } = await rl.limit(identifier)

    if (!success) {
      return new Response(
        JSON.stringify({ error: "Too many requests", limit, remaining }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": String(remaining),
            "Retry-After": "60",
          },
        }
      )
    }
  }

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => ({
      user: session?.user
        ? {
            id: session.user.id,
            orgId: session.user.orgId,
            role: session.user.role,
          }
        : undefined,
    }),
    onError({ path, error, type }) {
      // Keep full diagnostics server-side only — client responses are sanitized.
      console.error(`[tRPC ${type}] ${path ?? "<no-path>"}:`, error.message, error.cause ?? "")
    },
  })
}

export { handler as GET, handler as POST }
