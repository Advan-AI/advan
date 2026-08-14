import { getSandboxSessionByWorkflowId } from "@/lib/sandbox/sandbox-store"
import { SANDBOX_MODE } from "@/lib/sandbox/fc-sandbox-client"

/**
 * Shared by /api/demo/fc-sandbox/status (initial fetch) and /stream (SSE
 * push). Derives status purely from `sandbox_sessions` (Postgres) — no
 * Temporal client involved. See lib/agent-run/*.ts for the orchestration
 * that writes this state.
 */
export async function getDemoStatusSnapshot(agentRunId: string) {
  const session = await getSandboxSessionByWorkflowId(agentRunId)

  const terminal = session?.state === "completed" || session?.state === "escalated"
  const workflowStatus = !session ? "UNKNOWN" : terminal ? "COMPLETED" : "RUNNING"

  const result =
    session && terminal
      ? {
          output: session.finalOutput ?? session.draftOutput ?? "",
          confidence: session.draftConfidence ?? 0,
          approved: session.state === "completed",
        }
      : null

  return {
    workflowId: agentRunId,
    agentRunId, // one AgentRun = one sandbox_sessions row, keyed by this id
    workflowStatus,
    sandboxMode: SANDBOX_MODE,
    result,
    sandbox: session
      ? {
          sandboxId: session.sandboxId,
          sessionId: session.sessionId,
          traceId: session.traceId,
          state: session.state,
          createdAt: session.createdAt,
          executedAt: session.executedAt,
          hibernatedAt: session.hibernatedAt,
          wokenAt: session.wokenAt,
          resumedAt: session.resumedAt,
          completedAt: session.completedAt,
          computeMsEstimate: session.computeMsEstimate,
          computeSavedMsEstimate: session.computeSavedMsEstimate,
          wakeLatencyMs: session.wakeLatencyMs,
          hitlTimeoutMinutes: session.hitlTimeoutMinutes,
          events: session.events,
        }
      : null,
  }
}

export type DemoStatusSnapshot = Awaited<ReturnType<typeof getDemoStatusSnapshot>>
