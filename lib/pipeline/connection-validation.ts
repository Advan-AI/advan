import "@/lib/pipeline/nodes"

import { nodeRegistry } from "./registry"
import { wouldCreateCycle } from "./topology"
import type { PipelineEdge, PipelineNode } from "./schema"

export type ConnectionValidationResult =
  | { ok: true }
  | { ok: false; reason: string }

function portType(type: string, portId: string | null | undefined, direction: "input" | "output") {
  if (!nodeRegistry.has(type)) return null
  const def = nodeRegistry.get(type)
  const ports = direction === "input" ? def.inputs : def.outputs
  if (!portId && ports.length === 1) return ports[0].dataType
  return ports.find((port) => port.id === portId)?.dataType ?? null
}

function typesCompatible(sourceType: string | null, targetType: string | null) {
  if (!sourceType || !targetType) return false
  return sourceType === "any" || targetType === "any" || sourceType === targetType
}

export function validatePipelineConnection({
  nodes,
  edges,
  source,
  target,
  sourceHandle,
  targetHandle,
}: {
  nodes: Pick<PipelineNode, "id" | "type">[]
  edges: Pick<PipelineEdge, "source" | "target" | "sourceHandle" | "targetHandle">[]
  source: string | null | undefined
  target: string | null | undefined
  sourceHandle?: string | null
  targetHandle?: string | null
}): ConnectionValidationResult {
  if (!source || !target) return { ok: false, reason: "Connection needs both a source and a target node." }
  if (source === target) return { ok: false, reason: "A node cannot connect to itself." }
  if (wouldCreateCycle(edges, source, target)) {
    return { ok: false, reason: "That connection would create a cycle. Pipelines must stay acyclic." }
  }

  const sourceNode = nodes.find((node) => node.id === source)
  const targetNode = nodes.find((node) => node.id === target)
  if (!sourceNode || !targetNode) return { ok: false, reason: "Connection references a missing node." }
  if (!nodeRegistry.has(sourceNode.type)) return { ok: false, reason: `Unknown source node type: ${sourceNode.type}.` }
  if (!nodeRegistry.has(targetNode.type)) return { ok: false, reason: `Unknown target node type: ${targetNode.type}.` }

  const sourceDataType = portType(sourceNode.type, sourceHandle, "output")
  const targetDataType = portType(targetNode.type, targetHandle, "input")
  if (!sourceDataType) return { ok: false, reason: "Choose a valid source output port." }
  if (!targetDataType) return { ok: false, reason: "Choose a valid target input port." }
  if (!typesCompatible(sourceDataType, targetDataType)) {
    return {
      ok: false,
      reason: `Port types do not match: ${sourceDataType} cannot feed ${targetDataType}.`,
    }
  }

  const duplicate = edges.some(
    (edge) =>
      edge.source === source &&
      edge.target === target &&
      (edge.sourceHandle ?? null) === (sourceHandle ?? null) &&
      (edge.targetHandle ?? null) === (targetHandle ?? null),
  )
  if (duplicate) return { ok: false, reason: "That exact connection already exists." }

  return { ok: true }
}
