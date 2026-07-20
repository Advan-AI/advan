import { requireEmailConfig } from "./config"

export interface PriorMessageEmailMeta {
  /** RFC Message-ID from Resend inbound `data.message_id` (not our outbound id). */
  messageId?: string
  inReplyTo?: string
}

export interface ThreadingHeaders {
  messageId: string
  replyTo: string
  /**
   * In-Reply-To / References for outbound send. Empty when no prior inbound id exists.
   * Not used for conversation routing — see module comment below.
   */
  inReplyTo?: string
  references?: string
}

/**
 * Resend spike (2026-07-02): AWS SES overwrites outbound Message-ID even when passed
 * in `headers`, so we cannot match inbound replies via our generated Message-ID.
 * Primary routing uses Reply-To plus-address (`reply+{conversationId}@domain`).
 * In-Reply-To / References are still set when we have a prior Resend inbound
 * `message_id` to improve client-side threading, but webhook handlers must resolve
 * conversations from the plus-address in `to`, not from References headers.
 */

export function buildMessageId(conversationId: string, timestampMs: number = Date.now()): string {
  const { inboundDomain } = requireEmailConfig()
  return `<conv-${conversationId}-${timestampMs}@${inboundDomain}>`
}

export function buildReplyToAddress(conversationId: string): string {
  const { inboundDomain } = requireEmailConfig()
  return `reply+${conversationId}@${inboundDomain}`
}

/** Build In-Reply-To / References from prior messages (newest last in references chain). */
export function buildThreadingHeaders(
  conversationId: string,
  priorMessages: PriorMessageEmailMeta[],
  timestampMs?: number,
): ThreadingHeaders {
  const messageId = buildMessageId(conversationId, timestampMs)
  const replyTo = buildReplyToAddress(conversationId)

  const rfcIds = priorMessages
    .map((m) => m.messageId?.trim())
    .filter((id): id is string => Boolean(id))

  if (rfcIds.length === 0) {
    return { messageId, replyTo }
  }

  const inReplyTo = rfcIds[rfcIds.length - 1]
  const references = rfcIds.join(" ")

  return { messageId, replyTo, inReplyTo, references }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Parse `reply+{conversationId}@domain` from a single address local part. */
export function parseReplyToLocalPart(address: string): string | null {
  const trimmed = address.trim().toLowerCase()
  const at = trimmed.indexOf("@")
  if (at === -1) return null

  const local = trimmed.slice(0, at)
  const match = /^reply\+(.+)$/.exec(local)
  if (!match) return null

  const conversationId = match[1]
  return UUID_RE.test(conversationId) ? conversationId : null
}

/** Resolve conversation id from one or more recipient addresses. */
export function extractConversationIdFromAddresses(
  addresses: string[],
  inboundDomain?: string,
): string | null {
  const domain = (inboundDomain ?? requireEmailConfig().inboundDomain).toLowerCase()

  for (const raw of addresses) {
    const trimmed = raw.trim().toLowerCase()
    const angleMatch = /^(.+?)\s*<([^>]+)>$/.exec(trimmed)
    const email = angleMatch ? angleMatch[2] : trimmed

    const at = email.indexOf("@")
    if (at === -1) continue
    if (email.slice(at + 1) !== domain) continue

    const id = parseReplyToLocalPart(email)
    if (id) return id
  }

  return null
}
