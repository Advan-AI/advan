import { NextResponse } from "next/server"
import { getTemporalClient } from "@/lib/temporal/clients/workflow.client"
import { requireEnv } from "@/lib/env/required"

const TEMPORAL_TASK_QUEUE = requireEnv("TEMPORAL_TASK_QUEUE")

/**
 * Sample App Router endpoint: starts `ticketResolutionWorkflow` on the worker task queue.
 * Wire authentication/authorization before exposing in production.
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = (await req.json()) as {
      orgId?: string
      ticketId?: string
      customerInput?: string
      workflowId?: string
      taskQueue?: string
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

    const client = await getTemporalClient()
    const workflowId =
      body.workflowId?.trim() && body.workflowId.trim().length > 0
        ? body.workflowId.trim()
        : `ticket-${ticketId}-${Date.now()}`

    const taskQueue =
      body.taskQueue?.trim() && body.taskQueue.trim().length > 0
        ? body.taskQueue.trim()
        : TEMPORAL_TASK_QUEUE

    const handle = await client.workflow.start("ticketResolutionWorkflow", {
      taskQueue,
      workflowId,
      args: [{ orgId, ticketId, customerInput }],
    })

    return NextResponse.json({
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId,
      taskQueue,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
