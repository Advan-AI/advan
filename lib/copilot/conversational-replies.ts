export type ConversationalReplyMode = "clarify" | "warn" | "escalate_ack" | "complaint_ack"

export function buildClarifyingReply(userMessage: string): string {
  if (/\b(refund|return|cancel|exchange|credit)\b/i.test(userMessage)) {
    return "Sure — what's your order number and what went wrong?"
  }

  if (/^(hi|hello|hey)\b/i.test(userMessage.trim())) {
    return "Hi! How can I help you today?"
  }

  return "What do you need help with?"
}

export function buildOffTopicWarning(_userMessage: string): string {
  return "I can only help with billing, API, webhooks, SSO, and account issues. What do you need?"
}

export function buildCollaborativeEscalationReply(_userMessage: string): string {
  return "Sorry this is still open — I'm getting a teammate to join. Any order # or error details help."
}

export function buildComplaintAckReply(_classificationReason?: string): string {
  return "Got it. Let me get someone from the team to help you with this."
}

export function buildConversationalReply(
  mode: ConversationalReplyMode,
  args: { userMessage: string; draftHint?: string; classificationReason?: string }
): string {
  switch (mode) {
    case "clarify":
      return buildClarifyingReply(args.userMessage)
    case "warn":
      return buildOffTopicWarning(args.userMessage)
    case "escalate_ack":
      return buildCollaborativeEscalationReply(args.userMessage)
    case "complaint_ack":
      return buildComplaintAckReply(args.classificationReason)
  }
}
