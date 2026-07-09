import { z } from "zod"
import { eq, and, desc, inArray, isNull, isNotNull, sql } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { protectedProcedure, router } from "../trpc"
import { conversations, messages, tickets, customers, users } from "@/lib/db/schema"
import { db } from "@/lib/db"
import { notificationQueue } from "@/lib/queue/queues"
import { insertAgentMessage } from "@/lib/conversations/insert-agent-message"

type MessageMetadata = NonNullable<typeof messages.$inferInsert.metadata>
type EmailDeliveryStatus = NonNullable<MessageMetadata["email"]>["deliveryStatus"]

const customerEmailSchema = z.string().trim().email()

function emailTicketValidationError(message: string) {
  return new TRPCError({
    code: "BAD_REQUEST",
    message,
    cause: {
      field: "customerId",
      validationCode: "EMAIL_TICKET_CUSTOMER_EMAIL_REQUIRED",
    },
  })
}

function mergeEmailMetadata(
  base: MessageMetadata | undefined,
  email: MessageMetadata["email"],
): MessageMetadata {
  return {
    ...(base ?? {}),
    email: {
      ...(base?.email ?? {}),
      ...email,
    },
  }
}

async function enqueueAgentReplyEmail(input: {
  orgId: string
  conversationId: string
  messageId: string
  jobId?: string
}) {
  await notificationQueue.add(
    "agent_reply",
    {
      type: "agent_reply",
      orgId: input.orgId,
      conversationId: input.conversationId,
      messageId: input.messageId,
    },
    { jobId: input.jobId ?? input.messageId },
  )
}

function canRetryDelivery(status: EmailDeliveryStatus | undefined): boolean {
  return status === "failed"
}

const TAG_SCHEMA = z.string().trim().min(1).max(32).regex(/^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/)

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) return []
  const seen = new Set<string>()
  for (const tag of tags) {
    const value = tag.trim().replace(/\s+/g, " ")
    if (value) seen.add(value)
  }
  return [...seen].slice(0, 8)
}

async function getWorkbenchConversation(orgId: string, id: string) {
  const [row] = await db
    .select({
      id: conversations.id,
      orgId: conversations.orgId,
      ticketId: conversations.ticketId,
      channel: conversations.channel,
      customerId: conversations.customerId,
      title: conversations.title,
      pinnedAt: conversations.pinnedAt,
      archivedAt: conversations.archivedAt,
      unreadCount: conversations.unreadCount,
      tags: conversations.tags,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
      ticketSubject: tickets.subject,
      ticketStatus: tickets.status,
      ticketPriority: tickets.priority,
      customerName: customers.name,
      customerEmail: customers.email,
      customerTier: customers.tier,
    })
    .from(conversations)
    .leftJoin(tickets, eq(conversations.ticketId, tickets.id))
    .leftJoin(customers, eq(conversations.customerId, customers.id))
    .where(and(eq(conversations.id, id), eq(conversations.orgId, orgId)))
    .limit(1)

  return row ?? null
}

export const conversationsRouter = router({
  listWorkbench: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(10).max(50).default(30),
        offset: z.number().min(0).default(0),
        archived: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select({
          id: conversations.id,
          orgId: conversations.orgId,
          ticketId: conversations.ticketId,
          channel: conversations.channel,
          customerId: conversations.customerId,
          title: conversations.title,
          pinnedAt: conversations.pinnedAt,
          archivedAt: conversations.archivedAt,
          unreadCount: conversations.unreadCount,
          tags: conversations.tags,
          createdAt: conversations.createdAt,
          updatedAt: conversations.updatedAt,
          ticketSubject: tickets.subject,
          ticketStatus: tickets.status,
          ticketPriority: tickets.priority,
          customerName: customers.name,
          customerEmail: customers.email,
          customerTier: customers.tier,
        })
        .from(conversations)
        .leftJoin(tickets, eq(conversations.ticketId, tickets.id))
        .leftJoin(customers, eq(conversations.customerId, customers.id))
        .where(
          and(
            eq(conversations.orgId, ctx.user.orgId),
            input.archived ? isNotNull(conversations.archivedAt) : isNull(conversations.archivedAt),
          )
        )
        .orderBy(
          sql`${conversations.pinnedAt} desc nulls last`,
          desc(conversations.updatedAt),
          desc(conversations.createdAt)
        )
        .limit(input.limit + 1)
        .offset(input.offset)

      const page = rows.slice(0, input.limit)
      const convIds = page.map((r) => r.id)
      const allMsgs = convIds.length
        ? await db
            .select({
              id: messages.id,
              conversationId: messages.conversationId,
              content: messages.content,
              role: messages.role,
              metadata: messages.metadata,
              createdAt: messages.createdAt,
            })
            .from(messages)
            .where(inArray(messages.conversationId, convIds))
            .orderBy(desc(messages.createdAt))
        : []

      const lastMsgMap = new Map<string, (typeof allMsgs)[0]>()
      for (const msg of allMsgs) {
        if (!lastMsgMap.has(msg.conversationId)) lastMsgMap.set(msg.conversationId, msg)
      }

      return {
        items: page.map((r) => ({ ...r, lastMessage: lastMsgMap.get(r.id) ?? null })),
        nextOffset: rows.length > input.limit ? input.offset + input.limit : null,
      }
    }),

  /**
   * List conversations enriched with ticket + customer context and last message preview.
   * Replaces the bare `select()` with a LEFT JOIN so the UI can render rich list items
   * without additional round-trips.
   */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select({
          id: conversations.id,
          orgId: conversations.orgId,
          ticketId: conversations.ticketId,
          channel: conversations.channel,
          customerId: conversations.customerId,
          createdAt: conversations.createdAt,
          ticketSubject: tickets.subject,
          ticketStatus: tickets.status,
          ticketPriority: tickets.priority,
          customerName: customers.name,
          customerEmail: customers.email,
          customerTier: customers.tier,
        })
        .from(conversations)
        .leftJoin(tickets, eq(conversations.ticketId, tickets.id))
        .leftJoin(customers, eq(conversations.customerId, customers.id))
        .where(eq(conversations.orgId, ctx.user.orgId))
        .orderBy(desc(conversations.createdAt))
        .limit(input.limit)
        .offset(input.offset)

      if (rows.length === 0) return []

      // Fetch last message per conversation in one query then map.
      // metadata is included so the conversation list can render triage
      // status badges (AI Replied, Complaint, Pending Review) without an
      // extra round-trip — and these work identically for email and chat.
      const convIds = rows.map((r) => r.id)
      const allMsgs = await db
        .select({
          conversationId: messages.conversationId,
          content: messages.content,
          role: messages.role,
          metadata: messages.metadata,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(inArray(messages.conversationId, convIds))
        .orderBy(desc(messages.createdAt))

      const lastMsgMap = new Map<string, (typeof allMsgs)[0]>()
      for (const msg of allMsgs) {
        if (!lastMsgMap.has(msg.conversationId)) {
          lastMsgMap.set(msg.conversationId, msg)
        }
      }

      return rows.map((r) => ({
        ...r,
        lastMessage: lastMsgMap.get(r.id) ?? null,
      }))
    }),

  /**
   * Fetch a single conversation by its ID (not ticket ID) together with all
   * messages and denormalised ticket + customer context for the details panel.
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select({
          id: conversations.id,
          orgId: conversations.orgId,
          ticketId: conversations.ticketId,
          channel: conversations.channel,
          customerId: conversations.customerId,
          createdAt: conversations.createdAt,
          ticketSubject: tickets.subject,
          ticketStatus: tickets.status,
          ticketPriority: tickets.priority,
          customerName: customers.name,
          customerEmail: customers.email,
          customerTier: customers.tier,
          customerCompany: customers.company,
          customerCsatAvg: customers.csatAvg,
        })
        .from(conversations)
        .leftJoin(tickets, eq(conversations.ticketId, tickets.id))
        .leftJoin(customers, eq(conversations.customerId, customers.id))
        .where(
          and(
            eq(conversations.id, input.id),
            eq(conversations.orgId, ctx.user.orgId)
          )
        )
        .limit(1)

      // Destructure so TypeScript can narrow the type with the null guard below
      const [conv] = rows
      if (!conv) return null

      const msgs = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(messages.createdAt)

      return {
        id: conv.id,
        orgId: conv.orgId,
        ticketId: conv.ticketId,
        channel: conv.channel,
        customerId: conv.customerId,
        createdAt: conv.createdAt,
        ticketSubject: conv.ticketSubject,
        ticketStatus: conv.ticketStatus,
        ticketPriority: conv.ticketPriority,
        customerName: conv.customerName,
        customerEmail: conv.customerEmail,
        customerTier: conv.customerTier,
        customerCompany: conv.customerCompany,
        customerCsatAvg: conv.customerCsatAvg,
        messages: msgs,
      }
    }),

  /**
   * Kept for backward compatibility with any existing callers.
   */
  getByTicketId: protectedProcedure
    .input(z.object({ ticketId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [conversation] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.ticketId, input.ticketId),
            eq(conversations.orgId, ctx.user.orgId)
          )
        )
        .limit(1)

      if (!conversation) return null

      const msgs = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversation.id))
        .orderBy(messages.createdAt)

      return { conversation, messages: msgs }
    }),

  /**
   * Add a message to a conversation. Supports `metadata.isInternal` to distinguish
   * agent replies (visible to customer) from internal notes (team-only).
   */
  addMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        role: z.enum(["user", "assistant", "agent"]),
        content: z.string().min(1).max(10_000),
        metadata: z
          .object({
            citations: z
              .array(
                z.object({
                  source: z.string(),
                  url: z.string().optional(),
                  confidence: z.number(),
                })
              )
              .optional(),
            confidence: z.number().optional(),
            latencyMs: z.number().optional(),
            model: z.string().optional(),
            isInternal: z.boolean().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Agent messages go through the shared insertAgentMessage helper so the
      // triage worker auto-send path uses the exact same code. Non-agent
      // messages (user, assistant) do not trigger email and are handled below.
      if (input.role === "agent") {
        try {
          const result = await insertAgentMessage({
            orgId: ctx.user.orgId,
            conversationId: input.conversationId,
            content: input.content,
            metadata: input.metadata,
          })
          return result.message
        } catch (err) {
          if ((err as Error).message.includes("not found")) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" })
          }
          throw err
        }
      }

      // user / assistant — no email side-effects
      const msg = await db.transaction(async (tx) => {
        const [row] = await tx
          .select({ id: conversations.id })
          .from(conversations)
          .where(
            and(
              eq(conversations.id, input.conversationId),
              eq(conversations.orgId, ctx.user.orgId),
            ),
          )
          .limit(1)

        if (!row) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" })
        }

        const [msg] = await tx
          .insert(messages)
          .values({
            conversationId: input.conversationId,
            role: input.role,
            content: input.content,
            metadata: input.metadata,
          })
          .returning()

        await tx
          .update(conversations)
          .set({
            updatedAt: new Date(),
            ...(input.role === "user"
              ? { unreadCount: sql`${conversations.unreadCount} + 1` }
              : {}),
          })
          .where(eq(conversations.id, input.conversationId))

        return msg
      })

      return msg
    }),

  createSupportThread: protectedProcedure
    .input(
      z.object({
        title: z.string().trim().min(1).max(180),
        initialMessage: z.string().trim().max(10_000).optional(),
        channel: z.enum(["email", "chat", "voice", "slack", "portal"]).default("portal"),
        customerId: z.string().uuid().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
        tags: z.array(TAG_SCHEMA).max(8).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.customerId) {
        const customer = await db.query.customers.findFirst({
          where: and(eq(customers.id, input.customerId), eq(customers.orgId, ctx.user.orgId)),
        })
        if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" })
        if (input.channel === "email" && !customerEmailSchema.safeParse(customer.email).success) {
          throw emailTicketValidationError("Email conversations require a customer with a valid email address.")
        }
      } else if (input.channel === "email") {
        throw emailTicketValidationError("Email conversations require a customer with a valid email address.")
      }

      const now = new Date()
      const convId = await db.transaction(async (tx) => {
        const [ticket] = await tx
          .insert(tickets)
          .values({
            orgId: ctx.user.orgId,
            subject: input.title,
            customerId: input.customerId,
            priority: input.priority,
            channel: input.channel,
          })
          .returning()

        const [conv] = await tx
          .insert(conversations)
          .values({
            orgId: ctx.user.orgId,
            ticketId: ticket.id,
            channel: input.channel,
            customerId: input.customerId,
            title: input.title,
            tags: normalizeTags(input.tags),
            unreadCount: input.initialMessage ? 1 : 0,
            updatedAt: now,
          })
          .returning()

        if (input.initialMessage) {
          await tx.insert(messages).values({
            conversationId: conv.id,
            role: "user",
            content: input.initialMessage,
            createdAt: now,
          })
        }

        return conv.id
      })

      const created = await getWorkbenchConversation(ctx.user.orgId, convId)
      if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Conversation was not created" })
      const [lastMessage] = await db
        .select({
          id: messages.id,
          conversationId: messages.conversationId,
          content: messages.content,
          role: messages.role,
          metadata: messages.metadata,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(eq(messages.conversationId, convId))
        .orderBy(desc(messages.createdAt))
        .limit(1)
      return { ...created, lastMessage: lastMessage ?? null }
    }),

  rename: protectedProcedure
    .input(z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(180) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await getWorkbenchConversation(ctx.user.orgId, input.id)
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" })

      await db.transaction(async (tx) => {
        await tx
          .update(conversations)
          .set({ title: input.title, updatedAt: new Date() })
          .where(and(eq(conversations.id, input.id), eq(conversations.orgId, ctx.user.orgId)))
        await tx
          .update(tickets)
          .set({ subject: input.title, updatedAt: new Date() })
          .where(and(eq(tickets.id, existing.ticketId), eq(tickets.orgId, ctx.user.orgId)))
      })

      const updated = await getWorkbenchConversation(ctx.user.orgId, input.id)
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" })
      return updated
    }),

  setPinned: protectedProcedure
    .input(z.object({ id: z.string().uuid(), pinned: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await db
        .update(conversations)
        .set({ pinnedAt: input.pinned ? new Date() : null, updatedAt: new Date() })
        .where(and(eq(conversations.id, input.id), eq(conversations.orgId, ctx.user.orgId)))
        .returning({ id: conversations.id })
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" })
      return getWorkbenchConversation(ctx.user.orgId, input.id)
    }),

  setArchived: protectedProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).min(1).max(100), archived: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await db
        .update(conversations)
        .set({ archivedAt: input.archived ? new Date() : null, updatedAt: new Date() })
        .where(and(inArray(conversations.id, input.ids), eq(conversations.orgId, ctx.user.orgId)))
        .returning({ id: conversations.id })
      return { ids: rows.map((r) => r.id), archived: input.archived }
    }),

  setTags: protectedProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).min(1).max(100), tags: z.array(TAG_SCHEMA).max(8) }))
    .mutation(async ({ ctx, input }) => {
      const rows = await db
        .update(conversations)
        .set({ tags: normalizeTags(input.tags), updatedAt: new Date() })
        .where(and(inArray(conversations.id, input.ids), eq(conversations.orgId, ctx.user.orgId)))
        .returning({ id: conversations.id })
      return { ids: rows.map((r) => r.id), tags: normalizeTags(input.tags) }
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await db
        .update(conversations)
        .set({ unreadCount: 0 })
        .where(and(eq(conversations.id, input.id), eq(conversations.orgId, ctx.user.orgId)))
        .returning({ id: conversations.id })
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" })
      return { id: input.id }
    }),

  deleteMany: protectedProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const rows = await db
        .delete(conversations)
        .where(and(inArray(conversations.id, input.ids), eq(conversations.orgId, ctx.user.orgId)))
        .returning({ id: conversations.id })
      return { ids: rows.map((r) => r.id) }
    }),

  retryAgentReply: protectedProcedure
    .input(z.object({ messageId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await db
        .select({
          message: messages,
          conversationId: conversations.id,
          channel: conversations.channel,
          customerEmail: customers.email,
        })
        .from(messages)
        .innerJoin(conversations, eq(messages.conversationId, conversations.id))
        .leftJoin(customers, eq(conversations.customerId, customers.id))
        .where(
          and(
            eq(messages.id, input.messageId),
            eq(conversations.orgId, ctx.user.orgId),
          ),
        )
        .limit(1)

      const row = rows[0]
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" })
      }

      if (
        row.channel !== "email" ||
        row.message.role !== "agent" ||
        row.message.metadata?.isInternal
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only customer-facing email replies can be retried.",
        })
      }

      if (!canRetryDelivery(row.message.metadata?.email?.deliveryStatus)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only failed email replies can be retried.",
        })
      }

      if (!row.customerEmail?.trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot retry because the customer has no email address.",
        })
      }

      const { error: _oldError, ...currentEmail } = row.message.metadata?.email ?? {}
      await db
        .update(messages)
        .set({
          metadata: {
            ...(row.message.metadata ?? {}),
            email: {
              ...currentEmail,
              deliveryStatus: "queued",
            },
          },
        })
        .where(eq(messages.id, input.messageId))

      await enqueueAgentReplyEmail({
        orgId: ctx.user.orgId,
        conversationId: row.conversationId,
        messageId: input.messageId,
        jobId: `${input.messageId}:retry:${Date.now()}`,
      })

      return { ok: true }
    }),

  // ── Agent chat availability ─────────────────────────────────────────────────

  /**
   * Returns the current agent's chat availability toggle value.
   * Used by the dashboard topbar to render and initialise the toggle.
   */
  getAgentChatStatus: protectedProcedure.query(async ({ ctx }) => {
    const row = await db.query.users.findFirst({
      where: eq(users.id, ctx.user.id),
      columns: { chatAvailable: true },
    })
    return { chatAvailable: row?.chatAvailable ?? true }
  }),

  /**
   * Toggle the current agent's chat availability.
   * When set to false the agent is excluded from the org availability check
   * even while their socket session is connected.
   */
  setAgentChatAvailable: protectedProcedure
    .input(z.object({ available: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(users)
        .set({ chatAvailable: input.available })
        .where(eq(users.id, ctx.user.id))
      return { chatAvailable: input.available }
    }),

  /**
   * Create a new conversation for a ticket. Verifies ticket ownership before insert.
   */
  create: protectedProcedure
    .input(
      z.object({
        ticketId: z.string().uuid(),
        channel: z
          .enum(["email", "chat", "voice", "slack", "portal"])
          .default("chat"),
        customerId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [ticket] = await db
        .select()
        .from(tickets)
        .where(
          and(
            eq(tickets.id, input.ticketId),
            eq(tickets.orgId, ctx.user.orgId)
          )
        )
        .limit(1)

      if (!ticket) throw new Error("Ticket not found")

      const [conv] = await db
        .insert(conversations)
        .values({ ...input, orgId: ctx.user.orgId })
        .returning()

      return conv
    }),
})
