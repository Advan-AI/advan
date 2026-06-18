import { z } from "zod"
import { nodeRegistry, FailurePolicySchema } from "../registry"

/**
 * Built-in node types. Each registers itself — adding a new type means adding a
 * `nodeRegistry.register({...})` block (here or in any imported module) and a
 * matching executor in `lib/pipeline/executors`. The canvas needs no changes.
 *
 * Import this module once (side-effect) to populate the registry.
 */

nodeRegistry.register({
  type: "trigger.message",
  label: "Customer Message",
  description: "Entry point. Emits the inbound customer message into the pipeline.",
  category: "trigger",
  iconName: "MessageSquare",
  tone: "blue",
  inputs: [],
  outputs: [{ id: "out", label: "Message", dataType: "message" }],
  configSchema: z.object({
    channel: z.enum(["email", "chat", "voice", "slack", "portal"]).default("chat"),
    failurePolicy: FailurePolicySchema,
  }),
  defaults: { channel: "chat", failurePolicy: "fail-fast" },
})

nodeRegistry.register({
  type: "ai.intent",
  label: "AI Intent Detection",
  description: "Classifies the message intent (billing, technical, account, …).",
  category: "ai",
  iconName: "Brain",
  tone: "violet",
  inputs: [{ id: "in", dataType: "message" }],
  outputs: [{ id: "out", label: "Intent", dataType: "intent" }],
  configSchema: z.object({
    model: z.string().default("triage"),
    threshold: z.number().min(0).max(1).default(0.7),
    failurePolicy: FailurePolicySchema,
  }),
  defaults: { model: "triage", threshold: 0.7, failurePolicy: "retry-then-skip" },
})

nodeRegistry.register({
  type: "kb.retrieve",
  label: "Knowledge Retrieval",
  description: "Vector search over the org knowledge base (pgvector).",
  category: "data",
  iconName: "BookOpen",
  tone: "blue",
  inputs: [{ id: "in", dataType: "intent" }],
  outputs: [{ id: "out", label: "Documents", dataType: "documents" }],
  configSchema: z.object({
    topK: z.number().int().min(1).max(20).default(5),
    failurePolicy: FailurePolicySchema,
  }),
  defaults: { topK: 5, failurePolicy: "skip" },
})

nodeRegistry.register({
  type: "ai.compose",
  label: "Compose Response",
  description: "Drafts a sourced response grounded in retrieved documents.",
  category: "ai",
  iconName: "Sparkles",
  tone: "violet",
  inputs: [
    { id: "intent", dataType: "intent" },
    { id: "docs", dataType: "documents" },
  ],
  outputs: [{ id: "out", label: "Draft", dataType: "draft" }],
  configSchema: z.object({
    tone: z.enum(["concise", "friendly", "formal"]).default("friendly"),
    failurePolicy: FailurePolicySchema,
  }),
  defaults: { tone: "friendly", failurePolicy: "fail-fast" },
})

nodeRegistry.register({
  type: "human.approval",
  label: "Human Approval",
  description: "HITL gate. Pauses the run until a reviewer approves/edits.",
  category: "human",
  iconName: "UserCheck",
  tone: "amber",
  inputs: [{ id: "in", dataType: "draft" }],
  outputs: [{ id: "out", label: "Decision", dataType: "decision" }],
  configSchema: z.object({
    minConfidence: z.number().min(0).max(100).default(85),
    timeoutMinutes: z.number().int().min(1).max(1440).default(10),
    failurePolicy: FailurePolicySchema,
  }),
  defaults: { minConfidence: 85, timeoutMinutes: 10, failurePolicy: "fail-fast" },
})

nodeRegistry.register({
  type: "action.crm",
  label: "CRM Update",
  description: "Writes the resolution back to the connected CRM.",
  category: "action",
  iconName: "Database",
  tone: "sage",
  inputs: [{ id: "in", dataType: "decision" }],
  outputs: [{ id: "out", dataType: "any" }],
  configSchema: z.object({
    provider: z.enum(["salesforce", "hubspot", "zendesk"]).default("salesforce"),
    failurePolicy: FailurePolicySchema,
  }),
  defaults: { provider: "salesforce", failurePolicy: "skip" },
})

nodeRegistry.register({
  type: "action.escalate",
  label: "Escalation",
  description: "Routes to a senior queue when confidence is low.",
  category: "action",
  iconName: "ArrowUpRight",
  tone: "rose",
  inputs: [{ id: "in", dataType: "decision" }],
  outputs: [{ id: "out", dataType: "any" }],
  configSchema: z.object({
    queue: z.string().default("tier-2"),
    failurePolicy: FailurePolicySchema,
  }),
  defaults: { queue: "tier-2", failurePolicy: "skip" },
})
