import { NextResponse } from "next/server"
import { resumeTicketAgentRun } from "@/lib/agent-run/resume-ticket"

/**
 * Public HITL approve endpoint for the /demo/fc-sandbox page.
 * Triggers wake + resume of the hibernated sandbox session (same
 * sandboxId/sessionId the execute step created) — Postgres-backed, see
 * lib/agent-run/resume-ticket.ts.
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = (await req.json()) as { workflowId?: string; approved?: boolean; editedOutput?: string }
    const workflowId = body.workflowId?.trim()
    if (!workflowId) {
      return NextResponse.json({ error: "workflowId is required." }, { status: 400 })
    }

    const result = await resumeTicketAgentRun(workflowId, {
      approved: body.approved ?? true,
      editedOutput: body.editedOutput,
    })

    return NextResponse.json({ signaled: true, workflowId, ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
