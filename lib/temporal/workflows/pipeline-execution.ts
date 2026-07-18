import {
  proxyActivities,
  condition,
  setHandler,
  defineSignal,
  workflowInfo,
} from "@temporalio/workflow"
import type { PipelineActivities } from "../activities/pipeline-activities"
import type { ExecutionPlan, IncomingEdge } from "@/lib/pipeline/compiler"

const {
  executePipelineNode,
  startPipelineRun,
  recordPipelineStep,
  finishPipelineRun,
  enqueuePipelineHitl,
} = proxyActivities<PipelineActivities>({
  startToCloseTimeout: "60 seconds",
  retry: { maximumAttempts: 3, initialInterval: "1s", backoffCoefficient: 2, maximumInterval: "30s" },
})

/** Reuses the same signal name as the Co-Pilot HITL flow. */
export const hitlDecisionSignal = defineSignal<[{ approved: boolean; editedOutput?: string }]>("hitl-decision")

export interface PipelineExecutionInput {
  orgId: string
  workflowId?: string
  plan: ExecutionPlan
  trigger: { message: string }
  ticketId?: string
  conversationId?: string
}

export interface PipelineExecutionResult {
  runId: string
  status: "completed" | "failed"
  outputs: Record<string, unknown>
}

type FailurePolicy = "fail-fast" | "skip" | "retry-then-skip"

/**
 * Durable pipeline execution.
 *
 * - Nodes within a wave have no interdependencies → executed in PARALLEL.
 * - Waves run sequentially (topological order from the compiler).
 * - Each node is one activity → Temporal handles retries/timeouts.
 * - `human.approval` nodes pause the run on a HITL signal.
 * - Failure handling is per-node, declared in node config (`failurePolicy`).
 * - Workflow state (the `outputs` map) is durably persisted by Temporal and
 *   resumes exactly after a worker crash.
 */
export async function pipelineExecutionWorkflow(
  input: PipelineExecutionInput
): Promise<PipelineExecutionResult> {
  const { workflowId: temporalWorkflowId } = workflowInfo()
  const { runId } = await startPipelineRun({
    orgId: input.orgId,
    workflowId: input.workflowId,
    temporalWorkflowId,
  })

  const outputs: Record<string, unknown> = {}
  let hitlDecision: { approved: boolean; editedOutput?: string } | null = null
  setHandler(hitlDecisionSignal, (d) => { hitlDecision = d })

  try {
    for (const wave of input.plan.waves) {
      const settled = await Promise.all(
        wave.map((nodeId) =>
          runNode(nodeId, input, runId, temporalWorkflowId, outputs, () => hitlDecision, () => { hitlDecision = null })
        )
      )
      for (const r of settled) {
        outputs[r.nodeId] = r.output
        if (r.fatal) {
          await finishPipelineRun({ orgId: input.orgId, temporalWorkflowId, runId, status: "failed" })
          return { runId, status: "failed", outputs }
        }
      }
    }
    await finishPipelineRun({ orgId: input.orgId, temporalWorkflowId, runId, status: "completed" })
    return { runId, status: "completed", outputs }
  } catch {
    await finishPipelineRun({ orgId: input.orgId, temporalWorkflowId, runId, status: "failed" })
    return { runId, status: "failed", outputs }
  }
}

async function runNode(
  nodeId: string,
  input: PipelineExecutionInput,
  runId: string,
  temporalWorkflowId: string,
  outputs: Record<string, unknown>,
  getDecision: () => { approved: boolean; editedOutput?: string } | null,
  resetDecision: () => void
): Promise<{ nodeId: string; output: unknown; fatal: boolean }> {
  const node = input.plan.nodes[nodeId]
  const policy = (node.data.failurePolicy as FailurePolicy) ?? "fail-fast"
  const nodeInput = gatherInputs(input.plan.incoming[nodeId] ?? [], outputs)
  const t0 = Date.now()

  await recordPipelineStep({
    orgId: input.orgId, temporalWorkflowId, runId, nodeId, nodeType: node.type, status: "running",
  })

  try {
    let output = await executePipelineNode({
      orgId: input.orgId,
      type: node.type,
      config: node.data,
      input: nodeInput,
      trigger: input.trigger,
    })

    // HITL gate
    if (node.type === "human.approval" && (output as { requiresApproval?: boolean }).requiresApproval) {
      const timeoutMin = Number(node.data.timeoutMinutes ?? 10)
      await enqueuePipelineHitl({
        orgId: input.orgId,
        draftOutput: String((output as { draft?: string }).draft ?? ""),
        reason: "Pipeline confidence below threshold",
        temporalWorkflowId: workflowInfo().workflowId,
        ticketId: input.ticketId,
        conversationId: input.conversationId,
      })
      const resolved = await condition(() => getDecision() !== null, `${timeoutMin} minutes`)
      const decision = getDecision()
      resetDecision()
      if (!resolved || !decision?.approved) {
        output = { ...output, approved: false, escalated: true }
      } else {
        output = { ...output, approved: true, output: decision.editedOutput ?? (output as { draft?: string }).draft }
      }
    }

    await recordPipelineStep({
      orgId: input.orgId, temporalWorkflowId, runId, nodeId, nodeType: node.type, status: "completed",
      output, latencyMs: Date.now() - t0,
    })
    return { nodeId, output, fatal: false }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const skipped = policy === "skip" || policy === "retry-then-skip"
    await recordPipelineStep({
      orgId: input.orgId, temporalWorkflowId, runId, nodeId, nodeType: node.type,
      status: skipped ? "skipped" : "failed", error: message, latencyMs: Date.now() - t0,
    })
    return { nodeId, output: { error: message, skipped }, fatal: !skipped }
  }
}

/** Pure: collect upstream outputs keyed by this node's target handle. */
function gatherInputs(incoming: IncomingEdge[], outputs: Record<string, unknown>): Record<string, unknown> {
  const input: Record<string, unknown> = {}
  for (const edge of incoming) {
    const key = edge.targetHandle ?? "in"
    input[key] = outputs[edge.source]
  }
  return input
}
