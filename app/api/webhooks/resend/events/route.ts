import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import type {
  EmailBouncedEvent,
  EmailComplainedEvent,
  EmailDeliveredEvent,
  EmailDeliveryDelayedEvent,
  WebhookEventPayload,
} from "resend"
import { Webhook, type WebhookRequiredHeaders } from "svix"
import { db } from "@/lib/db"
import { conversations, customers, emailEvents, messages } from "@/lib/db/schema"
import { normalizeEmailAddress, suppressEmail, type SuppressionReason } from "@/lib/email/suppression"

export const runtime = "nodejs"

type ResendDeliveryEvent =
  | EmailDeliveredEvent
  | EmailBouncedEvent
  | EmailComplainedEvent
  | EmailDeliveryDelayedEvent

type DeliveryStatus = NonNullable<
  NonNullable<typeof messages.$inferSelect.metadata>["email"]
>["deliveryStatus"]

interface ResolvedOutboundEmail {
  orgId: string
  conversationId: string
  messageId: string
  customerEmail: string | null
  metadata: typeof messages.$inferSelect.metadata
}

interface LogEventInput {
  eventKey: string
  status: ResendDeliveryEvent["type"]
  resolved: ResolvedOutboundEmail
  payload: Record<string, unknown>
}

export interface ResendEventsDeps {
  verifyWebhook(payload: string, headers: WebhookRequiredHeaders): WebhookEventPayload
  findExistingEvent(eventKey: string): Promise<unknown | null>
  resolveOutboundByResendId(resendId: string): Promise<ResolvedOutboundEmail | null>
  updateMessageDelivery(
    resolved: ResolvedOutboundEmail,
    status: DeliveryStatus,
    error?: string,
  ): Promise<void>
  logEmailEvent(input: LogEventInput): Promise<void>
  suppressRecipient(input: { orgId: string; email: string; reason: SuppressionReason }): Promise<void>
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

function verifyWithSvix(payload: string, headers: WebhookRequiredHeaders): WebhookEventPayload {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim()
  if (!secret) {
    throw new Error("RESEND_WEBHOOK_SECRET is not configured")
  }

  return new Webhook(secret).verify(payload, headers) as WebhookEventPayload
}

function isHandledEvent(event: WebhookEventPayload): event is ResendDeliveryEvent {
  return (
    event.type === "email.delivered" ||
    event.type === "email.bounced" ||
    event.type === "email.complained" ||
    event.type === "email.delivery_delayed"
  )
}

function isHardBounce(event: EmailBouncedEvent): boolean {
  const type = event.data.bounce.type.toLowerCase()
  const subType = event.data.bounce.subType.toLowerCase()
  return type === "hard" || subType.includes("hard")
}

function deliveryStatusFor(event: ResendDeliveryEvent): DeliveryStatus {
  if (event.type === "email.delivered") return "delivered"
  if (event.type === "email.delivery_delayed") return "queued"
  if (event.type === "email.complained") return "suppressed"
  return "bounced"
}

function deliveryErrorFor(event: ResendDeliveryEvent): string | undefined {
  if (event.type === "email.delivery_delayed") return "Delivery delayed by recipient server"
  if (event.type === "email.complained") return "Recipient complained; address suppressed"
  if (event.type === "email.bounced") return event.data.bounce.message || "Email bounced"
  return undefined
}

function recipientEmailFor(event: ResendDeliveryEvent, resolved: ResolvedOutboundEmail): string {
  return normalizeEmailAddress(resolved.customerEmail ?? event.data.to[0] ?? "")
}

export const productionDeps: ResendEventsDeps = {
  verifyWebhook: verifyWithSvix,

  findExistingEvent(eventKey) {
    return db.query.emailEvents.findFirst({
      where: and(
        eq(emailEvents.direction, "outbound"),
        eq(emailEvents.providerId, eventKey),
      ),
    })
  },

  async resolveOutboundByResendId(resendId) {
    const [row] = await db
      .select({
        orgId: emailEvents.orgId,
        conversationId: emailEvents.conversationId,
        messageId: emailEvents.messageId,
        customerEmail: customers.email,
        metadata: messages.metadata,
      })
      .from(emailEvents)
      .innerJoin(messages, eq(emailEvents.messageId, messages.id))
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .leftJoin(customers, eq(conversations.customerId, customers.id))
      .where(
        and(
          eq(emailEvents.direction, "outbound"),
          eq(emailEvents.providerId, resendId),
          eq(emailEvents.status, "sent"),
        ),
      )
      .limit(1)

    if (!row?.orgId || !row.conversationId || !row.messageId) return null
    return {
      orgId: row.orgId,
      conversationId: row.conversationId,
      messageId: row.messageId,
      customerEmail: row.customerEmail,
      metadata: row.metadata,
    }
  },

  async updateMessageDelivery(resolved, status, error) {
    await db
      .update(messages)
      .set({
        metadata: {
          ...(resolved.metadata ?? {}),
          email: {
            ...(resolved.metadata?.email ?? {}),
            deliveryStatus: status,
            ...(error ? { error } : {}),
          },
        },
      })
      .where(eq(messages.id, resolved.messageId))
  },

  async logEmailEvent(input) {
    await db
      .insert(emailEvents)
      .values({
        orgId: input.resolved.orgId,
        conversationId: input.resolved.conversationId,
        messageId: input.resolved.messageId,
        direction: "outbound",
        providerId: input.eventKey,
        status: input.status,
        payload: input.payload,
      })
      .onConflictDoNothing()
  },

  suppressRecipient: suppressEmail,
}

export async function handleResendEventRequest(
  req: Request,
  deps: ResendEventsDeps = productionDeps,
): Promise<Response> {
  const headers = webhookHeaders(req)
  if (!headers) {
    console.warn("[ResendEventsWebhook] Missing Svix headers")
    return jsonError("Missing webhook signature headers", 401)
  }

  const payload = await req.text()
  let event: WebhookEventPayload
  try {
    event = deps.verifyWebhook(payload, headers)
  } catch (err) {
    console.warn("[ResendEventsWebhook] Svix verification failed", {
      error: err instanceof Error ? err.message : String(err),
      svixId: headers["svix-id"],
    })
    return jsonError("Invalid webhook signature", 401)
  }

  if (!isHandledEvent(event)) return jsonOk({ ignored: true })

  const resendId = event.data.email_id?.trim()
  if (!resendId) return jsonError("Missing email_id", 400)

  const eventKey = `${resendId}:${event.type}`
  const existing = await deps.findExistingEvent(eventKey)
  if (existing) return jsonOk({ duplicate: true })

  const resolved = await deps.resolveOutboundByResendId(resendId)
  if (!resolved) {
    console.warn("[ResendEventsWebhook] Could not resolve outbound email event", {
      resendId,
      eventType: event.type,
    })
    return jsonOk({ unresolved: true })
  }

  const status = deliveryStatusFor(event)
  const error = deliveryErrorFor(event)
  await deps.updateMessageDelivery(resolved, status, error)

  if (event.type === "email.complained") {
    const email = recipientEmailFor(event, resolved)
    if (email) await deps.suppressRecipient({ orgId: resolved.orgId, email, reason: "complaint" })
  } else if (event.type === "email.bounced" && isHardBounce(event)) {
    const email = recipientEmailFor(event, resolved)
    if (email) await deps.suppressRecipient({ orgId: resolved.orgId, email, reason: "bounce" })
  }

  await deps.logEmailEvent({
    eventKey,
    status: event.type,
    resolved,
    payload: { event },
  })

  return jsonOk()
}

export function POST(req: Request): Promise<Response> {
  return handleResendEventRequest(req)
}
