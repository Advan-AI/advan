import crypto from "crypto"
import { NextResponse } from "next/server"
import { executeTicketAgentRun } from "@/lib/agent-run/execute-ticket"

/** Structured AgentRun trace line — same [prefix] {json} convention as
 *  lib/sandbox/fc-sandbox-client.ts's logSandboxEvent/Alert. */
function logAgentRun(event: {
  type: "queued" | "executing" | "completed" | "failed"
  traceId: string
  agentRunId?: string
  durationMs?: number
  error?: string
}) {
  const record = { ts: new Date().toISOString(), ...event }
  const line = `[AgentRun] ${JSON.stringify(record)}`
  if (event.type === "failed") console.error(line)
  else console.log(line)
}

/**
 * Starts a ticket AgentRun (lib/agent-run/execute-ticket.ts) — Postgres-
 * backed orchestration, no Temporal server required. Wire authentication/
 * authorization before exposing in production.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const traceId = crypto.randomUUID()
  const start = Date.now()
  logAgentRun({ type: "queued", traceId })

  try {
    const body = (await req.json()) as {
      orgId?: string
      ticketId?: string
      customerInput?: string
      workflowId?: string
      /** FC Sandbox hibernation policy override, in minutes (default 10). */
      hitlTimeoutMinutes?: number
    }

    const orgId = body.orgId?.trim()
    const ticketId = body.ticketId?.trim()
    const customerInput = body.customerInput?.trim()

    if (!orgId || !ticketId || !customerInput) {
      return NextResponse.json(
        { error: "orgId, ticketId, and customerInput are required strings." },
        { status: 400 }
      )
    }

    const agentRunId =
      body.workflowId?.trim() && body.workflowId.trim().length > 0
        ? body.workflowId.trim()
        : `ticket-${ticketId}-${Date.now()}`

    logAgentRun({ type: "executing", traceId, agentRunId })

    const result = await executeTicketAgentRun({
      orgId,
      ticketId,
      customerInput,
      agentRunId,
      hitlTimeoutMinutes: body.hitlTimeoutMinutes,
    })

    logAgentRun({ type: "completed", traceId, agentRunId, durationMs: Date.now() - start })

    return NextResponse.json({
      traceId,
      workflowId: agentRunId, // kept for existing frontend compatibility
      ...result, // includes agentRunId, status, hitlRequired, and output fields
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    logAgentRun({ type: "failed", traceId, durationMs: Date.now() - start, error: message })
    return NextResponse.json({ traceId, error: message }, { status: 500 })
  }
}
