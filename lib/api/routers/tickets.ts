import { z } from "zod"
import { eq, and, desc, count, inArray } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { protectedProcedure, permissionedProcedure, router } from "../trpc"
import { tickets, customers, users, conversations } from "@/lib/db/schema"
import { db } from "@/lib/db"
import { resolveDashboardCustomerName } from "@/lib/chat/customer-display-name"

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

export const ticketsRouter = router({
  list: permissionedProcedure("tickets.read")
    .input(
      z.object({
        status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        limit: z.number().min(1).max(100).default(25),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(tickets.orgId, ctx.user.orgId)]
      if (input.status) conditions.push(eq(tickets.status, input.status))
      if (input.priority) conditions.push(eq(tickets.priority, input.priority))

      const rows = await db
        .select({
          ticket: tickets,
          chatDisplayName: conversations.customerDisplayName,
          customer: {
            id: customers.id,
            name: customers.name,
            email: customers.email,
            tier: customers.tier,
          },
        })
        .from(tickets)
        .leftJoin(customers, eq(tickets.customerId, customers.id))
        .leftJoin(conversations, eq(tickets.id, conversations.ticketId))
        .where(and(...conditions))
        .orderBy(desc(tickets.updatedAt))
        .limit(input.limit)
        .offset(input.offset)

      const [{ value: total }] = await db
        .select({ value: count() })
        .from(tickets)
        .where(and(...conditions))

      return {
        tickets: rows.map((row) => ({
          ...row,
          customerName: resolveDashboardCustomerName({
            channel: row.ticket.channel,
            customerDisplayName: row.chatDisplayName,
            customerName: row.customer?.name,
          }),
        })),
        total,
      }
    }),

  getById: permissionedProcedure("tickets.read")
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await db.query.tickets.findFirst({
        where: and(eq(tickets.id, input.id), eq(tickets.orgId, ctx.user.orgId)),
      })
      if (!row) throw new Error("Ticket not found")
      return row
    }),

  create: permissionedProcedure("tickets.write")
    .input(
      z.object({
        subject: z.string().min(1).max(255),
        customerId: z.string().uuid().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
        channel: z.enum(["email", "chat", "voice", "slack", "portal"]).default("email"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.channel === "email") {
        if (!input.customerId) {
          throw emailTicketValidationError(
            "Email tickets require a customer with a valid email address.",
          )
        }

        const customer = await db.query.customers.findFirst({
          where: and(
            eq(customers.id, input.customerId),
            eq(customers.orgId, ctx.user.orgId),
          ),
        })

        if (!customer || !customerEmailSchema.safeParse(customer.email).success) {
          throw emailTicketValidationError(
            "Email tickets require a customer with a valid email address.",
          )
        }
      }

      return db.transaction(async (tx) => {
        const [ticket] = await tx
          .insert(tickets)
          .values({ ...input, orgId: ctx.user.orgId })
          .returning()

        // Every ticket gets an inbox thread so "View" from the queue always resolves.
        await tx.insert(conversations).values({
          orgId: ctx.user.orgId,
          ticketId: ticket.id,
          channel: input.channel,
          customerId: input.customerId,
        })

        return ticket
      })
    }),

  updateStatus: permissionedProcedure("tickets.write")
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["open", "pending", "resolved", "closed"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [ticket] = await db
        .update(tickets)
        .set({ status: input.status, updatedAt: new Date() })
        .where(and(eq(tickets.id, input.id), eq(tickets.orgId, ctx.user.orgId)))
        .returning()
      if (!ticket) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found" })
      }
      return ticket
    }),

  assignTo: permissionedProcedure("tickets.write")
    .input(
      z.object({
        id: z.string().uuid(),
        agentId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [ticket] = await db
        .update(tickets)
        .set({ assignedTo: input.agentId, updatedAt: new Date() })
        .where(and(eq(tickets.id, input.id), eq(tickets.orgId, ctx.user.orgId)))
        .returning()
      if (!ticket) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found" })
      }
      return ticket
    }),

  bulkUpdateStatus: permissionedProcedure("tickets.write")
    .input(
      z.object({
        ids: z.array(z.string().uuid()).min(1).max(100),
        status: z.enum(["open", "pending", "resolved", "closed"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await db
        .update(tickets)
        .set({ status: input.status, updatedAt: new Date() })
        .where(
          and(
            inArray(tickets.id, input.ids),
            eq(tickets.orgId, ctx.user.orgId)
          )
        )
        .returning()
      if (updated.length !== input.ids.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "One or more tickets not found",
        })
      }
      return updated
    }),

  kpis: permissionedProcedure("tickets.read").query(async ({ ctx }) => {
    const orgId = ctx.user.orgId

    const [openCount] = await db
      .select({ value: count() })
      .from(tickets)
      .where(and(eq(tickets.orgId, orgId), eq(tickets.status, "open")))

    const [resolvedCount] = await db
      .select({ value: count() })
      .from(tickets)
      .where(and(eq(tickets.orgId, orgId), eq(tickets.status, "resolved")))

    const [aiResolvedCount] = await db
      .select({ value: count() })
      .from(tickets)
      .where(and(eq(tickets.orgId, orgId), eq(tickets.aiResolved, true)))

    const [totalCount] = await db
      .select({ value: count() })
      .from(tickets)
      .where(eq(tickets.orgId, orgId))

    const aiResolutionRate =
      totalCount.value > 0
        ? Math.round((Number(aiResolvedCount.value) / Number(totalCount.value)) * 100)
        : 0

    return {
      open: Number(openCount.value),
      resolved: Number(resolvedCount.value),
      total: Number(totalCount.value),
      aiResolutionRate,
    }
  }),
})
