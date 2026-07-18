import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { pipelineRuns, pipelineRunSteps, hitlQueue } from "@/lib/db/schema"
import { executorRegistry } from "@/lib/pipeline/executors"
import { publishPipelineStep, publishPipelineRunFinished } from "@/lib/realtime/event-bus"

/**
 * Node-side activities for pipeline execution. These run in the Temporal worker
 * (full Node runtime), unlike the workflow which is sandboxed and deterministic.
 */

export interface ExecuteNodeInput {
  orgId: string
  type: string
  config: Record<string, unknown>
  input: Record<string, unknown>
  trigger: { message: string }
}

async function executePipelineNode(args: ExecuteNodeInput): Promise<Record<string, unknown>> {
  const executor = executorRegistry.get(args.type)
  return executor.execute({
    orgId: args.orgId,
    config: args.config,
    input: args.input,
    trigger: args.trigger,
  })
}

async function startPipelineRun(args: {
  orgId: string
  workflowId?: string
  temporalWorkflowId: string
  temporalRunId?: string
}): Promise<{ runId: string }> {
  const [row] = await db
    .insert(pipelineRuns)
    .values({
      orgId: args.orgId,
      workflowId: args.workflowId ?? null,
      temporalWorkflowId: args.temporalWorkflowId,
      temporalRunId: args.temporalRunId ?? null,
      status: "running",
    })
    .returning({ id: pipelineRuns.id })
  return { runId: row.id }
}

async function recordPipelineStep(args: {
  orgId: string
  temporalWorkflowId: string
  runId: string
  nodeId: string
  nodeType: string
  status: "running" | "completed" | "failed" | "skipped"
  output?: unknown
  error?: string
  latencyMs?: number
}): Promise<void> {
  await db.insert(pipelineRunSteps).values({
    runId: args.runId,
    nodeId: args.nodeId,
    nodeType: args.nodeType,
    status: args.status,
    output: args.output ?? null,
    error: args.error ?? null,
    latencyMs: args.latencyMs ?? null,
  })
  await publishPipelineStep(args.orgId, {
    temporalWorkflowId: args.temporalWorkflowId,
    runId: args.runId,
    nodeId: args.nodeId,
    nodeType: args.nodeType,
    status: args.status,
    output: args.output,
    error: args.error,
    latencyMs: args.latencyMs,
  })
}

async function finishPipelineRun(args: {
  orgId: string
  temporalWorkflowId: string
  runId: string
  status: "completed" | "failed" | "cancelled"
}): Promise<void> {
  await db
    .update(pipelineRuns)
    .set({ status: args.status, finishedAt: new Date() })
    .where(eq(pipelineRuns.id, args.runId))

  if (args.status === "completed" || args.status === "failed") {
    await publishPipelineRunFinished(args.orgId, {
      temporalWorkflowId: args.temporalWorkflowId,
      runId: args.runId,
      status: args.status,
    })
  }
}

async function enqueuePipelineHitl(args: {
  orgId: string
  draftOutput: string
  reason: string
  temporalWorkflowId: string
  ticketId?: string
  conversationId?: string
}): Promise<{ hitlId: string }> {
  const [row] = await db
    .insert(hitlQueue)
    .values({
      orgId: args.orgId,
      ticketId: args.ticketId || null,
      conversationId: args.conversationId || null,
      draftOutput: args.draftOutput,
      reason: args.reason,
      temporalWorkflowId: args.temporalWorkflowId,
      status: "pending",
      priority: "low_confidence",
      source: "workflow",
    })
    .returning({ id: hitlQueue.id })
  return { hitlId: row.id }
}

export type PipelineActivities = {
  executePipelineNode: typeof executePipelineNode
  startPipelineRun: typeof startPipelineRun
  recordPipelineStep: typeof recordPipelineStep
  finishPipelineRun: typeof finishPipelineRun
  enqueuePipelineHitl: typeof enqueuePipelineHitl
}

export const pipelineActivities: PipelineActivities = {
  executePipelineNode,
  startPipelineRun,
  recordPipelineStep,
  finishPipelineRun,
  enqueuePipelineHitl,
}
