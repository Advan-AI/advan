import { z } from "zod"
import { eq, and, desc } from "drizzle-orm"
import { protectedProcedure, router } from "../trpc"
import { conversations, messages, tickets } from "@/lib/db/schema"
import { db } from "@/lib/db"

export const conversationsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select()
        .from(conversations)
        .where(eq(conversations.orgId, ctx.user.orgId))
        .orderBy(desc(conversations.createdAt))
        .limit(input.limit)
        .offset(input.offset)

      return rows
    }),

  getByTicketId: protectedProcedure
    .input(z.object({ ticketId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const conversation = await db.query.conversations.findFirst({
        where: and(
          eq(conversations.ticketId, input.ticketId),
          eq(conversations.orgId, ctx.user.orgId)
        ),
      })
      if (!conversation) return null

      const msgs = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversation.id))
        .orderBy(messages.createdAt)

      return { conversation, messages: msgs }
    }),

  addMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        role: z.enum(["user", "assistant", "agent"]),
        content: z.string().min(1),
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
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the conversation belongs to this org
      const conv = await db.query.conversations.findFirst({
        where: and(
          eq(conversations.id, input.conversationId),
          eq(conversations.orgId, ctx.user.orgId)
        ),
      })
      if (!conv) throw new Error("Conversation not found")

      const [msg] = await db.insert(messages).values(input).returning()
      return msg
    }),

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
      // Verify ticket belongs to org
      const ticket = await db.query.tickets.findFirst({
        where: and(
          eq(tickets.id, input.ticketId),
          eq(tickets.orgId, ctx.user.orgId)
        ),
      })
      if (!ticket) throw new Error("Ticket not found")

      const [conv] = await db
        .insert(conversations)
        .values({ ...input, orgId: ctx.user.orgId })
        .returning()
      return conv
    }),
})
