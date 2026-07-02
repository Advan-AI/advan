import { type Pipeline } from "@/lib/pipeline/schema"
import { analyzeWorkflowDefinition, type WorkflowAnalysis } from "./analyzer"

export type WorkflowLifecycleCheck = {
  ok: boolean
  analysis: WorkflowAnalysis
  reason?: string
}

function firstBlockingReason(analysis: WorkflowAnalysis, fallback: string): string {
  return analysis.issues.find((issue) => issue.severity === "error")?.message ?? fallback
}

export function checkWorkflowActivation(definition: Pipeline): WorkflowLifecycleCheck {
  const analysis = analyzeWorkflowDefinition(definition)
  if (!analysis.deployable) {
    return {
      ok: false,
      analysis,
      reason: firstBlockingReason(analysis, "Workflow is not deployable"),
    }
  }
  return { ok: true, analysis }
}

export function checkWorkflowRun(definition: Pipeline, isActive: boolean): WorkflowLifecycleCheck {
  if (!isActive) {
    return {
      ok: false,
      analysis: analyzeWorkflowDefinition(definition),
      reason: "Workflow must be active before it can run.",
    }
  }
  return checkWorkflowActivation(definition)
}
