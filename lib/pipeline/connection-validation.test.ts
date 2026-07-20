import { describe, expect, it } from "vitest"
import type { PipelineEdge, PipelineNode } from "./schema"
import { validatePipelineConnection } from "./connection-validation"

const nodes: Pick<PipelineNode, "id" | "type">[] = [
  { id: "trigger", type: "trigger.message" },
  { id: "intent", type: "ai.intent" },
  { id: "kb", type: "kb.retrieve" },
  { id: "compose", type: "ai.compose" },
]

describe("validatePipelineConnection", () => {
  it("allows compatible acyclic connections", () => {
    const result = validatePipelineConnection({
      nodes,
      edges: [],
      source: "trigger",
      target: "intent",
      sourceHandle: "out",
      targetHandle: "in",
    })

    expect(result.ok).toBe(true)
  })

  it("blocks cycles", () => {
    const edges: Pick<PipelineEdge, "source" | "target" | "sourceHandle" | "targetHandle">[] = [
      { source: "trigger", target: "intent", sourceHandle: "out", targetHandle: "in" },
    ]

    const result = validatePipelineConnection({
      nodes,
      edges,
      source: "intent",
      target: "trigger",
      sourceHandle: "out",
      targetHandle: null,
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected connection to be invalid")
    expect(result.reason).toMatch(/cycle/i)
  })

  it("blocks incompatible port data types", () => {
    const result = validatePipelineConnection({
      nodes,
      edges: [],
      source: "trigger",
      target: "compose",
      sourceHandle: "out",
      targetHandle: "docs",
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected connection to be invalid")
    expect(result.reason).toMatch(/message cannot feed documents/i)
  })

  it("allows message context into knowledge retrieval", () => {
    const result = validatePipelineConnection({
      nodes,
      edges: [],
      source: "trigger",
      target: "kb",
      sourceHandle: "out",
      targetHandle: "in",
    })

    expect(result.ok).toBe(true)
  })

  it("blocks duplicate connections", () => {
    const edges: Pick<PipelineEdge, "source" | "target" | "sourceHandle" | "targetHandle">[] = [
      { source: "kb", target: "compose", sourceHandle: "out", targetHandle: "docs" },
    ]

    const result = validatePipelineConnection({
      nodes,
      edges,
      source: "kb",
      target: "compose",
      sourceHandle: "out",
      targetHandle: "docs",
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected connection to be invalid")
    expect(result.reason).toMatch(/already exists/i)
  })
})
