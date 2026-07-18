import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { and, eq, inArray, sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import type { EmailReceivedEvent, GetReceivingEmailResponseSuccess } from "resend"
import { Webhook, type WebhookRequiredHeaders } from "svix"
import { db } from "@/lib/db"
import {
  conversations,
  emailEvents,
  messages,
  organizations,
} from "@/lib/db/schema"
import { requireEmailConfig, type EmailConfig } from "@/lib/email/config"
import { parseInboundEmail, type ParsedInboundEmail } from "@/lib/email/parse-inbound"
import { getResendClient } from "@/lib/email/resend-client"
import { PIIMasker } from "@/lib/governance/pii-masker"
import { publishCustomerMessage } from "@/lib/realtime/event-bus"
import { resolveOrCreateIntake } from "@/lib/tickets/auto-intake"

export const runtime = "nodejs"

type InboundEventStatus =
  | "received"
  | "unresolved"
  | "unknown_org_alias"
  | "rate_limited"

interface LogEmailEventInput {
  orgId: string | null
  conversationId: string | null
  messageId?: string | null
  providerId: string
  status: InboundEventStatus
  payload: Record<string, unknown>
}

export interface InboundRouteDeps {
  verifyWebhook(payload: string, headers: WebhookRequiredHeaders): EmailReceivedEvent
  fetchReceivedEmail(providerId: string): Promise<GetReceivingEmailResponseSuccess>
  findExistingInboundEvent(providerId: string): Promise<unknown | null>
  resolveOrgByEmailAlias(addresses: string[]): Promise<string | null>
  resolveOrgByReplyAddress(addresses: string[]): Promise<string | null>
  resolveOrgByStoredMessageIds(messageIds: string[]): Promise<string | null>
  resolveOrgByInboundDomain(addresses: string[]): Promise<string | null>
  logEmailEvent(input: LogEmailEventInput): Promise<void>
  resolveOrCreateIntake(input: {
    orgId: string
    parsed: ParsedInboundEmail
  }): Promise<{ ticketId: string; conversationId: string; messageId: string; isNewTicket: boolean }>
  rateLimit(request: Request): Promise<Response | null>
}

let ratelimit: Ratelimit | null = null
let orgEmailRatelimit: Ratelimit | null = null

function getRatelimit() {
  if (ratelimit) return ratelimit

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }

  // IP-based global protection (600 requests per minute per IP).
  // Resend webhooks arrive from shared Resend delivery IPs, so we use a high
  // global IP threshold to prevent one tenant's inbound volume from triggering
  // false-positive blocks for other tenants sharing the same webhook endpoint,
  // while still shielding against brute-force DDoS/abuse attacks.
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(600, "60 s"),
    analytics: true,
    prefix: "advan:webhooks:resend:inbound",
  })

  return ratelimit
}

function getOrgEmailRatelimit() {
  if (orgEmailRatelimit) return orgEmailRatelimit

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }

  // Tenant-isolated rate limit (60 inbound emails per minute per organization).
  // Ensures robust tenant protection and prevents a single organization's
  // inbound email volume spike from disrupting overall system resources.
  orgEmailRatelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(60, "60 s"),
    analytics: true,
    prefix: "advan:email:inbound:org",
  })

  return orgEmailRatelimit
}

function jsonOk(body: Record<string, unknown> = { ok: true }) {
  return NextResponse.json(body, { status: 200 })
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function getRequiredHeader(req: Request, name: string): string | null {
  return req.headers.get(name) ?? req.headers.get(name.toLowerCase())
}

function webhookHeaders(req: Request): WebhookRequiredHeaders | null {
  const id = getRequiredHeader(req, "svix-id")
  const timestamp = getRequiredHeader(req, "svix-timestamp")
  const signature = getRequiredHeader(req, "svix-signature")

  if (!id || !timestamp || !signature) return null

  return {
    "svix-id": id,
    "svix-timestamp": timestamp,
    "svix-signature": signature,
  }
}

function verifyWithSvix(payload: string, headers: WebhookRequiredHeaders): EmailReceivedEvent {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim()
  if (!secret) {
    throw new Error("RESEND_WEBHOOK_SECRET is not configured")
  }

  return new Webhook(secret).verify(payload, headers) as EmailReceivedEvent
}

function extractEmailAddress(value: string | null | undefined): string {
  if (!value) return ""
  const trimmed = value.trim().toLowerCase()
  const angleMatch = /<([^>]+)>/.exec(trimmed)
  return (angleMatch ? angleMatch[1] : trimmed).trim()
}

function normalizeAddress(value: string): string {
  return extractEmailAddress(value)
}

// Extract local part of an email (everything before @)
function extractLocalPart(value: string): string {
  const addr = normalizeAddress(value)
  const at = addr.indexOf("@")
  return at !== -1 ? addr.slice(0, at) : addr
}

function normalizeMessageId(value: string): string {
  return value.trim()
}

function splitReferences(value: string | undefined): string[] {
  if (!value?.trim()) return []
  return value
    .split(/\s+/)
    .map(normalizeMessageId)
    .filter(Boolean)
}

function headerMessageIds(parsed: ParsedInboundEmail): string[] {
  return Array.from(
    new Set([
      ...splitReferences(parsed.headers["in-reply-to"]),
      ...splitReferences(parsed.headers.references),
    ]),
  )
}

export function scrubInboundStorageContent(text: string): string {
  return PIIMasker.mask(text)
}

async function defaultRateLimit(req: Request): Promise<Response | null> {
  const rl = getRatelimit()
  if (!rl) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[ResendInboundWebhook] Upstash rate limit env is missing in production",
      )
      return jsonError("Webhook rate limit unavailable", 503)
    }
    return null
  }

  const identifier =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anonymous"
  const { success, limit, remaining, reset } = await rl.limit(identifier)

  if (success) return null

  return new Response(JSON.stringify({ error: "Too many requests", limit, remaining }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": String(remaining),
      "Retry-After": String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))),
    },
  })
}

export const productionDeps: InboundRouteDeps = {
  verifyWebhook: verifyWithSvix,

  async fetchReceivedEmail(providerId) {
    const response = await getResendClient().emails.receiving.get(providerId)
    if (response.error || !response.data) {
      throw new Error(response.error?.message ?? `Could not fetch inbound email ${providerId}`)
    }
    return response.data
  },

  findExistingInboundEvent(providerId) {
    return db.query.emailEvents.findFirst({
      where: and(
        eq(emailEvents.direction, "inbound"),
        eq(emailEvents.providerId, providerId),
      ),
    })
  },

  async resolveOrgByEmailAlias(addresses) {
    let config: EmailConfig
    try {
      config = requireEmailConfig()
    } catch {
      return null
    }

    const inboundDomain = config.inboundDomain.toLowerCase()

    // 1. Filter recipient addresses under inboundDomain and extract local-parts
    const recipientLocalParts = addresses
      .map(addr => {
        const normalized = addr.trim().toLowerCase()
        const at = normalized.indexOf("@")
        if (at === -1) return null
        const domain = normalized.slice(at + 1)
        if (domain !== inboundDomain) return null
        return normalized.slice(0, at)
      })
      .filter((localPart): localPart is string => Boolean(localPart))

    if (recipientLocalParts.length === 0) return null

    // 2. Query organizations where inboundEmailAlias matches any extracted local-part
    const [row] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(inArray(organizations.inboundEmailAlias, recipientLocalParts))
      .limit(1)

    return row?.id ?? null
  },

  async resolveOrgByReplyAddress(addresses) {
    const normalized = addresses.map(normalizeAddress).filter(Boolean)
    if (normalized.length === 0) return null

    const [row] = await db
      .select({
        orgId: conversations.orgId,
      })
      .from(conversations)
      .where(inArray(conversations.emailReplyToAddress, normalized))
      .limit(1)

    return row?.orgId ?? null
  },

  async resolveOrgByStoredMessageIds(messageIds) {
    const ids = messageIds.map(normalizeMessageId).filter(Boolean)
    if (ids.length === 0) return null

    const [row] = await db
      .select({
        orgId: conversations.orgId,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(inArray(sql<string>`${messages.metadata}->'email'->>'messageId'`, ids))
      .limit(1)

    return row?.orgId ?? null
  },

  resolveOrgByInboundDomain(addresses) {
    let config: EmailConfig
    try {
      config = requireEmailConfig()
    } catch {
      return Promise.resolve(null)
    }

    if (!config.defaultOrgId) return Promise.resolve(null)

    const matched = addresses.some((addr) => {
      const normalized = addr.trim().toLowerCase()
      const at = normalized.indexOf("@")
      return at !== -1 && normalized.slice(at + 1) === config.inboundDomain
    })

    return Promise.resolve(matched ? config.defaultOrgId : null)
  },

  async logEmailEvent(input) {
    await db
      .insert(emailEvents)
      .values({
        orgId: input.orgId,
        conversationId: input.conversationId,
        messageId: input.messageId ?? null,
        direction: "inbound",
        providerId: input.providerId,
        status: input.status,
        payload: input.payload,
      })
      .onConflictDoNothing()
  },

  async resolveOrCreateIntake({ orgId, parsed }) {
    const scrubbedContent = scrubInboundStorageContent(parsed.text)
    const senderEmail = extractEmailAddress(parsed.from)

    return resolveOrCreateIntake({
      orgId,
      channel: "email",
      customerIdentifier: { email: senderEmail },
      content: scrubbedContent,
      subject: parsed.subject || undefined,
      // Thread into the exact conversation the customer replied to.
      // Derived from the reply+{conversationId}@ plus-address in the To header.
      conversationId: parsed.conversationId ?? undefined,
      metadata: {
        email: {
          messageId: parsed.inboundMessageId ?? undefined,
          deliveryStatus: "delivered",
        },
      },
    })
  },

  rateLimit: defaultRateLimit,
}

export async function handleInboundRequest(
  req: Request,
  deps: InboundRouteDeps = productionDeps,
): Promise<Response> {
  const rateLimited = await deps.rateLimit(req)
  if (rateLimited) return rateLimited

  const headers = webhookHeaders(req)
  if (!headers) {
    console.warn("[ResendInboundWebhook] Missing Svix headers")
    return jsonError("Missing webhook signature headers", 401)
  }

  const payload = await req.text()
  let event: EmailReceivedEvent

  try {
    event = deps.verifyWebhook(payload, headers)
  } catch (err) {
    console.warn("[ResendInboundWebhook] Svix verification failed", {
      error: err instanceof Error ? err.message : String(err),
      svixId: headers["svix-id"],
    })
    return jsonError("Invalid webhook signature", 401)
  }

  if (event.type !== "email.received") {
    return jsonOk({ ignored: true })
  }

  const providerId = event.data.email_id?.trim()
  if (!providerId) {
    console.warn("[ResendInboundWebhook] Missing email_id in email.received event")
    return jsonError("Missing email_id", 400)
  }

  const existing = await deps.findExistingInboundEvent(providerId)
  if (existing) {
    return jsonOk({ duplicate: true })
  }

  const receivedEmail = await deps.fetchReceivedEmail(providerId)
  const parsed = parseInboundEmail({ webhookEvent: event, receivedEmail })

  let config: EmailConfig | null = null
  try {
    config = requireEmailConfig()
  } catch {
    // Missing config is fine during test execution
  }

  const inboundDomain = config?.inboundDomain?.toLowerCase()
  const hasInboundDomainRecipient = inboundDomain
    ? parsed.recipientAddresses.some(addr => {
        const at = addr.indexOf("@")
        return at !== -1 && addr.slice(at + 1) === inboundDomain
      })
    : false

  const hasReplyAddress = parsed.recipientAddresses.some(addr => {
    const at = addr.indexOf("@")
    if (at === -1) return false
    const localPart = addr.slice(0, at)
    return localPart.startsWith("reply+")
  })

  // FIRST RESOLUTION STEP: Match the `to` address's local-part against organizations.inboundEmailAlias
  let orgId = await deps.resolveOrgByEmailAlias(parsed.recipientAddresses)

  if (!orgId) {
    // If it was sent to our inbound domain but wasn't a thread reply (or matched any alias), it is an unknown org alias!
    if (hasInboundDomainRecipient && !hasReplyAddress) {
      console.warn("[ResendInboundWebhook] Unknown organization inbound email alias", {
        providerId,
        recipients: parsed.recipientAddresses,
      })
      await deps.logEmailEvent({
        orgId: null,
        conversationId: null,
        providerId,
        status: "unknown_org_alias",
        payload: { event, parsed },
      })
      return jsonOk({ unresolved: true, reason: "unknown_org_alias" })
    }

    // FALLBACK RESOLUTIONS: Try reply address then thread message ID headers
    orgId =
      (await deps.resolveOrgByReplyAddress(parsed.recipientAddresses)) ??
      (await deps.resolveOrgByStoredMessageIds(headerMessageIds(parsed)))
  }

  if (!orgId) {
    console.warn("[ResendInboundWebhook] Could not resolve inbound conversation", {
      providerId,
      recipients: parsed.recipientAddresses,
      inboundMessageId: parsed.inboundMessageId,
    })
    await deps.logEmailEvent({
      orgId: null,
      conversationId: null,
      providerId,
      status: "unresolved",
      payload: { event, parsed },
    })
    return jsonOk({ unresolved: true })
  }

  // Apply secondary tenant-isolated rate limiting to protect resources
  const orgRl = getOrgEmailRatelimit()
  if (orgRl) {
    const { success, limit, remaining, reset } = await orgRl.limit(orgId)
    if (!success) {
      console.warn("[ResendInboundWebhook] Rate limit exceeded for organization", {
        orgId,
        providerId,
      })
      await deps.logEmailEvent({
        orgId,
        conversationId: null,
        providerId,
        status: "rate_limited",
        payload: { event, parsed, limit, remaining },
      })
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded for this organization", limit, remaining }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": String(remaining),
            "Retry-After": String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))),
          },
        },
      )
    }
  }

  const intake = await deps.resolveOrCreateIntake({ orgId, parsed })
  await publishCustomerMessage(orgId, {
    conversationId: intake.conversationId,
    messageId: intake.messageId,
    channel: "email",
    content: parsed.text,
    customerEmail: extractEmailAddress(parsed.from),
  })
  await deps.logEmailEvent({
    orgId,
    conversationId: intake.conversationId,
    messageId: intake.messageId,
    providerId,
    status: "received",
    payload: {
      subject: parsed.subject,
      from: parsed.from,
      headers: parsed.headers,
      inboundMessageId: parsed.inboundMessageId,
      ticketId: intake.ticketId,
      isNewTicket: intake.isNewTicket,
    },
  })
  return jsonOk()
}

export function POST(req: Request): Promise<Response> {
  return handleInboundRequest(req)
}
