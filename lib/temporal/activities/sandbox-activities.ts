import {
  createSandbox,
  executeInSandbox,
  hibernateSandbox,
  wakeSandbox,
  resumeSandbox,
  logSandboxEvent,
  logSandboxMetric,
  logSandboxAlert,
  type SandboxHandle,
} from "@/lib/sandbox/fc-sandbox-client"
import {
  insertSandboxSession,
  markExecuting,
  markHibernated,
  markWokenAndResumed,
  markCompleted,
} from "@/lib/sandbox/sandbox-store"

/**
 * Temporal activities for the FC Sandbox HITL extension — one "AgentRun":
 * a single sandbox session created for a paused, low-confidence/policy-
 * flagged ticket, taken through execute -> hibernate -> (human decides) ->
 * wake -> resume -> complete.
 *
 * These are the only non-deterministic operations the workflow performs for
 * this feature (sandbox network calls + DB writes) — everything else stays
 * in the deterministic workflow function per Temporal's activity model.
 *
 * Each activity is wrapped so a failure emits a `[FCSandboxAlert]` line
 * before rethrowing — Temporal's own retry policy (configured in
 * ticket-resolution.ts) then handles the retry; if retries are exhausted the
 * workflow activity fails visibly in the Temporal UI *and* in the alert
 * stream, giving two independent places to debug from (see
 * docs/FC_SANDBOX.md "one real debugging example").
 */

async function withAlertOnFailure<T>(
  ctx: { type: string; workflowId: string; sandboxId: string; traceId: string },
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    logSandboxAlert({
      type: ctx.type,
      severity: "critical",
      traceId: ctx.traceId,
      sandboxId: ctx.sandboxId,
      workflowId: ctx.workflowId,
      message: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

export interface CreateSandboxInput {
  workflowId: string
  ticketId: string
  /** Hibernation policy: minutes to wait for a human decision before
   *  auto-escalating. Configurable per run (default 10) — see
   *  TicketResolutionInput.hitlTimeoutMinutes. */
  hitlTimeoutMinutes: number
}

export async function createSandboxSessionActivity(
  input: CreateSandboxInput
): Promise<SandboxHandle> {
  // The creation call itself (network round-trip to the sandbox runtime) is
  // the most likely failure point, so it must be inside the alerted region
  // too — not just the bookkeeping after it succeeds. No sandboxId/traceId
  // exist yet if this throws, so the alert uses placeholders for those.
  let handle: SandboxHandle
  try {
    handle = await createSandbox(input)
  } catch (err) {
    logSandboxAlert({
      type: "sandbox.create_failed",
      severity: "critical",
      traceId: "unassigned",
      sandboxId: "unassigned",
      workflowId: input.workflowId,
      message: err instanceof Error ? err.message : String(err),
    })
    throw err
  }

  return withAlertOnFailure(
    { type: "sandbox.create_persist_failed", workflowId: input.workflowId, sandboxId: handle.sandboxId, traceId: handle.traceId },
    async () => {
      const event = logSandboxEvent({
        type: "sandbox.created",
        workflowId: input.workflowId,
        ...handle,
        state: "created",
        sessionAffinity: true, // this sandboxId/sessionId is reused, never recreated, for the rest of the run
      })
      logSandboxMetric({ name: "sandbox.created", value: 1, unit: "count", traceId: handle.traceId, sandboxId: handle.sandboxId, workflowId: input.workflowId })
      await insertSandboxSession({
        workflowId: input.workflowId,
        ticketId: input.ticketId,
        handle,
        event,
        hitlTimeoutMinutes: input.hitlTimeoutMinutes,
      })
      return handle
    }
  )
}

export interface ExecuteInSandboxInput extends SandboxHandle {
  workflowId: string
  payload: string
}

export async function executeAgentInSandboxActivity(
  input: ExecuteInSandboxInput
): Promise<{ output: string; computeMs: number }> {
  return withAlertOnFailure(
    { type: "sandbox.execute_failed", workflowId: input.workflowId, sandboxId: input.sandboxId, traceId: input.traceId },
    async () => {
      const result = await executeInSandbox(input, input.payload)
      const event = logSandboxEvent({
        type: "sandbox.executed",
        workflowId: input.workflowId,
        sandboxId: input.sandboxId,
        sessionId: input.sessionId,
        traceId: input.traceId,
        state: "executing",
        computeMs: result.computeMs,
      })
      logSandboxMetric({ name: "sandbox.compute_ms", value: result.computeMs, unit: "ms", traceId: input.traceId, sandboxId: input.sandboxId, workflowId: input.workflowId })
      await markExecuting(input.workflowId, result.computeMs, event)
      return result
    }
  )
}

export interface HibernateInput extends SandboxHandle {
  workflowId: string
}

export async function hibernateSandboxActivity(input: HibernateInput): Promise<{ hibernatedAt: string }> {
  return withAlertOnFailure(
    { type: "sandbox.hibernate_failed", workflowId: input.workflowId, sandboxId: input.sandboxId, traceId: input.traceId },
    async () => {
      await hibernateSandbox(input)
      const hibernatedAt = new Date().toISOString()
      const event = logSandboxEvent({
        type: "sandbox.hibernated",
        workflowId: input.workflowId,
        sandboxId: input.sandboxId,
        sessionId: input.sessionId,
        traceId: input.traceId,
        state: "hibernated",
        hibernatedAt,
        sessionAffinity: true,
      })
      await markHibernated(input.workflowId, event)
      return { hibernatedAt }
    }
  )
}

export interface WakeResumeInput extends SandboxHandle {
  workflowId: string
  priorOutput: string
}

export interface WakeResumeResult {
  wokenAt: string
  resumedAt: string
  output: string
  waitMs: number
  wakeLatencyMs: number
  computeSavedMsEstimate: number
}

export async function wakeAndResumeSandboxActivity(
  input: WakeResumeInput
): Promise<WakeResumeResult> {
  return withAlertOnFailure(
    { type: "sandbox.wake_resume_failed", workflowId: input.workflowId, sandboxId: input.sandboxId, traceId: input.traceId },
    async () => {
      // Wake latency measured in isolation — distinct from total wait time.
      const wakeStart = Date.now()
      await wakeSandbox(input)
      const wakeLatencyMs = Date.now() - wakeStart
      const wokenAt = new Date().toISOString()
      const wakeEvent = logSandboxEvent({
        type: "sandbox.woken",
        workflowId: input.workflowId,
        sandboxId: input.sandboxId,
        sessionId: input.sessionId,
        traceId: input.traceId,
        state: "waking",
        wokenAt,
        wakeLatencyMs,
        sessionAffinity: true, // same sandboxId/sessionId woken, not a fresh sandbox
      })
      logSandboxMetric({ name: "sandbox.wake_latency_ms", value: wakeLatencyMs, unit: "ms", traceId: input.traceId, sandboxId: input.sandboxId, workflowId: input.workflowId })

      const output = await resumeSandbox(input, input.priorOutput)
      const resumedAt = new Date().toISOString()
      const resumeEvent = logSandboxEvent({
        type: "sandbox.resumed",
        workflowId: input.workflowId,
        sandboxId: input.sandboxId,
        sessionId: input.sessionId,
        traceId: input.traceId,
        state: "resumed",
        resumedAt,
      })

      const { waitMs, computeSavedMsEstimate } = await markWokenAndResumed(
        input.workflowId,
        wakeLatencyMs,
        wakeEvent,
        resumeEvent
      )
      logSandboxMetric({ name: "sandbox.wait_ms", value: waitMs, unit: "ms", traceId: input.traceId, sandboxId: input.sandboxId, workflowId: input.workflowId })
      logSandboxMetric({ name: "sandbox.compute_saved_ms", value: computeSavedMsEstimate, unit: "ms", traceId: input.traceId, sandboxId: input.sandboxId, workflowId: input.workflowId })

      return { wokenAt, resumedAt, output, waitMs, wakeLatencyMs, computeSavedMsEstimate }
    }
  )
}

export interface CompleteSandboxInput extends SandboxHandle {
  workflowId: string
  status: "completed" | "escalated"
}

export async function completeSandboxSessionActivity(input: CompleteSandboxInput): Promise<{ completedAt: string }> {
  const completedAt = new Date().toISOString()
  const event = logSandboxEvent({
    type: "sandbox.completed",
    workflowId: input.workflowId,
    sandboxId: input.sandboxId,
    sessionId: input.sessionId,
    traceId: input.traceId,
    state: input.status,
    completedAt,
  })
  if (input.status === "escalated") {
    // Real, actionable signal: no human responded within the hibernation
    // policy window (or explicitly rejected) — worth paging/routing, not a
    // silent failure. Warning, not critical: this is expected system
    // behavior, not a bug.
    logSandboxAlert({
      type: "sandbox.hitl_timeout_or_rejected",
      severity: "warning",
      traceId: input.traceId,
      sandboxId: input.sandboxId,
      workflowId: input.workflowId,
      message: "HITL window elapsed with no approval, or the decision was a rejection. Ticket escalated to a human agent.",
    })
  }
  await markCompleted(input.workflowId, input.status, event)
  return { completedAt }
}

export type SandboxActivities = {
  createSandboxSessionActivity: typeof createSandboxSessionActivity
  executeAgentInSandboxActivity: typeof executeAgentInSandboxActivity
  hibernateSandboxActivity: typeof hibernateSandboxActivity
  wakeAndResumeSandboxActivity: typeof wakeAndResumeSandboxActivity
  completeSandboxSessionActivity: typeof completeSandboxSessionActivity
}

export const sandboxActivities: SandboxActivities = {
  createSandboxSessionActivity,
  executeAgentInSandboxActivity,
  hibernateSandboxActivity,
  wakeAndResumeSandboxActivity,
  completeSandboxSessionActivity,
}
