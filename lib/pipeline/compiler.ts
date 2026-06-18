import { PipelineSchema, type Pipeline } from "./schema"
import { toExecutionWaves } from "./topology"

/**
 * Serializable execution plan — pure data, safe to pass into a Temporal
 * workflow (no functions, no class instances). The workflow walks `waves`
 * sequentially, executing each wave's nodes in parallel, pulling each node's
 * inputs from upstream outputs via `incoming`.
 */
export interface PlanNode {
  id: string
  type: string
  data: Record<string, unknown>
}

export interface IncomingEdge {
  source: string
  sourceHandle: string | null
  targetHandle: string | null
}

export interface ExecutionPlan {
  waves: string[][]
  nodes: Record<string, PlanNode>
  incoming: Record<string, IncomingEdge[]>
}

export class PipelineCompiler {
  /**
   * Validate + topologically compile a pipeline. Throws on schema violation or
   * cycle (the third and final cycle-prevention layer).
   */
  static compile(pipeline: Pipeline): ExecutionPlan {
    const parsed = PipelineSchema.parse(pipeline)
    const waves = toExecutionWaves(parsed) // throws CyclicPipelineError on cycle

    const nodes: Record<string, PlanNode> = {}
    for (const n of parsed.nodes) nodes[n.id] = { id: n.id, type: n.type, data: n.data }

    const incoming: Record<string, IncomingEdge[]> = {}
    for (const n of parsed.nodes) incoming[n.id] = []
    for (const e of parsed.edges) {
      if (!incoming[e.target]) continue
      incoming[e.target].push({
        source: e.source,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
      })
    }

    return { waves, nodes, incoming }
  }
}
