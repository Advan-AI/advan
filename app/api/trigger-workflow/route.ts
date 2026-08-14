import crypto from "crypto"
import { NextResponse } from "next/server"
import { getTemporalClient } from "@/lib/temporal/clients/workflow.client"

const DEFAULT_TASK_QUEUE = "advan-agents"

/** Structured AgentRun trace line — same [prefix] {json} convention as
 *  lib/sandbox/fc-sandbox-client.ts's logSandboxEvent/Alert, scoped one
 *  level up (this covers queuing the run itself, before any FC Sandbox
 *  session exists). Never logs request bodies or credentials. */
function logAgentRun(event: {
  type: "queued" | "executing" | "completed" | "failed"
  traceId: string
  workflowId?: string
  taskQueue?: string
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
 * Sample App Router endpoint: starts `ticketResolutionWorkflow` on the worker task queue.
 * Wire authentication/authorization before exposing in production.
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
      taskQueue?: string
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

    const workflowId =
      body.workflowId?.trim() && body.workflowId.trim().length > 0
        ? body.workflowId.trim()
        : `ticket-${ticketId}-${Date.now()}`

    const taskQueue =
      body.taskQueue?.trim() && body.taskQueue.trim().length > 0
        ? body.taskQueue.trim()
        : DEFAULT_TASK_QUEUE

    logAgentRun({ type: "executing", traceId, workflowId, taskQueue })

    // This is the AgentRun → Temporal handoff. If TEMPORAL_ADDRESS is unset
    // or unreachable, this call is where it fails (connection deadline),
    // before any workflow — and therefore before FC Sandbox — ever starts.
    const client = await getTemporalClient()
    const handle = await client.workflow.start("ticketResolutionWorkflow", {
      taskQueue,
      workflowId,
      args: [{ orgId, ticketId, customerInput, hitlTimeoutMinutes: body.hitlTimeoutMinutes }],
    })

    logAgentRun({ type: "completed", traceId, workflowId, taskQueue, durationMs: Date.now() - start })

    return NextResponse.json({
      traceId,
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId,
      taskQueue,
    })
  } catch (err: unknown) {
    const message = formatUnknownError(err)
    logAgentRun({ type: "failed", traceId, durationMs: Date.now() - start, error: message })
    console.error("[trigger-workflow] start failed", err)
    return NextResponse.json({ traceId, error: message }, { status: 500 })
  }
}
