import "@/lib/pipeline/nodes"

import { PipelineCompiler } from "@/lib/pipeline/compiler"
import { nodeRegistry, UnknownNodeTypeError } from "@/lib/pipeline/registry"
import { type Pipeline, PipelineSchema } from "@/lib/pipeline/schema"
import { CyclicPipelineError } from "@/lib/pipeline/topology"

export type WorkflowSeverity = "error" | "warning" | "info"

export type WorkflowIssue = {
  code:
    | "invalid_schema"
    | "empty_pipeline"
    | "duplicate_node"
    | "unknown_node"
    | "invalid_config"
    | "dangling_edge"
    | "missing_required_input"
    | "missing_trigger"
    | "disconnected_node"
    | "cycle"
  severity: WorkflowSeverity
  message: string
  nodeId?: string
  edgeId?: string
}

export type WorkflowAnalysis = {
  valid: boolean
  deployable: boolean
  nodeCount: number
  edgeCount: number
  triggerCount: number
  actionCount: number
  humanGateCount: number
  maxParallelism: number
  waveCount: number
  warnings: number
  errors: number
  issues: WorkflowIssue[]
}

const EMPTY_ANALYSIS: WorkflowAnalysis = {
  valid: false,
  deployable: false,
  nodeCount: 0,
  edgeCount: 0,
  triggerCount: 0,
  actionCount: 0,
  humanGateCount: 0,
  maxParallelism: 0,
  waveCount: 0,
  warnings: 0,
  errors: 0,
  issues: [],
}

function finish(partial: Omit<WorkflowAnalysis, "valid" | "deployable" | "warnings" | "errors">): WorkflowAnalysis {
  const errors = partial.issues.filter((issue) => issue.severity === "error").length
  const warnings = partial.issues.filter((issue) => issue.severity === "warning").length
  return {
    ...partial,
    errors,
    warnings,
    valid: errors === 0,
    deployable: errors === 0 && partial.nodeCount > 0 && partial.triggerCount > 0,
  }
}

export function analyzeWorkflowDefinition(definition: unknown): WorkflowAnalysis {
  const parsed = PipelineSchema.safeParse(definition)
  if (!parsed.success) {
    return finish({
      ...EMPTY_ANALYSIS,
      issues: [
        {
          code: "invalid_schema",
          severity: "error",
          message: "Workflow definition does not match the pipeline schema.",
        },
      ],
    })
  }

  const pipeline = parsed.data
  const issues: WorkflowIssue[] = []
  const nodeIds = new Set<string>()
  const duplicateIds = new Set<string>()

  for (const node of pipeline.nodes) {
    if (nodeIds.has(node.id)) duplicateIds.add(node.id)
    nodeIds.add(node.id)
  }

  if (pipeline.nodes.length === 0) {
    issues.push({
      code: "empty_pipeline",
      severity: "warning",
      message: "Workflow has no nodes yet.",
    })
  }

  for (const nodeId of duplicateIds) {
    issues.push({
      code: "duplicate_node",
      severity: "error",
      nodeId,
      message: `Node id "${nodeId}" is used more than once.`,
    })
  }

  const incomingByNode = new Map<string, typeof pipeline.edges>()
  for (const node of pipeline.nodes) incomingByNode.set(node.id, [])

  for (const edge of pipeline.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push({
        code: "dangling_edge",
        severity: "error",
        edgeId: edge.id,
        message: `Edge "${edge.id}" references a missing node.`,
      })
      continue
    }
    incomingByNode.get(edge.target)?.push(edge)
  }

  let triggerCount = 0
  let actionCount = 0
  let humanGateCount = 0

  for (const node of pipeline.nodes) {
    try {
      const def = nodeRegistry.get(node.type)
      if (def.category === "trigger") triggerCount += 1
      if (def.category === "action") actionCount += 1
      if (def.category === "human") humanGateCount += 1

      const config = def.configSchema.safeParse(node.data)
      if (!config.success) {
        issues.push({
          code: "invalid_config",
          severity: "error",
          nodeId: node.id,
          message: `${def.label} has invalid configuration.`,
        })
      }

      for (const input of def.inputs) {
        const incoming = incomingByNode.get(node.id) ?? []
        const hasInput = incoming.some((edge) => (edge.targetHandle ?? null) === input.id)
        if (!hasInput) {
          issues.push({
            code: "missing_required_input",
            severity: "error",
            nodeId: node.id,
            message: `${def.label} is missing required input "${input.label ?? input.id}".`,
          })
        }
      }
    } catch (error) {
      if (error instanceof UnknownNodeTypeError) {
        issues.push({
          code: "unknown_node",
          severity: "error",
          nodeId: node.id,
          message: error.message,
        })
      } else {
        throw error
      }
    }
  }

  if (pipeline.nodes.length > 0 && triggerCount === 0) {
    issues.push({
      code: "missing_trigger",
      severity: "error",
      message: "Workflow needs at least one trigger node.",
    })
  }

  const connected = new Set<string>()
  for (const edge of pipeline.edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      connected.add(edge.source)
      connected.add(edge.target)
    }
  }
  for (const node of pipeline.nodes) {
    const def = nodeRegistry.has(node.type) ? nodeRegistry.get(node.type) : null
    if (def?.category !== "trigger" && !connected.has(node.id)) {
      issues.push({
        code: "disconnected_node",
        severity: "warning",
        nodeId: node.id,
        message: `"${def?.label ?? node.type}" is not connected to the workflow graph.`,
      })
    }
  }

  let waves: string[][] = []
  try {
    waves = PipelineCompiler.compile(pipeline as Pipeline).waves
  } catch (error) {
    if (error instanceof CyclicPipelineError) {
      issues.push({
        code: "cycle",
        severity: "error",
        message: error.message,
      })
    } else if (!(error instanceof UnknownNodeTypeError)) {
      throw error
    }
  }

  return finish({
    nodeCount: pipeline.nodes.length,
    edgeCount: pipeline.edges.length,
    triggerCount,
    actionCount,
    humanGateCount,
    maxParallelism: waves.length ? Math.max(...waves.map((wave) => wave.length)) : 0,
    waveCount: waves.length,
    issues,
  })
}
