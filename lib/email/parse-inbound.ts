import type { IOptions } from "sanitize-html"
import sanitizeHtml from "sanitize-html"
import type { EmailReceivedEvent, GetReceivingEmailResponseSuccess } from "resend"
import { requireEmailConfig } from "./config"
import { extractConversationIdFromAddresses } from "./threading"

/** Normalized inbound email ready for storage in messages / email_events. */
export interface ParsedInboundEmail {
  conversationId: string
  from: string
  subject: string
  text: string
  html: string
  headers: Record<string, string>
  /** Resend `email_id` — idempotency key for inbound webhook retries. */
  providerId: string
}

export class InboundParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InboundParseError"
  }
}

/** Strip XSS vectors before inbound content is stored or rendered. */
export const INBOUND_SANITIZE_OPTIONS: IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "em",
    "b",
    "i",
    "u",
    "a",
    "ul",
    "ol",
    "li",
    "blockquote",
    "h1",
    "h2",
    "h3",
    "h4",
    "pre",
    "code",
    "span",
    "div",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ],
  allowedAttributes: {
    a: ["href", "title", "name"],
    span: ["class"],
    div: ["class"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  // script, iframe, object, embed are excluded from allowedTags
}

export function sanitizeInboundHtml(dirty: string | null | undefined): string {
  if (!dirty?.trim()) return ""
  return sanitizeHtml(dirty, INBOUND_SANITIZE_OPTIONS).trim()
}

export function sanitizeInboundText(dirty: string | null | undefined): string {
  if (!dirty?.trim()) return ""
  // Plain-text bodies may still contain HTML from misconfigured clients
  const stripped = sanitizeHtml(dirty, { allowedTags: [], allowedAttributes: {} })
  return stripped.trim()
}

export interface ParseInboundInput {
  /** `email.received` webhook event from Resend. */
  webhookEvent: EmailReceivedEvent
  /**
   * Full body from `resend.emails.receiving.get(email_id)` — required because
   * the webhook payload is metadata-only (spike finding).
   */
  receivedEmail: GetReceivingEmailResponseSuccess
}

/**
 * Normalize Resend inbound webhook + receiving.get payload into app shape.
 * HTML/text are sanitized before return (stored-XSS control).
 */
export function parseInboundEmail(input: ParseInboundInput): ParsedInboundEmail {
  const { webhookEvent, receivedEmail } = input
  const { data } = webhookEvent

  const providerId = data.email_id?.trim()
  if (!providerId) {
    throw new InboundParseError("Inbound webhook missing data.email_id")
  }

  const toAddresses = [
    ...data.to,
    ...data.received_for,
    ...receivedEmail.to,
    ...receivedEmail.received_for,
  ]

  const { inboundDomain } = requireEmailConfig()
  const conversationId = extractConversationIdFromAddresses(toAddresses, inboundDomain)
  if (!conversationId) {
    throw new InboundParseError(
      `Could not resolve conversationId from to addresses: ${toAddresses.join(", ")}`,
    )
  }

  const from = (receivedEmail.from || data.from || "").trim()
  if (!from) {
    throw new InboundParseError("Inbound email missing from address")
  }

  const subject = (receivedEmail.subject ?? data.subject ?? "").trim()
  const html = sanitizeInboundHtml(receivedEmail.html)
  const text = sanitizeInboundText(receivedEmail.text ?? stripHtmlToText(receivedEmail.html))
  const headers = receivedEmail.headers ?? {}

  return {
    conversationId,
    from,
    subject,
    text,
    html,
    headers,
    providerId,
  }
}

function stripHtmlToText(html: string | null | undefined): string {
  if (!html?.trim()) return ""
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim()
}
