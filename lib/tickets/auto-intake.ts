import { and, desc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { conversations, customers, messages, tickets } from "@/lib/db/schema"
import {
  findCustomerForIntake,
  normalizeCustomerEmail,
  type CustomerIdentifier,
} from "@/lib/api/routers/customers"
import { copilotTriageQueue } from "@/lib/queue/queues"
import { buildReplyToAddress } from "@/lib/email/threading"

/** Safe wrapper — returns undefined if email feature is not configured. */
function tryBuildReplyToAddress(conversationId: string): string | undefined {
  try {
    return buildReplyToAddress(conversationId)
  } catch {
    return undefined
  }
}

type Channel = NonNullable<typeof tickets.$inferInsert.channel>
type MessageMetadata = typeof messages.$inferInsert.metadata

export interface ResolveOrCreateIntakeInput {
  orgId: string
  channel: Channel
  customerIdentifier: CustomerIdentifier
  content: string
  /** Optional subject line (e.g. email subject). Falls back to first line of content. */
  subject?: string
  /**
   * When present, the reply is threaded directly into this specific conversation
   * instead of using the open-ticket heuristic. Derived from the reply+ plus-address
   * in the inbound To header. The conversation must belong to the given orgId or the
   * field is ignored and the heuristic runs as fallback.
   */
  conversationId?: string
  metadata?: MessageMetadata
  /**
   * Visitor's display name, collected from the pre-chat form.
   * Stored on the customer row when creating a new anonymous visitor customer.
   */
  customerName?: string
  /**
   * When true, marks the new chat conversation for email-based delivery.
   * Set by POST /api/chat/intake when no agent is online and the visitor
   * provided their email via the pre-chat form.
   *
   * Only applies when channel="chat" and a new conversation is created.
   * Has no effect when threading into an existing conversation.
   */
  chatOfflineDelivery?: boolean
}

export interface ResolveOrCreateIntakeResult {
  ticketId: string
  conversationId: string
  messageId: string
  isNewTicket: boolean
}

function subjectFromContent(content: string): string {
  const firstLine = content.trim().split(/\r?\n/, 1)[0]?.trim()
  if (!firstLine) return "New customer message"
  return firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine
}

async function resolveOrCreateCustomer(input: {
  orgId: string
  customerIdentifier: CustomerIdentifier
  customerName?: string
}) {
  const existing = await findCustomerForIntake(input)
  if (existing) return existing

  const visitorIdentifier = input.customerIdentifier.visitorSessionId
  const emailIdentifier = input.customerIdentifier.email

  if (typeof visitorIdentifier === "string") {
    const visitorSessionId = visitorIdentifier.trim()
    if (!visitorSessionId) return null

    // When both visitorSessionId AND email are provided (pre-chat form offline path),
    // create a customer with both fields so email-based delivery can work.
    const email =
      typeof emailIdentifier === "string" ? normalizeCustomerEmail(emailIdentifier) : ""

    // ON CONFLICT: the partial unique index on (org_id, visitor_session_id)
    // prevents duplicate visitor rows. When the conflict fires (race or returning
    // visitor), we fetch and optionally upgrade the email if it was empty before.
    const [inserted] = await db
      .insert(customers)
      .values({
        orgId: input.orgId,
        email,
        visitorSessionId,
        name: email
          ? input.customerName ?? `Visitor ${visitorSessionId.slice(0, 8)}`
          : `Visitor ${visitorSessionId.slice(0, 8)}`,
      })
      .onConflictDoNothing()
      .returning()

    if (inserted) return inserted

    // Another concurrent call won the race — fetch the existing row.
    const existing = await db.query.customers.findFirst({
      where: and(
        eq(customers.orgId, input.orgId),
        eq(customers.visitorSessionId, visitorSessionId),
      ),
    })

    // Upgrade: visitor originally connected anonymously (email="") and then
    // submitted the pre-chat form.  Update with the provided email + name.
    if (existing && email && existing.email === "") {
      const [upgraded] = await db
        .update(customers)
        .set({ email, name: input.customerName ?? existing.name ?? `Visitor ${visitorSessionId.slice(0, 8)}` })
        .where(eq(customers.id, existing.id))
        .returning()
      return upgraded ?? existing
    }

    return existing ?? null
  }

  if (typeof emailIdentifier !== "string") return null

  const email = normalizeCustomerEmail(emailIdentifier)
  if (!email) return null

  const [customer] = await db
    .insert(customers)
    .values({
      orgId: input.orgId,
      email,
      name: input.customerName,
    })
    .returning()
  return customer
}

export async function resolveOrCreateIntake(
  input: ResolveOrCreateIntakeInput,
): Promise<ResolveOrCreateIntakeResult> {
  const customer = await resolveOrCreateCustomer({
    orgId: input.orgId,
    customerIdentifier: input.customerIdentifier,
    customerName: input.customerName,
  })

  const result = await db.transaction(async (tx) => {
    // Fast path: conversationId is known from the reply+ plus-address.
    // Thread the message directly without the open-ticket heuristic so it always
    // lands in the exact conversation the customer replied to.
    if (input.conversationId) {
      const target = await tx.query.conversations.findFirst({
        where: and(
          eq(conversations.id, input.conversationId),
          eq(conversations.orgId, input.orgId),
        ),
      })
      if (target) {
        await tx
          .update(conversations)
          .set({ unreadCount: sql`${conversations.unreadCount} + 1`, updatedAt: new Date() })
          .where(eq(conversations.id, target.id))
        await tx
          .update(tickets)
          .set({ updatedAt: new Date() })
          .where(and(eq(tickets.id, target.ticketId), eq(tickets.orgId, input.orgId)))
        const [message] = await tx
          .insert(messages)
          .values({ conversationId: target.id, role: "user", content: input.content, metadata: input.metadata })
          .returning()
        return { ticketId: target.ticketId, conversationId: target.id, messageId: message.id, isNewTicket: false }
      }
      // conversationId was invalid / wrong org — fall through to heuristic
    }

    const existingRows = customer
      ? await tx
          .select({
            ticketId: tickets.id,
            conversationId: conversations.id,
          })
          .from(tickets)
          .innerJoin(conversations, eq(conversations.ticketId, tickets.id))
          .where(
            and(
              eq(tickets.orgId, input.orgId),
              eq(tickets.customerId, customer.id),
              eq(tickets.channel, input.channel),
              eq(tickets.status, "open"),
              eq(conversations.orgId, input.orgId),
              eq(conversations.channel, input.channel),
              eq(conversations.customerId, customer.id),
            ),
          )
          .orderBy(desc(conversations.updatedAt))
          .limit(1)
      : []

    let ticketId = existingRows[0]?.ticketId
    let conversationId = existingRows[0]?.conversationId
    let isNewTicket = false

    if (!ticketId || !conversationId) {
      const [ticket] = await tx
        .insert(tickets)
        .values({
          orgId: input.orgId,
          customerId: customer?.id,
          subject: input.subject?.trim() || subjectFromContent(input.content),
          channel: input.channel,
        })
        .returning()

      const [conversation] = await tx
        .insert(conversations)
        .values({
          orgId: input.orgId,
          ticketId: ticket.id,
          channel: input.channel,
          customerId: customer?.id,
          title: ticket.subject,
          unreadCount: 1,
          updatedAt: new Date(),
          // For chat: stamp the session id so the socket namespace can resolve
          // the conversationId on reconnect via visitorSessionId lookup.
          visitorSessionId:
            input.channel === "chat" && input.customerIdentifier.visitorSessionId
              ? input.customerIdentifier.visitorSessionId
              : undefined,
          // When true, insertAgentMessage will route replies through
          // notificationQueue (email) rather than the Socket.IO event bus.
          // Only meaningful for chat; no-op for other channels.
          chatOfflineDelivery:
            input.channel === "chat" ? (input.chatOfflineDelivery ?? false) : false,
        })
        .returning()

      // Pre-set the reply+ address so that a second customer email (sent before
      // any agent outbound goes out) threads into this conversation rather than
      // creating a duplicate ticket.
      if (input.channel === "email") {
        const replyToAddress = tryBuildReplyToAddress(conversation.id)
        if (replyToAddress) {
          await tx
            .update(conversations)
            .set({ emailReplyToAddress: replyToAddress })
            .where(eq(conversations.id, conversation.id))
        }
      }

      if (customer) {
        await tx
          .update(customers)
          .set({ totalTickets: sql`${customers.totalTickets} + 1` })
          .where(eq(customers.id, customer.id))
      }

      ticketId = ticket.id
      conversationId = conversation.id
      isNewTicket = true
    } else {
      await tx
        .update(conversations)
        .set({
          unreadCount: sql`${conversations.unreadCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversationId))

      await tx
        .update(tickets)
        .set({ updatedAt: new Date() })
        .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, input.orgId)))
    }

    const [message] = await tx
      .insert(messages)
      .values({
        conversationId,
        role: "user",
        content: input.content,
        metadata: input.metadata,
      })
      .returning()

    return {
      ticketId,
      conversationId,
      messageId: message.id,
      isNewTicket,
    }
  })

  // Enqueue triage for every inbound customer message on every channel.
  // Runs outside the transaction so we never hold a DB lock open while
  // waiting for a Redis round-trip.
  try {
    const triageJobId = `triage-${result.messageId}`
    await copilotTriageQueue.add(
      triageJobId,
      {
        orgId: input.orgId,
        ticketId: result.ticketId,
        conversationId: result.conversationId,
        messageId: result.messageId,
      },
      { jobId: triageJobId }
    )
  } catch (err) {
    // Non-fatal: log and continue. The intake must succeed even if Redis is
    // temporarily unavailable. The Tap Box "no triage decision" state is
    // surfaced in the UI and can be retried manually.
    console.warn("[auto-intake] Failed to enqueue triage job:", (err as Error).message)
  }

  return result
}
