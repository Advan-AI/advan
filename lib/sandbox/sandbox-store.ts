import { eq, desc } from "drizzle-orm"
import { db } from "@/lib/db"
import { sandboxSessions } from "@/lib/db/schema"
import type { SandboxHandle } from "./fc-sandbox-client"

/**
 * Persistence for FC Sandbox sessions. This is the "session persistence"
 * layer: every lifecycle transition is written here so the workflow state
 * survives process/server restarts and can be displayed by the demo page
 * (or any other observer) without talking to Temporal directly.
 */

export async function insertSandboxSession(input: {
  workflowId: string
  ticketId: string
  handle: SandboxHandle
  event: Record<string, unknown>
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
      events: [input.event],
    })
    .returning()
  return row
}

async function appendEvent(workflowId: string, event: Record<string, unknown>) {
  const existing = await db.query.sandboxSessions.findFirst({
    where: eq(sandboxSessions.workflowId, workflowId),
    orderBy: desc(sandboxSessions.createdAt),
  })
  return [...(existing?.events ?? []), event]
}

export async function markExecuting(workflowId: string, computeMs: number, event: Record<string, unknown>) {
  const events = await appendEvent(workflowId, event)
  await db
    .update(sandboxSessions)
    .set({ state: "executing", executedAt: new Date(), computeMsEstimate: computeMs, events })
    .where(eq(sandboxSessions.workflowId, workflowId))
}

export async function markHibernated(workflowId: string, event: Record<string, unknown>) {
  const events = await appendEvent(workflowId, event)
  await db
    .update(sandboxSessions)
    .set({ state: "hibernated", hibernatedAt: new Date(), events })
    .where(eq(sandboxSessions.workflowId, workflowId))
}

export async function markWokenAndResumed(
  workflowId: string,
  wakeEvent: Record<string, unknown>,
  resumeEvent: Record<string, unknown>
) {
  const existing = await db.query.sandboxSessions.findFirst({
    where: eq(sandboxSessions.workflowId, workflowId),
    orderBy: desc(sandboxSessions.createdAt),
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
      computeSavedMsEstimate,
      events: [...(existing?.events ?? []), wakeEvent, resumeEvent],
    })
    .where(eq(sandboxSessions.workflowId, workflowId))

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
}

export async function getSandboxSessionByWorkflowId(workflowId: string) {
  return db.query.sandboxSessions.findFirst({
    where: eq(sandboxSessions.workflowId, workflowId),
    orderBy: desc(sandboxSessions.createdAt),
  })
}
