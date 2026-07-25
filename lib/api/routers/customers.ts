import { z } from "zod"
import { eq, and, desc, ilike, or, sql } from "drizzle-orm"
import { protectedProcedure, router } from "../trpc"
import { customers, tickets } from "@/lib/db/schema"
import { db } from "@/lib/db"

/**
 * Customer identification at intake time.
 *
 * Three variants:
 *   email-only        — email inbound; email channels
 *   visitorId-only — anonymous live chat (no pre-chat form)
 *   both              — offline chat: visitor provided their email via the
 *                       pre-chat form shown when no agent was online.
 *                       Creates a customer with both fields populated so
 *                       email-based agent replies can be delivered.
 */
export type CustomerIdentifier =
  | { email: string; visitorId?: never }
  | { visitorId: string; email?: never }
  | { email: string; visitorId: string }

export function normalizeCustomerEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function findCustomerForIntake(input: {
  orgId: string
  customerIdentifier: CustomerIdentifier
}) {
  const visitorIdentifier = input.customerIdentifier.visitorId
  const emailIdentifier = input.customerIdentifier.email
  const hasBoth = typeof visitorIdentifier === "string" && typeof emailIdentifier === "string"

  if (typeof visitorIdentifier === "string") {
    const visitorId = visitorIdentifier.trim()
    if (!visitorId) return null

    const bySession = await db.query.customers.findFirst({
      where: and(
        eq(customers.orgId, input.orgId),
        // Compatibility: customers table still stores chat identity in
        // visitor_session_id while conversation/session auth now uses visitorId.
        eq(customers.visitorSessionId, visitorId),
      ),
      orderBy: desc(customers.createdAt),
    })
    // When both are provided (pre-chat form path) and session lookup failed,
    // fall through to the email lookup to find a pre-existing customer.
    if (bySession || !hasBoth) return bySession ?? null
  }

  if (typeof emailIdentifier !== "string") return null

  const email = normalizeCustomerEmail(emailIdentifier)
  if (!email) return null

  return db.query.customers.findFirst({
    where: and(
      eq(customers.orgId, input.orgId),
      sql`lower(${customers.email}) = ${email}`,
    ),
    orderBy: desc(customers.createdAt),
  })
}

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
        .values({
          email: input.email,
          name: input.name,
          company: input.company,
          tier: input.tier,
          stripeCustomerId: input.stripeCustomerId,
          orgId: ctx.user.orgId,
        })
        .returning()
      return customer
    }),
})
