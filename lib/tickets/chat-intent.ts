import type { ComplaintClassification } from "@/lib/governance/complaint-classifier"

export type ChatIntent =
  | "kb_answer"
  | "clarify"
  | "off_topic"
  | "human_handoff"
  | "complaint_review"

export interface ChatIntentResult {
  intent: ChatIntent
  reasoning: string
}

const GREETING_RE =
  /^(hi|hello|hey|hiya|good (morning|afternoon|evening)|howdy|sup|yo)[!.?\s]*$/i
const VAGUE_RE =
  /^(help|support|assistance|question|info|anyone there|are you there)[!.?\s]*$/i

const OFF_TOPIC_RE =
  /\b(weather|joke|poem|recipe|football|soccer|movie|song lyrics|write me a|who is the president|bitcoin price|stock market)\b/i

const SIMPLE_REMEDIATION_RE =
  /\b(refund|return|cancel|exchange|credit)\b/i

const AGGRESSIVE_COMPLAINT_RE =
  /\b(third|3rd|fourth|4th|demand|unacceptable|ridiculous|lawsuit|lawyer|scam|fraud|never again)\b/i

export function isVagueMessage(content: string): boolean {
  const trimmed = content.trim()
  if (trimmed.length === 0) return true
  if (GREETING_RE.test(trimmed) || VAGUE_RE.test(trimmed)) return true
  if (trimmed.length <= 18 && !trimmed.includes("?")) return true
  return false
}

export function isOffTopicMessage(content: string, topRetrievalScore: number): boolean {
  if (OFF_TOPIC_RE.test(content) && topRetrievalScore < 0.5) return true
  if (topRetrievalScore < 0.38 && content.length > 30 && !content.includes("?")) {
    return OFF_TOPIC_RE.test(content)
  }
  return false
}

export function isSimpleRemediationRequest(content: string): boolean {
  const trimmed = content.trim()
  return (
    SIMPLE_REMEDIATION_RE.test(trimmed) &&
    trimmed.length < 120 &&
    !AGGRESSIVE_COMPLAINT_RE.test(trimmed)
  )
}

/**
 * Decide how the AI should engage before applying the confidence gate.
 * Priority: unresolved human handoff > serious complaint > off-topic > clarify > KB.
 */
export function resolveChatIntent(args: {
  content: string
  topRetrievalScore: number
  classification: ComplaintClassification
  needsHumanHandoff: boolean
  confidence: number
  confidenceThreshold: number
}): ChatIntentResult {
  const { content, topRetrievalScore, classification, needsHumanHandoff, confidence, confidenceThreshold } =
    args

  if (needsHumanHandoff) {
    return {
      intent: "human_handoff",
      reasoning: "Customer requested a human or repeated unresolved follow-ups detected.",
    }
  }

  if (classification.isComplaint) {
    if (classification.severity === "high" || AGGRESSIVE_COMPLAINT_RE.test(content)) {
      return {
        intent: "complaint_review",
        reasoning: classification.reasoning || "High-severity complaint requires human review.",
      }
    }
    if (isSimpleRemediationRequest(content)) {
      return {
        intent: "clarify",
        reasoning: "Remediation request needs order/account details before we can proceed.",
      }
    }
  }

  if (isOffTopicMessage(content, topRetrievalScore)) {
    return {
      intent: "off_topic",
      reasoning: "Message appears outside Advan product-support scope.",
    }
  }

  if (isVagueMessage(content) || (confidence < confidenceThreshold && topRetrievalScore < 0.55)) {
    return {
      intent: "clarify",
      reasoning: isVagueMessage(content)
        ? "Greeting or vague message — ask what the customer needs."
        : "Low KB match — ask a clarifying question before answering.",
    }
  }

  if (confidence >= confidenceThreshold && topRetrievalScore >= 0.5) {
    return {
      intent: "kb_answer",
      reasoning: "Strong KB match and confidence — answer from knowledge base.",
    }
  }

  return {
    intent: "clarify",
    reasoning: "Confidence below threshold — gather more detail instead of guessing.",
  }
}
