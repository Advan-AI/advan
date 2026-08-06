import crypto from "crypto"

/**
 * FC Sandbox client — Agent Sandbox / E2B-compatible runtime integration.
 *
 * Two backends, selected purely by env config:
 *  - REAL:      FC_SANDBOX_API_BASE + FC_SANDBOX_API_KEY set -> calls the
 *               Alibaba Cloud Function Compute Sandbox REST API
 *               (create / hibernate / wake / execute), documented in
 *               docs/FC_SANDBOX.md.
 *  - SIMULATED: no credentials -> an in-process sandbox that still does real
 *               work (executes the agent payload in an isolated Node `vm`
 *               context, with realistic latency) so the demo is honest about
 *               being simulated while remaining technically non-trivial.
 *
 * Both backends emit the same structured JSON log line shape so the demo
 * page and `docs/FC_SANDBOX.md` observability section apply either way.
 */

export interface SandboxHandle {
  sandboxId: string
  sessionId: string
  traceId: string
}

export interface SandboxExecuteResult {
  output: string
  computeMs: number
}

const API_BASE = process.env.FC_SANDBOX_API_BASE?.trim()
const API_KEY = process.env.FC_SANDBOX_API_KEY?.trim()
export const SANDBOX_MODE: "real" | "simulated" = API_BASE && API_KEY ? "real" : "simulated"

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Structured log line — every sandbox lifecycle transition emits exactly one of these. */
export function logSandboxEvent(event: {
  type: string
  traceId: string
  sandboxId: string
  sessionId: string
  workflowId: string
  [key: string]: unknown
}): Record<string, unknown> {
  const record = { ts: new Date().toISOString(), mode: SANDBOX_MODE, ...event }
  // eslint-disable-next-line no-console
  console.log(`[FCSandbox] ${JSON.stringify(record)}`)
  return record
}

async function realCall<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`FC Sandbox API ${path} failed: ${res.status} ${await res.text()}`)
  }
  return (await res.json()) as T
}

/** Launch a new sandbox session. */
export async function createSandbox(input: {
  workflowId: string
  ticketId: string
}): Promise<SandboxHandle> {
  const traceId = crypto.randomUUID()

  if (SANDBOX_MODE === "real") {
    const created = await realCall<{ sandboxId: string; sessionId: string }>("/sandboxes", {
      template: "advan-agent-runtime",
      metadata: { workflowId: input.workflowId, ticketId: input.ticketId, traceId },
    })
    return { sandboxId: created.sandboxId, sessionId: created.sessionId, traceId }
  }

  await sleep(120) // simulated cold-start
  return {
    sandboxId: `sbx_${crypto.randomBytes(8).toString("hex")}`,
    sessionId: `sess_${crypto.randomBytes(8).toString("hex")}`,
    traceId,
  }
}

/** Execute the agent payload inside the running sandbox. */
export async function executeInSandbox(
  handle: SandboxHandle,
  payload: string
): Promise<SandboxExecuteResult> {
  const start = Date.now()

  if (SANDBOX_MODE === "real") {
    const result = await realCall<{ output: string }>(`/sandboxes/${handle.sandboxId}/execute`, {
      sessionId: handle.sessionId,
      code: payload,
    })
    return { output: result.output, computeMs: Date.now() - start }
  }

  // Simulated: actually run a small isolated computation over the payload so
  // "execute inside the sandbox" is real work, not a stubbed timer.
  const { runInNewContext } = await import("node:vm")
  const output = runInNewContext(
    "input.length > 0 ? `agent draft (${input.length} chars) ready for review` : 'empty draft'",
    { input: payload },
    { timeout: 500 }
  ) as string
  await sleep(180) // simulated inference latency
  return { output, computeMs: Date.now() - start }
}

/** Freeze the sandbox — no compute billed while hibernated. */
export async function hibernateSandbox(handle: SandboxHandle): Promise<void> {
  if (SANDBOX_MODE === "real") {
    await realCall(`/sandboxes/${handle.sandboxId}/hibernate`, { sessionId: handle.sessionId })
    return
  }
  await sleep(40)
}

/** Wake a hibernated sandbox back to a running state. */
export async function wakeSandbox(handle: SandboxHandle): Promise<void> {
  if (SANDBOX_MODE === "real") {
    await realCall(`/sandboxes/${handle.sandboxId}/wake`, { sessionId: handle.sessionId })
    return
  }
  await sleep(90) // simulated warm resume (much faster than cold create)
}

/** Resume execution in the same session (post-wake) and produce the final result. */
export async function resumeSandbox(handle: SandboxHandle, priorOutput: string): Promise<string> {
  if (SANDBOX_MODE === "real") {
    const result = await realCall<{ output: string }>(`/sandboxes/${handle.sandboxId}/resume`, {
      sessionId: handle.sessionId,
    })
    return result.output
  }
  await sleep(60)
  return `${priorOutput} — approved and resumed in session ${handle.sessionId}`
}
