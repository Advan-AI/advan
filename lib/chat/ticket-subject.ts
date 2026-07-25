/**
 * Chat ticket / conversation titles for agent surfaces.
 *
 * Production convention:
 *   - Prefer the visitor's opening issue as the topic
 *   - Always pair with their name when we have it (never "Chat session — …")
 *   - Greetings-only / empty → "Chat with {Name}"
 *   - Absolute fallback → "Live chat"
 *
 * Examples:
 *   "Smith · Where is my refund?"
 *   "Chat with Smith"
 */

const LEGACY_CHAT_SUBJECT = /^chat\s+session\s*[\u2014\u2013\-:]\s*(.+)$/i
const TRIVIAL_OPENING =
  /^(hi|hello|hey|helo|hola|yo|sup|good\s+(morning|afternoon|evening))[.!?]*$/i
const DEFAULT_CHAT_SUBJECT = "Live chat"
const MAX_TOPIC_LEN = 56

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function nonEmpty(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null
  const trimmed = collapseWhitespace(value)
  return trimmed.length > 0 ? trimmed : null
}

/** First sentence / clause, capped so "Name · topic" still fits queue columns. */
export function summarizeChatOpening(message: string | null | undefined): string | null {
  if (typeof message !== "string") return null
  const cleaned = collapseWhitespace(message)
  if (!cleaned) return null
  if (TRIVIAL_OPENING.test(cleaned)) return null

  const sentenceBreak = cleaned.search(/[.!?](?:\s|$)/)
  const base =
    sentenceBreak > 0 && sentenceBreak <= MAX_TOPIC_LEN
      ? cleaned.slice(0, sentenceBreak + 1).trim()
      : cleaned

  if (base.length <= MAX_TOPIC_LEN) return base
  const sliced = base.slice(0, MAX_TOPIC_LEN - 1)
  const lastSpace = sliced.lastIndexOf(" ")
  const cut = lastSpace > 28 ? sliced.slice(0, lastSpace) : sliced
  return `${cut}…`
}

/**
 * Subject stored on the ticket when a chat session is created.
 */
export function buildChatTicketSubject(input: {
  displayName?: string | null
  initialMessage?: string | null
}): string {
  const name = nonEmpty(input.displayName)
  const topic = summarizeChatOpening(input.initialMessage)

  if (name && topic) return `${name} · ${topic}`
  if (topic) return topic
  if (name) return `Chat with ${name}`
  return DEFAULT_CHAT_SUBJECT
}

/**
 * Humanize subjects for tickets / conversations lists.
 * Rewrites legacy "Chat session — {name}" and greeting-only titles.
 */
export function formatTicketSubjectForDisplay(input: {
  channel?: string | null
  subject?: string | null
  customerName?: string | null
  lastMessagePreview?: string | null
}): string {
  const subject = nonEmpty(input.subject) ?? ""
  const customerName = nonEmpty(input.customerName)
  const legacyMatch = subject.match(LEGACY_CHAT_SUBJECT)
  const isChat = input.channel === "chat" || Boolean(legacyMatch)

  if (!isChat) {
    return subject || "Untitled"
  }

  // Already in the new "Name · topic" / "Chat with Name" shape.
  if (
    subject &&
    !legacyMatch &&
    (/^chat with /i.test(subject) || (customerName != null && subject.startsWith(`${customerName} ·`)))
  ) {
    return subject
  }

  const nameFromLegacy = legacyMatch?.[1] ? collapseWhitespace(legacyMatch[1]) : null
  const name = customerName ?? nameFromLegacy
  const topicFromSubject =
    subject &&
    subject !== DEFAULT_CHAT_SUBJECT &&
    !legacyMatch &&
    !/^chat with /i.test(subject)
      ? subject
      : null
  const topic =
    summarizeChatOpening(input.lastMessagePreview) ??
    summarizeChatOpening(topicFromSubject)

  return buildChatTicketSubject({
    displayName: name,
    initialMessage: topic,
  })
}

export { DEFAULT_CHAT_SUBJECT }
