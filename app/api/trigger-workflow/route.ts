import crypto from "crypto"
import { NextResponse } from "next/server"
import { executeTicketAgentRun } from "@/lib/agent-run/execute-ticket"
import { toPublicApiError } from "@/lib/api/sanitize-trpc-error"

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

function formatUnknownError(err: unknown): string {
  if (err instanceof Error) {
    const cause = err.cause instanceof Error ? err.cause.message : undefined
    const message = [err.message, cause].filter((part) => part && !part.includes("undefined undefined")).join(" — ")
    if (message) return message
  }
  if (err && typeof err === "object") {
    const e = err as { name?: unknown; code?: unknown; details?: unknown; message?: unknown }
    const parts = [e.name, e.code, e.details, e.message]
      .map((part) => (typeof part === "string" ? part.trim() : ""))
      .filter((part) => part.length > 0 && part !== "undefined")
    if (parts.length > 0) return parts.join(" — ")
  }
  return "Failed to start Temporal workflow. Is the Temporal server running on TEMPORAL_ADDRESS?"
}

/**
 * Starts a ticket AgentRun (lib/agent-run/execute-ticket.ts) — Postgres-
 * backed orchestration, no Temporal server required. Wire authentication/
 * authorization before exposing in production.
 */
export const runtime = "nodejs"

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
    const internal = formatUnknownError(err)
    logAgentRun({ type: "failed", traceId, durationMs: Date.now() - start, error: internal })
    console.error("[trigger-workflow] start failed", err)
    return NextResponse.json(
      { traceId, error: toPublicApiError(err, "Could not start the demo run. Try again.") },
      { status: 500 }
    )
  }
}
