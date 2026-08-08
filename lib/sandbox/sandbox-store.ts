import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { sandboxSessions } from "@/lib/db/schema"
import type { SandboxHandle } from "./fc-sandbox-client"
import { publishSandboxUpdate } from "./sandbox-events-bus"

/**
 * Persistence for FC Sandbox sessions ("AgentRun" records — one row per
 * agent execution that paused for HITL). Every lifecycle transition is
 * written here so the session survives process/server restarts and can be
 * displayed by the demo page (or any other observer) without talking to
 * Temporal directly.
 *
 * Fault tolerance: `workflowId` is UNIQUE (migration 0022). Temporal retries
 * `createSandboxSessionActivity` per its configured retry policy on
 * transient failure; `insertSandboxSession` upserts on that key instead of
 * inserting a duplicate row, so a retried activity — or a workflow replay
 * after a worker crash — converges on the same session record rather than
 * fragmenting state.
 */

export async function insertSandboxSession(input: {
  workflowId: string
  ticketId: string
  handle: SandboxHandle
  event: Record<string, unknown>
  hitlTimeoutMinutes: number
}) {
  const [row] = await db
    .insert(sandboxSessions)
    .values({
      workflowId: input.workflowId,
      ticketId: input.ticketId,
      traceId: input.handle.traceId,
      sandboxId: input.handle.sandboxId,
      sessionId: input.handle.sessionId,
      state: "created",
      hitlTimeoutMinutes: input.hitlTimeoutMinutes,
      events: [input.event],
    })
    .onConflictDoUpdate({
      target: sandboxSessions.workflowId,
      // Retry of the same activity invocation: identity fields are already
      // correct, just re-affirm state/event rather than erroring or duplicating.
      set: { state: "created", events: [input.event] },
    })
    .returning()
  publishSandboxUpdate(input.workflowId)
  return row
}

async function appendEvent(workflowId: string, event: Record<string, unknown>) {
  const existing = await db.query.sandboxSessions.findFirst({
    where: eq(sandboxSessions.workflowId, workflowId),
  })
  return [...(existing?.events ?? []), event]
}

export async function markExecuting(workflowId: string, computeMs: number, event: Record<string, unknown>) {
  const events = await appendEvent(workflowId, event)
  await db
    .update(sandboxSessions)
    .set({ state: "executing", executedAt: new Date(), computeMsEstimate: computeMs, events })
    .where(eq(sandboxSessions.workflowId, workflowId))
  publishSandboxUpdate(workflowId)
}

export async function markHibernated(workflowId: string, event: Record<string, unknown>) {
  const events = await appendEvent(workflowId, event)
  await db
    .update(sandboxSessions)
    .set({ state: "hibernated", hibernatedAt: new Date(), events })
    .where(eq(sandboxSessions.workflowId, workflowId))
  publishSandboxUpdate(workflowId)
}

export async function markWokenAndResumed(
  workflowId: string,
  wakeLatencyMs: number,
  wakeEvent: Record<string, unknown>,
  resumeEvent: Record<string, unknown>
) {
  const existing = await db.query.sandboxSessions.findFirst({
    where: eq(sandboxSessions.workflowId, workflowId),
  })
  const wokenAt = new Date()
  const resumedAt = new Date()
  const waitMs = existing?.hibernatedAt ? wokenAt.getTime() - existing.hibernatedAt.getTime() : 0
  // Estimated compute saved by hibernating: the idle wait time we did NOT
  // bill sandbox compute for, since the sandbox was frozen rather than
  // left running while waiting on a human.
  const computeSavedMsEstimate = Math.max(0, waitMs)

  await db
    .update(sandboxSessions)
    .set({
      state: "resumed",
      wokenAt,
      resumedAt,
      wakeLatencyMs,
      computeSavedMsEstimate,
      events: [...(existing?.events ?? []), wakeEvent, resumeEvent],
    })
    .where(eq(sandboxSessions.workflowId, workflowId))
  publishSandboxUpdate(workflowId)

  return { waitMs, computeSavedMsEstimate }
}

export async function markCompleted(
  workflowId: string,
  state: "completed" | "escalated",
  event: Record<string, unknown>
) {
  const events = await appendEvent(workflowId, event)
  await db
    .update(sandboxSessions)
    .set({ state, completedAt: new Date(), events })
    .where(eq(sandboxSessions.workflowId, workflowId))
  publishSandboxUpdate(workflowId)
}

export async function getSandboxSessionByWorkflowId(workflowId: string) {
  return db.query.sandboxSessions.findFirst({
    where: eq(sandboxSessions.workflowId, workflowId),
  })
}
