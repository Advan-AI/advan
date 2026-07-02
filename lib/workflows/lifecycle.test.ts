import { describe, expect, it } from "vitest"
import { ADVAN_COPILOT_PIPELINE } from "@/lib/pipeline/presets"
import { EMPTY_PIPELINE, type Pipeline } from "@/lib/pipeline/schema"
import { checkWorkflowActivation, checkWorkflowRun } from "./lifecycle"

describe("workflow lifecycle policy", () => {
  it("allows deployable workflows to activate", () => {
    const check = checkWorkflowActivation(ADVAN_COPILOT_PIPELINE)

    expect(check.ok).toBe(true)
    expect(check.analysis.deployable).toBe(true)
    expect(check.reason).toBeUndefined()
  })

  it("blocks activation for empty drafts", () => {
    const check = checkWorkflowActivation(EMPTY_PIPELINE)

    expect(check.ok).toBe(false)
    expect(check.analysis.deployable).toBe(false)
    expect(check.reason).toBe("Workflow is not deployable")
  })

  it("blocks inactive workflow runs before Temporal starts", () => {
    const check = checkWorkflowRun(ADVAN_COPILOT_PIPELINE, false)

    expect(check.ok).toBe(false)
    expect(check.reason).toBe("Workflow must be active before it can run.")
  })

  it("allows active deployable workflow runs", () => {
    const check = checkWorkflowRun(ADVAN_COPILOT_PIPELINE, true)

    expect(check.ok).toBe(true)
    expect(check.analysis.errors).toBe(0)
  })

  it("blocks active invalid workflow runs with a useful reason", () => {
    const invalid: Pipeline = {
      schemaVersion: 1,
      nodes: [
        {
          id: "compose",
          type: "ai.compose",
          position: { x: 0, y: 0 },
          data: { tone: "friendly", failurePolicy: "fail-fast" },
        },
      ],
      edges: [],
    }

    const check = checkWorkflowRun(invalid, true)

    expect(check.ok).toBe(false)
    expect(check.analysis.errors).toBeGreaterThan(0)
    expect(check.reason).toMatch(/missing required input|trigger/i)
  })
})
