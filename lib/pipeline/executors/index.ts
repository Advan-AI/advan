import { agentActivities } from "@/lib/temporal/activities/agent-activities"

/**
 * Server-side executor plane (Node worker, NOT the Temporal workflow sandbox).
 *
 * Keyed by the same `type` string as the metadata/view planes. The engine
 * depends on the `NodeExecutor` interface (DIP) — adding a node type means
 * registering an executor here, with no engine changes.
 */

export interface NodeExecuteArgs {
  orgId: string
  config: Record<string, unknown>
  /** Upstream outputs keyed by this node's input handle id. */
  input: Record<string, unknown>
  /** Original run trigger (e.g. the customer message), available to any node. */
  trigger: { message: string }
}

export interface NodeExecutor {
  type: string
  execute(args: NodeExecuteArgs): Promise<Record<string, unknown>>
}

class ExecutorRegistry {
  private readonly map = new Map<string, NodeExecutor>()
  register(e: NodeExecutor) { if (!this.map.has(e.type)) this.map.set(e.type, e) }
  get(type: string): NodeExecutor {
    const e = this.map.get(type)
    if (!e) throw new Error(`No executor registered for node type "${type}"`)
    return e
  }
  has(type: string) { return this.map.has(type) }
}

const g = globalThis as typeof globalThis & { __ADVAN_EXECUTOR_REGISTRY__?: ExecutorRegistry }
export const executorRegistry = g.__ADVAN_EXECUTOR_REGISTRY__ ?? (g.__ADVAN_EXECUTOR_REGISTRY__ = new ExecutorRegistry())

// ── Built-in executors (reuse the existing agent activities) ─────────────────

executorRegistry.register({
  type: "trigger.message",
  async execute({ trigger }) {
    return { message: trigger.message }
  },
})

executorRegistry.register({
  type: "ai.intent",
  async execute({ orgId, trigger }) {
    const r = await agentActivities.runTriageActivity({ orgId, text: trigger.message })
    return { intent: r.intent, confidence: r.confidence }
  },
})

executorRegistry.register({
  type: "kb.retrieve",
  async execute({ orgId, input, trigger, config }) {
    const intent = (input.in as { intent?: string })?.intent ?? "general"
    const r = await agentActivities.runKnowledgeActivity({ orgId, query: trigger.message, intent })
    const topK = Number(config.topK ?? 5)
    return { sources: r.sources.slice(0, topK) }
  },
})

executorRegistry.register({
  type: "ai.compose",
  async execute({ orgId, input, trigger }) {
    const intent = (input.intent as { intent?: string })?.intent ?? "general"
    const sources = ((input.docs as { sources?: unknown })?.sources ?? []) as never
    const r = await agentActivities.runComposerActivity({ orgId, input: trigger.message, intent, sources })
    return { output: r.output, confidence: r.confidence, citations: r.citations, policyViolation: r.policyViolation }
  },
})

executorRegistry.register({
  type: "human.approval",
  async execute({ input, config }) {
    const upstream = (input.in as { output?: string; confidence?: number; citations?: unknown }) ?? {}
    const minConfidence = Number(config.minConfidence ?? 85)
    const confidence = Number(upstream.confidence ?? 0)
    return {
      requiresApproval: confidence < minConfidence,
      draft: upstream.output ?? "",
      confidence,
      citations: upstream.citations ?? [],
    }
  },
})

executorRegistry.register({
  type: "action.crm",
  async execute({ config, input }) {
    // Side-effect stub — wire a real CRM client here. Returns the upstream decision.
    return { ok: true, provider: config.provider ?? "salesforce", forwarded: (input.in as Record<string, unknown>) ?? {} }
  },
})

executorRegistry.register({
  type: "action.escalate",
  async execute({ config, input }) {
    return { ok: true, queue: config.queue ?? "tier-2", forwarded: (input.in as Record<string, unknown>) ?? {} }
  },
})
