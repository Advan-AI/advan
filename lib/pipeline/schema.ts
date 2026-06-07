import { z } from "zod"

/**
 * Pipeline DAG contract (Feature 2).
 *
 * The SINGLE source of truth shared by the canvas (writes), the validator
 * (save-time), and the compiler/engine (reads). Maps 1:1 to React Flow's
 * Node/Edge shape so the canvas serializes with zero translation.
 *
 * `schemaVersion` is a literal so we can migrate definitions safely later.
 */

export const PipelineNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1), // registry key, e.g. "ai.intent"
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.record(z.unknown()).default({}),
})

export const PipelineEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  sourceHandle: z.string().nullable().optional(),
  target: z.string().min(1),
  targetHandle: z.string().nullable().optional(),
})

export const PipelineSchema = z.object({
  schemaVersion: z.literal(1),
  nodes: z.array(PipelineNodeSchema),
  edges: z.array(PipelineEdgeSchema),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).optional(),
})

export type PipelineNode = z.infer<typeof PipelineNodeSchema>
export type PipelineEdge = z.infer<typeof PipelineEdgeSchema>
export type Pipeline = z.infer<typeof PipelineSchema>

export const EMPTY_PIPELINE: Pipeline = { schemaVersion: 1, nodes: [], edges: [] }
