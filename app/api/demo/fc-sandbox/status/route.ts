import { NextResponse } from "next/server"
import { getTemporalClient } from "@/lib/temporal/clients/workflow.client"
import { getSandboxSessionByWorkflowId } from "@/lib/sandbox/sandbox-store"
import { SANDBOX_MODE } from "@/lib/sandbox/fc-sandbox-client"

/**
 * Public, read-only status endpoint for the /demo/fc-sandbox page.
 * Combines Temporal's workflow status with the persisted sandbox session
 * row so the UI can render the full execute -> hibernate -> wake -> resume
 * -> finish timeline by polling one endpoint.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const workflowId = new URL(req.url).searchParams.get("workflowId")?.trim()
  if (!workflowId) {
    return NextResponse.json({ error: "workflowId query param is required." }, { status: 400 })
  }

  try {
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

    return NextResponse.json({
      workflowId,
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
            events: session.events,
          }
        : null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
