import type { Pipeline } from "./schema"

/**
 * "Advan Copilot" — the advanced pre-built pipeline users can switch to.
 * It is just a Pipeline JSON document; switching is `store.loadPipeline(...)`,
 * with no special-casing in the engine or canvas.
 */
export const ADVAN_COPILOT_PIPELINE: Pipeline = {
  schemaVersion: 1,
  nodes: [
    { id: "n_msg", type: "trigger.message", position: { x: 40, y: 160 }, data: { channel: "chat", failurePolicy: "fail-fast" } },
    { id: "n_intent", type: "ai.intent", position: { x: 280, y: 60 }, data: { model: "triage", threshold: 0.7, failurePolicy: "retry-then-skip" } },
    { id: "n_kb", type: "kb.retrieve", position: { x: 280, y: 260 }, data: { topK: 5, failurePolicy: "skip" } },
    { id: "n_compose", type: "ai.compose", position: { x: 540, y: 160 }, data: { tone: "friendly", failurePolicy: "fail-fast" } },
    { id: "n_human", type: "human.approval", position: { x: 800, y: 160 }, data: { minConfidence: 85, timeoutMinutes: 10, failurePolicy: "fail-fast" } },
    { id: "n_crm", type: "action.crm", position: { x: 1060, y: 60 }, data: { provider: "salesforce", failurePolicy: "skip" } },
    { id: "n_esc", type: "action.escalate", position: { x: 1060, y: 260 }, data: { queue: "tier-2", failurePolicy: "skip" } },
  ],
  edges: [
    { id: "e1", source: "n_msg", target: "n_intent", sourceHandle: "out", targetHandle: "in" },
    { id: "e2", source: "n_msg", target: "n_kb", sourceHandle: "out", targetHandle: "in" },
    { id: "e3", source: "n_intent", target: "n_compose", sourceHandle: "out", targetHandle: "intent" },
    { id: "e4", source: "n_kb", target: "n_compose", sourceHandle: "out", targetHandle: "docs" },
    { id: "e5", source: "n_compose", target: "n_human", sourceHandle: "out", targetHandle: "in" },
    { id: "e6", source: "n_human", target: "n_crm", sourceHandle: "out", targetHandle: "in" },
    { id: "e7", source: "n_human", target: "n_esc", sourceHandle: "out", targetHandle: "in" },
  ],
}
