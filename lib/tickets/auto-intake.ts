import { and, desc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { conversations, customers, messages, tickets } from "@/lib/db/schema"
import {
  findCustomerForIntake,
  normalizeCustomerEmail,
  type CustomerIdentifier,
} from "@/lib/api/routers/customers"
import { copilotTriageQueue } from "@/lib/queue/queues"
import { publishCustomerMessage } from "@/lib/realtime/event-bus"
import { buildChatTicketSubject } from "@/lib/chat/ticket-subject"
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
  /**
   * Forces creation of a new ticket+conversation instead of reusing an
   * existing open thread. Used by explicit widget session creation.
   */
  forceNew?: boolean
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

export interface CreateChatSessionInput {
  orgId: string
  customerIdentifier: CustomerIdentifier
  displayName: string
  subject?: string
  chatOfflineDelivery?: boolean
}

export interface CreateChatSessionResult {
  ticketId: string
  conversationId: string
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

  const visitorIdentifier = input.customerIdentifier.visitorId
  const emailIdentifier = input.customerIdentifier.email

  if (typeof visitorIdentifier === "string") {
    const visitorId = visitorIdentifier.trim()
    if (!visitorId) return null

    // When both visitorId AND email are provided (pre-chat form offline path),
    // create a customer with both fields so email-based delivery can work.
    const email =
      typeof emailIdentifier === "string" ? normalizeCustomerEmail(emailIdentifier) : ""
    const providedName = input.customerName?.trim() || null
    const placeholderName = `Visitor ${visitorId.slice(0, 8)}`
    const resolvedName = providedName ?? placeholderName

    // ON CONFLICT: the partial unique index on (org_id, visitor_session_id)
    // prevents duplicate visitor rows. When the conflict fires (race or returning
    // visitor), we fetch and optionally upgrade the email if it was empty before.
    const [inserted] = await db
      .insert(customers)
      .values({
        orgId: input.orgId,
        email,
        // Compatibility: customers table still uses visitor_session_id.
        visitorSessionId: visitorId,
        name: resolvedName,
      })
      .onConflictDoNothing()
      .returning()

    if (inserted) return inserted

    // Another concurrent call won the race — fetch the existing row.
    const existing = await db.query.customers.findFirst({
      where: and(
        eq(customers.orgId, input.orgId),
        eq(customers.visitorSessionId, visitorId),
      ),
    })

    if (!existing) return null

    const shouldUpgradeEmail = Boolean(email && existing.email === "")
    const existingName = existing.name?.trim() || ""
    const shouldUpgradeName =
      Boolean(providedName) &&
      (existingName.length === 0 ||
        existingName === placeholderName ||
        existingName.startsWith("Visitor "))

    if (shouldUpgradeEmail || shouldUpgradeName) {
      const [upgraded] = await db
        .update(customers)
        .set({
          ...(shouldUpgradeEmail ? { email } : {}),
          ...(shouldUpgradeName ? { name: providedName! } : {}),
        })
        .where(eq(customers.id, existing.id))
        .returning()
      return upgraded ?? existing
    }

    return existing
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
        const [ticketRow] = await tx
          .select({ status: tickets.status })
          .from(tickets)
          .where(and(eq(tickets.id, target.ticketId), eq(tickets.orgId, input.orgId)))
          .limit(1)

        const shouldReopen =
          input.channel === "chat" &&
          (ticketRow?.status === "resolved" || ticketRow?.status === "closed")

        await tx
          .update(conversations)
          .set({ unreadCount: sql`${conversations.unreadCount} + 1`, updatedAt: new Date() })
          .where(eq(conversations.id, target.id))
        await tx
          .update(tickets)
          .set({
            updatedAt: new Date(),
            ...(shouldReopen ? { status: "open" as const } : {}),
          })
          .where(and(eq(tickets.id, target.ticketId), eq(tickets.orgId, input.orgId)))
        const [message] = await tx
          .insert(messages)
          .values({ conversationId: target.id, role: "user", content: input.content, metadata: input.metadata })
          .returning()
        return { ticketId: target.ticketId, conversationId: target.id, messageId: message.id, isNewTicket: false }
      }
      // conversationId was invalid / wrong org — fall through to heuristic
    }

    // Chat sessions are explicit. Do not implicitly reuse an open chat
    // conversation by visitor identity when conversationId is absent.
    const shouldReuseOpenConversation = !input.forceNew && input.channel !== "chat"

    const existingRows = customer && shouldReuseOpenConversation
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
          // For chat: stamp persistent visitor identity on the conversation.
          // visitor_session_id is kept for backward compatibility with legacy
          // reconnect paths still reading that column.
          visitorId:
            input.channel === "chat" && input.customerIdentifier.visitorId
              ? input.customerIdentifier.visitorId
              : undefined,
          visitorSessionId:
            input.channel === "chat" && input.customerIdentifier.visitorId
              ? input.customerIdentifier.visitorId
              : undefined,
          customerDisplayName:
            input.channel === "chat" ? (input.customerName ?? customer?.name ?? null) : null,
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

  // Notify dashboard agents (toast + conversations floating alert) via Redis →
  // Socket.IO. Covers HTTP chat session create, socket visitor:message, and email.
  try {
    await publishCustomerMessage(input.orgId, {
      conversationId: result.conversationId,
      messageId: result.messageId,
      channel: input.channel,
      content: input.content,
      customerName: input.customerName ?? customer?.name ?? null,
      customerEmail: customer?.email && customer.email.length > 0 ? customer.email : null,
    })
  } catch (err) {
    console.warn("[auto-intake] Failed to publish customer message:", (err as Error).message)
  }

  return result
}

export async function createChatSession(
  input: CreateChatSessionInput,
): Promise<CreateChatSessionResult> {
  const customer = await resolveOrCreateCustomer({
    orgId: input.orgId,
    customerIdentifier: input.customerIdentifier,
    customerName: input.displayName,
  })

  const subject = input.subject?.trim() || buildChatTicketSubject({ displayName: input.displayName })

  const result = await db.transaction(async (tx) => {
    const [ticket] = await tx
      .insert(tickets)
      .values({
        orgId: input.orgId,
        customerId: customer?.id,
        subject,
        channel: "chat",
      })
      .returning()

    const visitorId = input.customerIdentifier.visitorId

    const [conversation] = await tx
      .insert(conversations)
      .values({
        orgId: input.orgId,
        ticketId: ticket.id,
        channel: "chat",
        customerId: customer?.id,
        title: subject,
        unreadCount: 0,
        updatedAt: new Date(),
        visitorId,
        // Compatibility with legacy reconnect code paths.
        visitorSessionId: visitorId,
        customerDisplayName: input.displayName,
        chatOfflineDelivery: input.chatOfflineDelivery ?? false,
      })
      .returning()

    if (customer) {
      await tx
        .update(customers)
        .set({ totalTickets: sql`${customers.totalTickets} + 1` })
        .where(eq(customers.id, customer.id))
    }

    return { ticketId: ticket.id, conversationId: conversation.id }
  })

  // Name-only chat start (no first message yet) — still alert the dashboard.
  try {
    await publishCustomerMessage(input.orgId, {
      conversationId: result.conversationId,
      messageId: result.conversationId, // synthetic id; no message row yet
      channel: "chat",
      content: `${input.displayName} started a chat`,
      customerName: input.displayName,
      customerEmail: customer?.email && customer.email.length > 0 ? customer.email : null,
    })
  } catch (err) {
    console.warn("[createChatSession] Failed to publish new-chat alert:", (err as Error).message)
  }

  return result
}
