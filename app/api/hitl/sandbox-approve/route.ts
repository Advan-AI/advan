import { NextRequest, NextResponse } from "next/server"
import { getEffectiveSession } from "@/lib/auth/effective-session"
import { resumeTicketAgentRun } from "@/lib/agent-run/resume-ticket"
import { db } from "@/lib/db"
import { tickets } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

/**
 * Auth-protected HITL sandbox approve/reject for the dashboard.
 * Unlike /api/demo/fc-sandbox/approve (public), this verifies session + org ownership.
 *
 * POST body: { workflowId: string, ticketId: string, approved: boolean, editedOutput?: string }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getEffectiveSession()
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { workflowId?: string; ticketId?: string; approved?: boolean; editedOutput?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { workflowId, ticketId, approved, editedOutput } = body
  if (!workflowId || !ticketId || typeof approved !== "boolean") {
    return NextResponse.json(
      { error: "workflowId, ticketId, and approved are required" },
      { status: 400 }
    )
  }

  const ticket = await db.query.tickets.findFirst({
    where: and(eq(tickets.id, ticketId), eq(tickets.orgId, session.user.orgId)),
  })
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
  }

  try {
    const result = await resumeTicketAgentRun(workflowId, { approved, editedOutput })
    return NextResponse.json({ signaled: true, workflowId, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Resume failed"
    const status = message.includes("not found") ? 404 : message.includes("not awaiting approval") ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
