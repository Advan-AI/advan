import {
  createSandbox,
  executeInSandbox,
  hibernateSandbox,
  wakeSandbox,
  resumeSandbox,
  logSandboxEvent,
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
 * Temporal activities for the FC Sandbox HITL extension.
 *
 * These are the only non-deterministic operations the workflow performs for
 * this feature (sandbox network calls + DB writes) — everything else stays
 * in the deterministic workflow function per Temporal's activity model.
 */

export interface CreateSandboxInput {
  workflowId: string
  ticketId: string
}

export async function createSandboxSessionActivity(
  input: CreateSandboxInput
): Promise<SandboxHandle> {
  const handle = await createSandbox(input)
  const event = logSandboxEvent({
    type: "sandbox.created",
    workflowId: input.workflowId,
    ...handle,
    state: "created",
  })
  await insertSandboxSession({ workflowId: input.workflowId, ticketId: input.ticketId, handle, event })
  return handle
}

export interface ExecuteInSandboxInput extends SandboxHandle {
  workflowId: string
  payload: string
}

export async function executeAgentInSandboxActivity(
  input: ExecuteInSandboxInput
): Promise<{ output: string; computeMs: number }> {
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
  await markExecuting(input.workflowId, result.computeMs, event)
  return result
}

export interface HibernateInput extends SandboxHandle {
  workflowId: string
}

export async function hibernateSandboxActivity(input: HibernateInput): Promise<{ hibernatedAt: string }> {
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
  })
  await markHibernated(input.workflowId, event)
  return { hibernatedAt }
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
  computeSavedMsEstimate: number
}

export async function wakeAndResumeSandboxActivity(
  input: WakeResumeInput
): Promise<WakeResumeResult> {
  await wakeSandbox(input)
  const wokenAt = new Date().toISOString()
  const wakeEvent = logSandboxEvent({
    type: "sandbox.woken",
    workflowId: input.workflowId,
    sandboxId: input.sandboxId,
    sessionId: input.sessionId,
    traceId: input.traceId,
    state: "waking",
    wokenAt,
  })

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
    wakeEvent,
    resumeEvent
  )

  return { wokenAt, resumedAt, output, waitMs, computeSavedMsEstimate }
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
