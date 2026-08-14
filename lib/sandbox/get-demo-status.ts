import { getTemporalClient } from "@/lib/temporal/clients/workflow.client"
import { getSandboxSessionByWorkflowId } from "@/lib/sandbox/sandbox-store"
import { SANDBOX_MODE } from "@/lib/sandbox/fc-sandbox-client"

/** Shared by /api/demo/fc-sandbox/status (initial fetch) and /stream (SSE push). */
export async function getDemoStatusSnapshot(workflowId: string) {
  const client = await getTemporalClient()
  const handle = client.workflow.getHandle(workflowId)
  const description = await handle.describe()

  const session = await getSandboxSessionByWorkflowId(workflowId)

  let result: unknown = null
  if (description.status.name === "COMPLETED") {
    try {
      result = await handle.result()
    } catch {
      // workflow completed via a non-success close status; ignore
    }
  }

  return {
    workflowId,
    agentRunId: workflowId, // one Temporal workflow execution = one AgentRun
    workflowStatus: description.status.name,
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
