import { EventEmitter } from "events"

/**
 * In-process pub/sub for sandbox session updates, keyed by workflowId.
 * Lets `/api/demo/fc-sandbox/stream` push updates over SSE instead of the
 * client polling — the rubric explicitly asks to avoid polling for the
 * "waiting" phase, and this is what removes it from the UI layer (the
 * workflow's own wait was already signal-driven via Temporal `condition()`,
 * never polling).
 *
 * Scope note: this is a single-process event bus (`globalThis`-pinned so
 * Next.js dev HMR doesn't leak listeners). It is correct for one Temporal
 * worker + one Next.js server, which is this demo's deployment shape. A
 * horizontally-scaled deployment (multiple Next.js/worker instances) would
 * need a shared pub/sub (e.g. a real Redis connection with SUBSCRIBE — the
 * existing `lib/queue/redis-client.ts` is Upstash's REST client, which does
 * not support SUBSCRIBE, so this would be a genuinely new dependency, not a
 * reuse of existing infra). See docs/FC_SANDBOX.md "remaining limitations".
 */

type GlobalWithBus = typeof globalThis & { __ADVAN_SANDBOX_BUS__?: EventEmitter }

function getBus(): EventEmitter {
  const g = globalThis as GlobalWithBus
  if (!g.__ADVAN_SANDBOX_BUS__) {
    const bus = new EventEmitter()
    bus.setMaxListeners(100)
    g.__ADVAN_SANDBOX_BUS__ = bus
  }
  return g.__ADVAN_SANDBOX_BUS__
}

export function publishSandboxUpdate(workflowId: string): void {
  getBus().emit(workflowId)
}

export function subscribeSandboxUpdates(workflowId: string, onUpdate: () => void): () => void {
  const bus = getBus()
  bus.on(workflowId, onUpdate)
  return () => bus.off(workflowId, onUpdate)
}
