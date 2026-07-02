import { z } from "zod"
import { eq, and, desc, inArray } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { protectedProcedure, router } from "../trpc"
import { conversations, messages, tickets, customers } from "@/lib/db/schema"
import { db } from "@/lib/db"
import { notificationQueue } from "@/lib/queue/queues"

type MessageMetadata = NonNullable<typeof messages.$inferInsert.metadata>

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

export const conversationsRouter = router({
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

      // Fetch last message per conversation in one query then map
      const convIds = rows.map((r) => r.id)
      const allMsgs = await db
        .select({
          conversationId: messages.conversationId,
          content: messages.content,
          role: messages.role,
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
      const enqueueEmail =
        await db.transaction(async (tx) => {
          const [row] = await tx
            .select({
              conversationId: conversations.id,
              channel: conversations.channel,
              ticketSubject: tickets.subject,
              customerEmail: customers.email,
            })
            .from(conversations)
            .innerJoin(tickets, eq(conversations.ticketId, tickets.id))
            .leftJoin(customers, eq(conversations.customerId, customers.id))
            .where(
              and(
                eq(conversations.id, input.conversationId),
                eq(conversations.orgId, ctx.user.orgId),
              ),
            )
            .limit(1)

          if (!row) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Conversation not found",
            })
          }

          const shouldSendEmail =
            row.channel === "email" &&
            input.role === "agent" &&
            !input.metadata?.isInternal

          let metadata: MessageMetadata | undefined = input.metadata

          if (shouldSendEmail) {
            const customerEmail = row.customerEmail?.trim()
            if (!customerEmail) {
              metadata = mergeEmailMetadata(metadata, {
                deliveryStatus: "failed",
                error: "No customer email on file",
              })
            } else {
              metadata = mergeEmailMetadata(metadata, {
                deliveryStatus: "queued",
              })
            }
          }

          const [msg] = await tx
            .insert(messages)
            .values({
              conversationId: input.conversationId,
              role: input.role,
              content: input.content,
              metadata,
            })
            .returning()

          const shouldEnqueue = shouldSendEmail && Boolean(row.customerEmail?.trim())

          return { msg, shouldEnqueue }
        })

      if (enqueueEmail.shouldEnqueue) {
        await notificationQueue.add(
          "agent_reply",
          {
            type: "agent_reply",
            orgId: ctx.user.orgId,
            conversationId: input.conversationId,
            messageId: enqueueEmail.msg.id,
          },
          { jobId: enqueueEmail.msg.id },
        )
      }

      return enqueueEmail.msg
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
