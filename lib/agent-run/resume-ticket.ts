import { db } from "@/lib/db"
import { sandboxSessions } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import {
  wakeAndResumeSandboxActivity,
  completeSandboxSessionActivity,
} from "@/lib/temporal/activities/sandbox-activities"

/**
 * Human-approval continuation for lib/agent-run/execute-ticket.ts. Runs as
 * its own, separate invocation — everything it needs comes from the
 * `sandbox_sessions` row (session affinity: same sandboxId/sessionId the
 * execute step created), not from any in-memory state.
 */

export interface ResumeDecision {
  approved: boolean
  editedOutput?: string
}

export interface ResumeTicketResult {
  agentRunId: string
  output: string
  approved: boolean
}

export async function resumeTicketAgentRun(
  agentRunId: string,
  decision: ResumeDecision
): Promise<ResumeTicketResult> {
  const session = await db.query.sandboxSessions.findFirst({
    where: eq(sandboxSessions.workflowId, agentRunId),
  })
  if (!session) {
    throw new Error("Sandbox session not found for this AgentRun")
  }
  if (session.state !== "hibernated") {
    throw new Error(`Sandbox not awaiting approval (state: ${session.state})`)
  }

  const handle = { sandboxId: session.sandboxId, sessionId: session.sessionId, traceId: session.traceId }

  if (!decision.approved) {
    await completeSandboxSessionActivity({ workflowId: agentRunId, ...handle, status: "escalated" })
    const output = "This request has been escalated to a human agent. They will follow up shortly."
    await db.update(sandboxSessions).set({ finalOutput: output }).where(eq(sandboxSessions.workflowId, agentRunId))
    return { agentRunId, output, approved: false }
  }

  // Wake -> Resume, on the same sandbox/session the execute step created.
  const resumeResult = await wakeAndResumeSandboxActivity({
    workflowId: agentRunId,
    ...handle,
    priorOutput: session.draftOutput ?? "",
  })
  await completeSandboxSessionActivity({ workflowId: agentRunId, ...handle, status: "completed" })

  const output = decision.editedOutput ?? resumeResult.output
  await db.update(sandboxSessions).set({ finalOutput: output }).where(eq(sandboxSessions.workflowId, agentRunId))

  return { agentRunId, output, approved: true }
}
