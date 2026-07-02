import type { ErrorResponse } from "resend"
import { requireEmailConfig } from "./config"
import { getResendClient } from "./resend-client"
import { buildThreadingHeaders, type PriorMessageEmailMeta } from "./threading"
import { renderAgentReplyEmail } from "./templates/agent-reply"

export interface SendAgentReplyInput {
  conversationId: string
  to: string
  ticketSubject: string
  agentMessage: string
  agentName?: string
  priorMessages?: PriorMessageEmailMeta[]
}

export interface SendAgentReplyResult {
  /** Resend outbound email id (`data.id`). */
  resendId: string
  /** Our generated Message-ID (may differ from wire id — see threading.ts). */
  messageId: string
}

export class EmailSendError extends Error {
  readonly code: string
  readonly retryable: boolean
  readonly statusCode: number | null

  constructor(
    message: string,
    options: { code: string; retryable: boolean; statusCode: number | null },
  ) {
    super(message)
    this.name = "EmailSendError"
    this.code = options.code
    this.retryable = options.retryable
    this.statusCode = options.statusCode
  }
}

const PERMANENT_ERROR_CODES = new Set<string>([
  "validation_error",
  "invalid_from_address",
  "invalid_parameter",
  "missing_required_field",
  "invalid_idempotency_key",
  "invalid_idempotent_request",
  "restricted_api_key",
  "invalid_api_key",
  "not_found",
  "invalid_access",
  "invalid_region",
  "security_error",
  "monthly_quota_exceeded",
  "daily_quota_exceeded",
])

const RETRYABLE_ERROR_CODES = new Set<string>([
  "rate_limit_exceeded",
  "internal_server_error",
  "application_error",
  "concurrent_idempotent_requests",
])

export function classifyResendError(error: ErrorResponse): EmailSendError {
  const code = error.name ?? "application_error"
  let retryable: boolean

  if (RETRYABLE_ERROR_CODES.has(code)) {
    retryable = true
  } else if (PERMANENT_ERROR_CODES.has(code)) {
    retryable = false
  } else {
    // Unknown codes: retry once for transient infra issues
    retryable = (error.statusCode ?? 500) >= 500
  }

  // Invalid recipient addresses surface as validation_error (permanent)
  if (
    code === "validation_error" &&
    /invalid.*(to|recipient|email)/i.test(error.message)
  ) {
    retryable = false
  }

  return new EmailSendError(error.message, {
    code,
    retryable,
    statusCode: error.statusCode,
  })
}

function subjectLine(ticketSubject: string): string {
  const trimmed = ticketSubject.trim()
  return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`
}

export async function sendAgentReply(
  input: SendAgentReplyInput,
): Promise<SendAgentReplyResult> {
  const resend = getResendClient()
  const threading = buildThreadingHeaders(
    input.conversationId,
    input.priorMessages ?? [],
  )
  const { html, text } = renderAgentReplyEmail({
    agentMessage: input.agentMessage,
    agentName: input.agentName,
    ticketSubject: input.ticketSubject,
  })

  const headers: Record<string, string> = {}
  if (threading.inReplyTo) {
    headers["In-Reply-To"] = threading.inReplyTo
  }
  if (threading.references) {
    headers["References"] = threading.references
  }

  const { from } = requireEmailConfig()

  const response = await resend.emails.send({
    from,
    to: input.to,
    replyTo: threading.replyTo,
    subject: subjectLine(input.ticketSubject),
    html,
    text,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  })

  if (response.error) {
    throw classifyResendError(response.error)
  }

  const resendId = response.data?.id
  if (!resendId) {
    throw new EmailSendError("Resend send succeeded but returned no email id", {
      code: "application_error",
      retryable: true,
      statusCode: null,
    })
  }

  return {
    resendId,
    messageId: threading.messageId,
  }
}
