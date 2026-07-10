import { describe, expect, it } from "vitest"
import {
  isOffTopicMessage,
  isSimpleRemediationRequest,
  isVagueMessage,
  resolveChatIntent,
} from "./chat-intent"

const NON_COMPLAINT = {
  isComplaint: false,
  severity: "low" as const,
  sentiment: "neutral" as const,
  reasoning: "Routine question.",
}

const HIGH_COMPLAINT = {
  isComplaint: true,
  severity: "high" as const,
  sentiment: "negative" as const,
  reasoning: "Repeated failure and refund demand.",
}

describe("chat intent heuristics", () => {
  it("detects vague greetings", () => {
    expect(isVagueMessage("hi")).toBe(true)
    expect(isVagueMessage("help")).toBe(true)
  })

  it("treats simple refund asks as remediation, not immediate escalation", () => {
    expect(isSimpleRemediationRequest("i need a refund to my order")).toBe(true)
  })

  it("flags off-topic messages with weak KB retrieval", () => {
    expect(isOffTopicMessage("tell me a joke about weather", 0.3)).toBe(true)
  })
})

describe("resolveChatIntent", () => {
  it("routes vague greetings to clarify", () => {
    const result = resolveChatIntent({
      content: "hi",
      topRetrievalScore: 0.55,
      classification: NON_COMPLAINT,
      needsHumanHandoff: false,
      confidence: 57,
      confidenceThreshold: 85,
    })
    expect(result.intent).toBe("clarify")
  })

  it("routes simple refund requests to clarify", () => {
    const result = resolveChatIntent({
      content: "i need a refund to my order",
      topRetrievalScore: 0.6,
      classification: { ...HIGH_COMPLAINT, severity: "medium" },
      needsHumanHandoff: false,
      confidence: 53,
      confidenceThreshold: 85,
    })
    expect(result.intent).toBe("clarify")
  })

  it("routes KB-strong questions to kb_answer", () => {
    const result = resolveChatIntent({
      content: "What are the API rate limits for the Growth plan?",
      topRetrievalScore: 0.77,
      classification: NON_COMPLAINT,
      needsHumanHandoff: false,
      confidence: 86,
      confidenceThreshold: 85,
    })
    expect(result.intent).toBe("kb_answer")
  })

  it("prioritises human handoff when unresolved", () => {
    const result = resolveChatIntent({
      content: "Still not resolved, get me a human",
      topRetrievalScore: 0.5,
      classification: NON_COMPLAINT,
      needsHumanHandoff: true,
      confidence: 40,
      confidenceThreshold: 85,
    })
    expect(result.intent).toBe("human_handoff")
  })
})
