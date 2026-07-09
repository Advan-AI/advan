import { describe, expect, it } from "vitest"
import { classifyMessage, parseClassification } from "./complaint-classifier"

// ─── parseClassification — defensive parsing ──────────────────────────────────

describe("parseClassification", () => {
  it("parses a well-formed JSON string correctly", () => {
    const raw = JSON.stringify({
      isComplaint: true,
      severity: "high",
      sentiment: "negative",
      reasoning: "Customer reported repeated shipping failure and demanded a refund.",
    })
    const result = parseClassification(raw)

    expect(result.isComplaint).toBe(true)
    expect(result.severity).toBe("high")
    expect(result.sentiment).toBe("negative")
    expect(result.reasoning).toContain("refund")
  })

  it("strips markdown code fences models sometimes add", () => {
    const inner = JSON.stringify({
      isComplaint: false,
      severity: "low",
      sentiment: "neutral",
      reasoning: "General business-hours enquiry.",
    })
    const raw = "```json\n" + inner + "\n```"
    const result = parseClassification(raw)

    expect(result.isComplaint).toBe(false)
    expect(result.severity).toBe("low")
  })

  it("returns fail-safe on completely malformed JSON (garbage text)", () => {
    const result = parseClassification("Sorry I can't return JSON right now {{{ oops")

    expect(result.isComplaint).toBe(true)
    expect(result.severity).toBe("medium")
    expect(result.reasoning).toMatch(/defaulted to human review/i)
  })

  it("returns fail-safe when severity is an unrecognised value", () => {
    const raw = JSON.stringify({
      isComplaint: true,
      severity: "critical",
      sentiment: "negative",
      reasoning: "model invented a severity level",
    })
    const result = parseClassification(raw)

    expect(result.isComplaint).toBe(true)
    expect(result.severity).toBe("medium")
  })

  it("returns fail-safe when sentiment is an unrecognised value", () => {
    const raw = JSON.stringify({
      isComplaint: false,
      severity: "low",
      sentiment: "ambivalent",
      reasoning: "model invented a sentiment",
    })
    const result = parseClassification(raw)

    expect(result.isComplaint).toBe(true)
    expect(result.severity).toBe("medium")
  })

  it("returns fail-safe when isComplaint is not a boolean", () => {
    const raw = JSON.stringify({
      isComplaint: "yes",
      severity: "high",
      sentiment: "negative",
      reasoning: "coerced string instead of bool",
    })
    const result = parseClassification(raw)

    expect(result.isComplaint).toBe(true)
    expect(result.severity).toBe("medium")
  })

  it("returns fail-safe when required fields are missing", () => {
    const raw = JSON.stringify({ isComplaint: true, severity: "high" })
    const result = parseClassification(raw)

    expect(result.isComplaint).toBe(true)
    expect(result.severity).toBe("medium")
  })
})

// ─── classifyMessage — fixture messages ───────────────────────────────────────

describe("classifyMessage", () => {
  it("classifies a clear, high-severity complaint correctly", async () => {
    const invoker = async () =>
      JSON.stringify({
        isComplaint: true,
        severity: "high",
        sentiment: "negative",
        reasoning:
          "Customer explicitly states this is the third occurrence of non-shipment and makes a direct refund demand — high severity complaint.",
      })

    const result = await classifyMessage(
      "this is the third time my order hasn't shipped, I want a refund",
      undefined,
      invoker
    )

    expect(result.isComplaint).toBe(true)
    expect(result.severity).toBe("high")
    expect(result.sentiment).toBe("negative")
    expect(result.reasoning.length).toBeGreaterThan(0)
  })

  it("classifies a neutral informational question as non-complaint", async () => {
    const invoker = async () =>
      JSON.stringify({
        isComplaint: false,
        severity: "low",
        sentiment: "neutral",
        reasoning: "Customer is asking a routine informational question with no expressed dissatisfaction.",
      })

    const result = await classifyMessage(
      "what are your business hours",
      undefined,
      invoker
    )

    expect(result.isComplaint).toBe(false)
    expect(result.severity).toBe("low")
    expect(result.sentiment).toBe("neutral")
  })

  it("handles an ambiguous, frustrated-but-unclear message", async () => {
    // Ambiguous: expresses uncertainty and mild frustration without a direct demand.
    // The exact classification is judgement-call — we assert structural validity.
    const invoker = async () =>
      JSON.stringify({
        isComplaint: true,
        severity: "medium",
        sentiment: "negative",
        reasoning:
          "Customer has waited longer than expected with no communication — frustration is implicit; treated as complaint to ensure review.",
      })

    const result = await classifyMessage(
      "I submitted a support request two days ago and still haven't heard anything — not sure what's going on",
      ["Hi, I need help with my account", "Can someone get back to me?"],
      invoker
    )

    expect(["low", "medium", "high"]).toContain(result.severity)
    expect(["positive", "neutral", "negative"]).toContain(result.sentiment)
    expect(typeof result.isComplaint).toBe("boolean")
    expect(typeof result.reasoning).toBe("string")
  })

  it("defaults to fail-safe (isComplaint=true, severity=medium) when the model returns broken JSON", async () => {
    // Simulates a model that forgets to output JSON and writes prose instead.
    const brokenInvoker = async () =>
      "I think this looks like a complaint but I forgot to output JSON. My analysis: the customer seems upset."

    const result = await classifyMessage(
      "this is the third time my order hasn't shipped, I want a refund",
      undefined,
      brokenInvoker
    )

    expect(result.isComplaint).toBe(true)
    expect(result.severity).toBe("medium")
    expect(result.reasoning).toMatch(/defaulted to human review/i)
  })

  it("defaults to fail-safe when the model returns an empty string", async () => {
    const emptyInvoker = async () => ""

    const result = await classifyMessage("any message", undefined, emptyInvoker)

    expect(result.isComplaint).toBe(true)
    expect(result.severity).toBe("medium")
  })

  it("defaults to fail-safe when the LLM invoker throws (network/timeout error)", async () => {
    const throwingInvoker = async (): Promise<string> => {
      throw new Error("LLM provider timeout after 30s")
    }

    const result = await classifyMessage(
      "this is the third time my order hasn't shipped, I want a refund",
      undefined,
      throwingInvoker
    )

    expect(result.isComplaint).toBe(true)
    expect(result.severity).toBe("medium")
  })

  it("passes conversation history to the invoker when provided", async () => {
    const captured: { content: string; history?: string[] } = { content: "" }

    const capturingInvoker = async (content: string, history?: string[]) => {
      captured.content = content
      captured.history = history
      return JSON.stringify({
        isComplaint: false,
        severity: "low",
        sentiment: "neutral",
        reasoning: "Follow-up clarification, no complaint.",
      })
    }

    const history = ["Hello, I have a question.", "It's about my invoice."]
    await classifyMessage("Can you confirm the total again?", history, capturingInvoker)

    expect(captured.content).toBe("Can you confirm the total again?")
    expect(captured.history).toEqual(history)
  })
})
