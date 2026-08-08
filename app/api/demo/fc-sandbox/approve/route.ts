import { NextResponse } from "next/server"
import { signalHITLDecision } from "@/lib/temporal/clients/workflow.client"

/**
 * Public HITL approve endpoint for the /demo/fc-sandbox page.
 * Signals the running workflow — this is what triggers wake + resume of the
 * hibernated sandbox session (see ticketResolutionWorkflow).
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = (await req.json()) as { workflowId?: string; approved?: boolean }
    const workflowId = body.workflowId?.trim()
    if (!workflowId) {
      return NextResponse.json({ error: "workflowId is required." }, { status: 400 })
    }

    await signalHITLDecision(workflowId, { approved: body.approved ?? true })

    return NextResponse.json({ signaled: true, workflowId })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
