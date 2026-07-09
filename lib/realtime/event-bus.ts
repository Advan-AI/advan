import Redis from "ioredis"

/**
 * Cross-process realtime event bus (Redis pub/sub).
 *
 * The Next.js app process creates HITL items and pipeline run-step updates, but
 * the Socket.IO fan-out server runs as a SEPARATE process. They communicate over
 * Redis channels so any connected reviewer/observer sees updates instantly,
 * regardless of which process produced them.
 *
 * Degrades to a no-op when REDIS_URL is absent (single-process local dev), in
 * which case same-process emitters can still broadcast directly.
 */

export const HITL_NEW_CHANNEL = "advan:hitl:new"
export const HITL_RESOLVED_CHANNEL = "advan:hitl:resolved"
export const PIPELINE_STEP_CHANNEL = "advan:pipeline:step"
export const PIPELINE_RUN_FINISHED_CHANNEL = "advan:pipeline:run:finished"

/**
 * Chat-channel visitor events.
 *
 * These are published by the triage worker and relayed by the socket server to
 * the conversation room so the visitor widget sees updates in real time:
 *
 *   CHAT_AGENT_REPLY    — the AI auto-replied; payload carries the full reply
 *                         text so the widget can render it immediately without
 *                         re-fetching from the API.
 *   CHAT_TRIAGE_PENDING — the message was escalated (complaint or low confidence);
 *                         payload carries the priority so the widget can show
 *                         the correct "an agent will respond shortly" state.
 */
export const CHAT_AGENT_REPLY_CHANNEL = "advan:chat:agent_reply"
export const CHAT_TRIAGE_PENDING_CHANNEL = "advan:chat:triage_pending"

type GlobalBus = typeof globalThis & { __ADVAN_REDIS_PUB__?: Redis | null }

function getPublisher(): Redis | null {
  const g = globalThis as GlobalBus
  if (g.__ADVAN_REDIS_PUB__ !== undefined) return g.__ADVAN_REDIS_PUB__
  const url = process.env.REDIS_URL
  g.__ADVAN_REDIS_PUB__ = url
    ? new Redis(url, { maxRetriesPerRequest: null, lazyConnect: false })
    : null
  return g.__ADVAN_REDIS_PUB__
}

async function publish(channel: string, payload: unknown): Promise<void> {
  const pub = getPublisher()
  if (!pub) return
  try {
    await pub.publish(channel, JSON.stringify(payload))
  } catch (err) {
    console.warn(`[EventBus] publish to ${channel} failed:`, (err as Error).message)
  }
}

export function publishHitlNew(orgId: string, item: unknown): Promise<void> {
  return publish(HITL_NEW_CHANNEL, { orgId, item })
}

export function publishHitlResolved(
  orgId: string,
  data: { id: string; action: "approve" | "reject"; editedOutput?: string }
): Promise<void> {
  return publish(HITL_RESOLVED_CHANNEL, { orgId, ...data })
}

export function publishPipelineStep(
  orgId: string,
  data: {
    temporalWorkflowId: string
    runId: string
    nodeId: string
    nodeType: string
    status: string
    output?: unknown
    error?: string
    latencyMs?: number
  }
): Promise<void> {
  return publish(PIPELINE_STEP_CHANNEL, { orgId, ...data })
}

export function publishPipelineRunFinished(
  orgId: string,
  data: { temporalWorkflowId: string; runId: string; status: "completed" | "failed" | "cancelled" }
): Promise<void> {
  return publish(PIPELINE_RUN_FINISHED_CHANNEL, { orgId, ...data })
}

/**
 * Publish an agent auto-reply to the chat realtime channel.
 * Subscribed by the socket server; relayed to `conversation:{conversationId}` room.
 */
export function publishChatAgentReply(
  orgId: string,
  data: { conversationId: string; messageId: string; content: string }
): Promise<void> {
  return publish(CHAT_AGENT_REPLY_CHANNEL, { orgId, ...data })
}

/**
 * Publish a triage-pending signal so the visitor widget shows
 * "an agent will respond shortly" instead of an unattended silence.
 */
export function publishChatTriagePending(
  orgId: string,
  data: { conversationId: string; priority: "complaint" | "low_confidence" }
): Promise<void> {
  return publish(CHAT_TRIAGE_PENDING_CHANNEL, { orgId, ...data })
}

/** Create a dedicated subscriber connection (caller owns its lifecycle). */
export function createSubscriber(): Redis | null {
  const url = process.env.REDIS_URL
  return url ? new Redis(url, { maxRetriesPerRequest: null }) : null
}

// ─── Agent presence (chat availability) ──────────────────────────────────────
//
// The socket server maintains a Redis SET of active agent socket IDs per org:
//
//   Key: advan:chat:agents-online:{orgId}
//   Members: socket.id strings
//   TTL: 24 h safety net (prevents stale data after a crash)
//
// The Next.js app reads SCARD to answer "is any agent online?" from
// GET /api/chat/availability — without needing a direct socket.io query
// across the process boundary.

const AGENT_PRESENCE_PREFIX = "advan:chat:agents-online:"
const AGENT_PRESENCE_TTL_S = 86_400 // 24 hours — crash guard only

function presenceKey(orgId: string): string {
  return `${AGENT_PRESENCE_PREFIX}${orgId}`
}

/**
 * Register a connected agent socket in the presence SET.
 * Called by the socket server when an agent joins `org:{orgId}`.
 */
export async function trackAgentOnline(orgId: string, socketId: string): Promise<void> {
  const pub = getPublisher()
  if (!pub) return
  try {
    await pub.sadd(presenceKey(orgId), socketId)
    await pub.expire(presenceKey(orgId), AGENT_PRESENCE_TTL_S)
  } catch (err) {
    console.warn("[EventBus] trackAgentOnline failed:", (err as Error).message)
  }
}

/**
 * Remove a disconnected agent socket from the presence SET.
 * Called by the socket server on agent disconnect.
 */
export async function trackAgentOffline(orgId: string, socketId: string): Promise<void> {
  const pub = getPublisher()
  if (!pub) return
  try {
    await pub.srem(presenceKey(orgId), socketId)
  } catch (err) {
    console.warn("[EventBus] trackAgentOffline failed:", (err as Error).message)
  }
}

/**
 * Returns true if at least one agent socket is currently online for the org.
 *
 * Reads from Redis so it works cross-process (Next.js app querying the state
 * maintained by the standalone socket server). Falls back to false on error.
 */
export async function isAnyAgentOnline(orgId: string): Promise<boolean> {
  const pub = getPublisher()
  if (!pub) return false
  try {
    const count = await pub.scard(presenceKey(orgId))
    return count > 0
  } catch {
    return false
  }
}

/**
 * Returns true when the org is "accepting live chat": at least one agent
 * socket is connected AND at least one user in the org has `chatAvailable=true`.
 *
 * Two-layer check:
 *   1. Redis presence  — fast; returns false immediately when no sockets connected.
 *   2. DB chatAvailable — confirms that at least one connected agent is opted-in
 *      to receiving live chats.  Without this a logged-in-but-busy agent would
 *      still route visitors to live chat.
 *
 * Used by GET /api/chat/availability and POST /api/chat/intake.
 * Falls back to false on any error (safe default: show pre-chat form).
 */
export async function isOrgChatAccepting(orgId: string): Promise<boolean> {
  // Fast path — skip DB query when no sockets are connected.
  const socketsOnline = await isAnyAgentOnline(orgId)
  if (!socketsOnline) return false

  try {
    // Lazy-import DB so this module stays importable in test environments
    // that mock DB separately.
    const { db } = await import("@/lib/db")
    const { users } = await import("@/lib/db/schema")
    const { eq, and } = await import("drizzle-orm")

    const row = await db.query.users.findFirst({
      where: and(eq(users.orgId, orgId), eq(users.chatAvailable, true)),
      columns: { id: true },
    })
    return Boolean(row)
  } catch (err) {
    console.warn("[EventBus] isOrgChatAccepting DB check failed:", (err as Error).message)
    // Fail-open: if we can't read DB, treat sockets-online as sufficient.
    return true
  }
}
