import { z } from "zod"

/**
 * Node Type Registry (metadata plane).
 *
 * This is the Open-Closed seam for the whole builder: the Canvas, Sidebar,
 * Inspector, compiler, and executor are CLOSED for modification — they iterate
 * the registry. A new node type is added by REGISTERING a `NodeTypeDef` (open
 * for extension); no engine code is touched.
 *
 * Three planes are keyed by the same `type` string:
 *   - metadata (here, shared)        → ports, config schema, defaults, labels
 *   - view (components/pipeline)     → React renderer (client only)
 *   - executor (lib/pipeline/executors) → server-side step logic
 *
 * Keep this module free of React and Node-only imports so it is safe to import
 * from both the browser and the server.
 */

export type Tone = "violet" | "blue" | "amber" | "rose" | "sage" | "slate"
export type NodeCategory = "trigger" | "ai" | "data" | "human" | "action"
export type PortDataType = "message" | "intent" | "documents" | "draft" | "decision" | "any"

export interface PortDef {
  id: string
  label?: string
  dataType: PortDataType
}

export interface NodeTypeDef<TConfig = Record<string, unknown>> {
  type: string
  label: string
  description: string
  category: NodeCategory
  iconName: string // mapped to a lucide icon on the client
  tone: Tone
  inputs: PortDef[]
  outputs: PortDef[]
  configSchema: z.ZodType<TConfig>
  defaults: TConfig
}

export class UnknownNodeTypeError extends Error {
  constructor(type: string) {
    super(`Unknown pipeline node type: "${type}"`)
    this.name = "UnknownNodeTypeError"
  }
}

class NodeRegistry {
  private readonly map = new Map<string, NodeTypeDef>()

  register<T extends Record<string, unknown>>(def: NodeTypeDef<T>): void {
    if (this.map.has(def.type)) return // idempotent across HMR / multiple imports
    this.map.set(def.type, def as unknown as NodeTypeDef)
  }

  get(type: string): NodeTypeDef {
    const def = this.map.get(type)
    if (!def) throw new UnknownNodeTypeError(type)
    return def
  }

  has(type: string): boolean {
    return this.map.has(type)
  }

  all(): NodeTypeDef[] {
    return [...this.map.values()]
  }

  byCategory(): Record<NodeCategory, NodeTypeDef[]> {
    const out = { trigger: [], ai: [], data: [], human: [], action: [] } as Record<NodeCategory, NodeTypeDef[]>
    for (const def of this.map.values()) out[def.category].push(def)
    return out
  }
}

/** Process-wide singleton (survives Next.js HMR). */
const g = globalThis as typeof globalThis & { __ADVAN_NODE_REGISTRY__?: NodeRegistry }
export const nodeRegistry = g.__ADVAN_NODE_REGISTRY__ ?? (g.__ADVAN_NODE_REGISTRY__ = new NodeRegistry())

/** Shared failure-policy schema mixed into every node's config. */
export const FailurePolicySchema = z
  .enum(["fail-fast", "skip", "retry-then-skip"])
  .default("fail-fast")
