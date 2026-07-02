import { z } from "zod"
import { eq, and, desc, ilike, or } from "drizzle-orm"
import { protectedProcedure, router } from "../trpc"
import { customers, tickets } from "@/lib/db/schema"
import { db } from "@/lib/db"

export const customersRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        tier: z.enum(["free", "growth", "enterprise"]).optional(),
        limit: z.number().min(1).max(100).default(25),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(customers.orgId, ctx.user.orgId)]
      if (input.tier) conditions.push(eq(customers.tier, input.tier))
      if (input.search) {
        conditions.push(
          or(
            ilike(customers.name, `%${input.search}%`),
            ilike(customers.email, `%${input.search}%`),
            ilike(customers.company, `%${input.search}%`)
          )!
        )
      }

      const rows = await db
        .select()
        .from(customers)
        .where(and(...conditions))
        .orderBy(desc(customers.createdAt))
        .limit(input.limit)
        .offset(input.offset)

      return rows
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const customer = await db.query.customers.findFirst({
        where: and(
          eq(customers.id, input.id),
          eq(customers.orgId, ctx.user.orgId)
        ),
      })
      if (!customer) throw new Error("Customer not found")
      return customer
    }),

  getHistory: protectedProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const customerTickets = await db
        .select()
        .from(tickets)
        .where(
          and(
            eq(tickets.customerId, input.customerId),
            eq(tickets.orgId, ctx.user.orgId)
          )
        )
        .orderBy(desc(tickets.createdAt))
        .limit(20)

      return customerTickets
    }),

  create: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
        company: z.string().optional(),
        tier: z.enum(["free", "growth", "enterprise"]).default("free"),
        stripeCustomerId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [customer] = await db
        .insert(customers)
        .values({ ...input, orgId: ctx.user.orgId })
        .returning()
      return customer
    }),
})
