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

/** Create a dedicated subscriber connection (caller owns its lifecycle). */
export function createSubscriber(): Redis | null {
  const url = process.env.REDIS_URL
  return url ? new Redis(url, { maxRetriesPerRequest: null }) : null
}
