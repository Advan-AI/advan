import { describe, expect, it } from "vitest"
import { ADVAN_COPILOT_PIPELINE } from "@/lib/pipeline/presets"
import { EMPTY_PIPELINE, type Pipeline } from "@/lib/pipeline/schema"
import { analyzeWorkflowDefinition } from "./analyzer"

describe("analyzeWorkflowDefinition", () => {
  it("marks the Advan Copilot preset as deployable", () => {
    const analysis = analyzeWorkflowDefinition(ADVAN_COPILOT_PIPELINE)

    expect(analysis.valid).toBe(true)
    expect(analysis.deployable).toBe(true)
    expect(analysis.nodeCount).toBe(7)
    expect(analysis.triggerCount).toBe(1)
    expect(analysis.humanGateCount).toBe(1)
    expect(analysis.errors).toBe(0)
  })

  it("keeps an empty workflow as a non-deployable draft", () => {
    const analysis = analyzeWorkflowDefinition(EMPTY_PIPELINE)

    expect(analysis.valid).toBe(true)
    expect(analysis.deployable).toBe(false)
    expect(analysis.warnings).toBe(1)
    expect(analysis.issues[0]?.code).toBe("empty_pipeline")
  })

  it("detects unknown nodes and missing triggers", () => {
    const pipeline: Pipeline = {
      schemaVersion: 1,
      nodes: [
        {
          id: "mystery",
          type: "ai.nope",
          position: { x: 0, y: 0 },
          data: {},
        },
      ],
      edges: [],
    }

    const analysis = analyzeWorkflowDefinition(pipeline)

    expect(analysis.valid).toBe(false)
    expect(analysis.deployable).toBe(false)
    expect(analysis.issues.map((issue) => issue.code)).toContain("unknown_node")
    expect(analysis.issues.map((issue) => issue.code)).toContain("missing_trigger")
  })

  it("detects cycles before deployment", () => {
    const pipeline: Pipeline = {
      schemaVersion: 1,
      nodes: [
        { id: "a", type: "trigger.message", position: { x: 0, y: 0 }, data: { channel: "chat", failurePolicy: "fail-fast" } },
        { id: "b", type: "ai.intent", position: { x: 200, y: 0 }, data: { model: "triage", threshold: 0.7, failurePolicy: "fail-fast" } },
      ],
      edges: [
        { id: "ab", source: "a", target: "b", sourceHandle: "out", targetHandle: "in" },
        { id: "ba", source: "b", target: "a", sourceHandle: "out", targetHandle: "out" },
      ],
    }

    const analysis = analyzeWorkflowDefinition(pipeline)

    expect(analysis.valid).toBe(false)
    expect(analysis.issues.map((issue) => issue.code)).toContain("cycle")
  })

  it("detects missing required inputs", () => {
    const pipeline: Pipeline = {
      schemaVersion: 1,
      nodes: [
        { id: "start", type: "trigger.message", position: { x: 0, y: 0 }, data: { channel: "chat", failurePolicy: "fail-fast" } },
        { id: "compose", type: "ai.compose", position: { x: 200, y: 0 }, data: { tone: "friendly", failurePolicy: "fail-fast" } },
      ],
      edges: [
        { id: "partial", source: "start", target: "compose", sourceHandle: "out", targetHandle: "intent" },
      ],
    }

    const analysis = analyzeWorkflowDefinition(pipeline)

    expect(analysis.valid).toBe(false)
    expect(analysis.issues.filter((issue) => issue.code === "missing_required_input")).toHaveLength(1)
  })
})
