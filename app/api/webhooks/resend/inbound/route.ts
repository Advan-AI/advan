import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { and, eq, inArray, sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import type { EmailReceivedEvent, GetReceivingEmailResponseSuccess } from "resend"
import { Webhook, type WebhookRequiredHeaders } from "svix"
import { db } from "@/lib/db"
import {
  conversations,
  customers,
  emailEvents,
  messages,
  tickets,
} from "@/lib/db/schema"
import { parseInboundEmail, type ParsedInboundEmail } from "@/lib/email/parse-inbound"
import { getResendClient } from "@/lib/email/resend-client"
import { PIIMasker } from "@/lib/governance/pii-masker"

export const runtime = "nodejs"

type InboundEventStatus =
  | "received"
  | "unresolved"
  | "sender_mismatch"
  | "org_scope_mismatch"

interface ResolvedConversation {
  conversationId: string
  orgId: string
  ticketId: string
  ticketOrgId: string
  ticketStatus: "open" | "pending" | "resolved" | "closed"
  customerId: string | null
  customerOrgId: string | null
  customerEmail: string | null
}

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
  resolveByReplyAddress(addresses: string[]): Promise<ResolvedConversation | null>
  resolveByStoredMessageIds(messageIds: string[]): Promise<ResolvedConversation | null>
  logEmailEvent(input: LogEmailEventInput): Promise<void>
  insertInboundMessage(parsed: ParsedInboundEmail, resolved: ResolvedConversation): Promise<void>
  rateLimit(request: Request): Promise<Response | null>
}

let ratelimit: Ratelimit | null = null

function getRatelimit() {
  if (ratelimit) return ratelimit

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }

  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(30, "60 s"),
    analytics: true,
    prefix: "advan:webhooks:resend:inbound",
  })

  return ratelimit
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

function allowUnverifiedSenderDev(): boolean {
  const enabled = process.env.ALLOW_UNVERIFIED_SENDER_DEV === "true"
  if (enabled && process.env.NODE_ENV === "production") {
    throw new Error("ALLOW_UNVERIFIED_SENDER_DEV must never be true in production")
  }
  return enabled
}

export function scrubInboundStorageContent(text: string): string {
  return PIIMasker.mask(text)
}

function validateOrgScope(resolved: ResolvedConversation): boolean {
  if (resolved.ticketOrgId !== resolved.orgId) return false
  if (resolved.customerOrgId && resolved.customerOrgId !== resolved.orgId) return false
  return true
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

  async resolveByReplyAddress(addresses) {
    const normalized = addresses.map(normalizeAddress).filter(Boolean)
    if (normalized.length === 0) return null

    const [row] = await db
      .select({
        conversationId: conversations.id,
        orgId: conversations.orgId,
        ticketId: tickets.id,
        ticketOrgId: tickets.orgId,
        ticketStatus: tickets.status,
        customerId: customers.id,
        customerOrgId: customers.orgId,
        customerEmail: customers.email,
      })
      .from(conversations)
      .innerJoin(tickets, eq(conversations.ticketId, tickets.id))
      .leftJoin(customers, eq(conversations.customerId, customers.id))
      .where(inArray(conversations.emailReplyToAddress, normalized))
      .limit(1)

    return row ?? null
  },

  async resolveByStoredMessageIds(messageIds) {
    const ids = messageIds.map(normalizeMessageId).filter(Boolean)
    if (ids.length === 0) return null

    const [row] = await db
      .select({
        conversationId: conversations.id,
        orgId: conversations.orgId,
        ticketId: tickets.id,
        ticketOrgId: tickets.orgId,
        ticketStatus: tickets.status,
        customerId: customers.id,
        customerOrgId: customers.orgId,
        customerEmail: customers.email,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .innerJoin(tickets, eq(conversations.ticketId, tickets.id))
      .leftJoin(customers, eq(conversations.customerId, customers.id))
      .where(inArray(sql<string>`${messages.metadata}->'email'->>'messageId'`, ids))
      .limit(1)

    return row ?? null
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

  async insertInboundMessage(parsed, resolved) {
    const scrubbedContent = scrubInboundStorageContent(parsed.text)

    await db.transaction(async (tx) => {
      const [message] = await tx
        .insert(messages)
        .values({
          conversationId: resolved.conversationId,
          role: "user",
          content: scrubbedContent,
          metadata: {
            email: {
              messageId: parsed.inboundMessageId ?? undefined,
              deliveryStatus: "delivered",
            },
          },
        })
        .returning()

      await tx.insert(emailEvents).values({
        orgId: resolved.orgId,
        conversationId: resolved.conversationId,
        messageId: message.id,
        direction: "inbound",
        providerId: parsed.providerId,
        status: "received",
        payload: {
          subject: parsed.subject,
          from: parsed.from,
          headers: parsed.headers,
          inboundMessageId: parsed.inboundMessageId,
        },
      })

      await tx
        .update(tickets)
        .set({
          updatedAt: new Date(),
          status: resolved.ticketStatus === "pending" ? "open" : resolved.ticketStatus,
        })
        .where(and(eq(tickets.id, resolved.ticketId), eq(tickets.orgId, resolved.orgId)))

      await tx
        .update(conversations)
        .set({
          unreadCount: sql`${conversations.unreadCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, resolved.conversationId))
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

  const allowUnverifiedSender = allowUnverifiedSenderDev()

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

  const resolved =
    (await deps.resolveByReplyAddress(parsed.recipientAddresses)) ??
    (await deps.resolveByStoredMessageIds(headerMessageIds(parsed)))

  if (!resolved) {
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

  if (!validateOrgScope(resolved)) {
    console.warn("[ResendInboundWebhook] Resolved conversation failed org scope check", {
      providerId,
      conversationId: resolved.conversationId,
      orgId: resolved.orgId,
      ticketOrgId: resolved.ticketOrgId,
      customerOrgId: resolved.customerOrgId,
    })
    await deps.logEmailEvent({
      orgId: resolved.orgId,
      conversationId: resolved.conversationId,
      providerId,
      status: "org_scope_mismatch",
      payload: { event, parsed, resolved },
    })
    return jsonOk({ orgScopeMismatch: true })
  }

  const actualSender = extractEmailAddress(parsed.from)
  const expectedSender = extractEmailAddress(resolved.customerEmail)
  if (!expectedSender || actualSender !== expectedSender) {
    if (!allowUnverifiedSender) {
      console.warn("[ResendInboundWebhook] Inbound sender mismatch", {
        providerId,
        conversationId: resolved.conversationId,
        actualSender,
        expectedSender,
      })
      await deps.logEmailEvent({
        orgId: resolved.orgId,
        conversationId: resolved.conversationId,
        providerId,
        status: "sender_mismatch",
        payload: { event, parsed, expectedSender },
      })
      return jsonOk({ senderMismatch: true })
    }

    console.warn("[ResendInboundWebhook] Allowing unverified sender in dev", {
      providerId,
      conversationId: resolved.conversationId,
      actualSender,
      expectedSender,
    })
  }

  await deps.insertInboundMessage(parsed, resolved)
  return jsonOk()
}

export function POST(req: Request): Promise<Response> {
  return handleInboundRequest(req)
}
