import { z } from "zod"
import { eq, sql, and, gte, lte } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure } from "../trpc"
import { db } from "@/lib/db"
import { organizations, plans, usageEvents, users } from "@/lib/db/schema"
import { stripe } from "@/lib/billing/stripe-client"
import { changePlan, startSubscription, createCustomerForOrg } from "@/lib/billing/subscription-service"

const OVERAGE_RATES_CENTS: Record<string, number> = {
  starter: 10,       // 10 cents per message overage
  pro: 5,            // 5 cents per message overage
  enterprise: 2,     // 2 cents per message overage
}

export const billingRouter = router({
  getBillingInfo: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.user.orgId

    // 1. Fetch organization details
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    })

    if (!org) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Organization not found",
      })
    }

    // 2. Fetch current plan
    const currentPlan = org.planId
      ? await db.query.plans.findFirst({ where: eq(plans.id, org.planId) })
      : null

    // 3. Count current users (seats used)
    const userCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.orgId, orgId))
    const seatsUsed = Number(userCountResult[0]?.count ?? 0)

    // 4. Calculate AI message usage in current billing period
    const start = org.currentPeriodStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const end = org.currentPeriodEnd || new Date()

    const usageResult = await db
      .select({ count: sql<number>`sum(quantity)` })
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.orgId, orgId),
          eq(usageEvents.type, "ai_message"),
          gte(usageEvents.createdAt, start),
          lte(usageEvents.createdAt, end)
        )
      )
    const messagesUsed = Number(usageResult[0]?.count ?? 0)

    // 5. Calculate overage cost if any
    let overageCostCents = 0
    const overageRateCents = currentPlan ? (OVERAGE_RATES_CENTS[currentPlan.key] ?? 5) : 0
    if (currentPlan && messagesUsed > currentPlan.includedMessages) {
      overageCostCents = (messagesUsed - currentPlan.includedMessages) * overageRateCents
    }

    return {
      org,
      currentPlan,
      seatsUsed,
      messagesUsed,
      overageCostCents,
      overageRateCents,
      currentPeriodStart: start,
      currentPeriodEnd: end,
    }
  }),

  listPlans: protectedProcedure.query(async () => {
    return await db.query.plans.findMany({
      where: eq(plans.active, true),
      orderBy: (plans, { asc }) => [asc(plans.monthlyPriceCents)],
    })
  }),

  changeSubscriptionPlan: protectedProcedure
    .input(z.object({ planKey: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId

      // 1. Fetch organization details
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, orgId),
      })

      if (!org) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        })
      }

      // 2. Ensure Stripe customer exists
      const stripeCustomerId = org.stripeCustomerId || (await createCustomerForOrg(orgId))

      // 3. Find the selected target plan details
      const targetPlan = await db.query.plans.findFirst({
        where: eq(plans.key, input.planKey),
      })

      if (!targetPlan) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Plan with key ${input.planKey} not found`,
        })
      }

      // 4. Check if the user has a card on file
      let hasPaymentMethod = false
      try {
        const paymentMethods = await stripe.paymentMethods.list({
          customer: stripeCustomerId,
          type: "card",
        })
        hasPaymentMethod = paymentMethods.data.length > 0
      } catch (pmErr: any) {
        console.error("Failed to list payment methods for stripeCustomer:", pmErr)
      }

      // 5. If they have no payment method on file, create a Stripe Checkout Session
      // to securely collect their card details and subscribe them to this plan
      if (!hasPaymentMethod) {
        try {
          const returnUrl = `${process.env.NEXT_URL || "http://localhost:3000"}/billing/success?session_id={CHECKOUT_SESSION_ID}`
          const flatPriceId = targetPlan.stripePriceId?.trim()
          const meteredPriceId = targetPlan.stripeMeteredPriceId?.trim()

          const lineItems = []
          if (flatPriceId) {
            lineItems.push({
              price: flatPriceId,
              quantity: 1,
            })
          }
          if (meteredPriceId) {
            lineItems.push({
              price: meteredPriceId,
            })
          }

          console.log(`[Stripe Checkout] Creating session for org=${orgId}, plan=${input.planKey}:`, {
            customer: stripeCustomerId,
            lineItems,
          })

          const checkoutSession = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            mode: "subscription",
            line_items: lineItems,
            success_url: returnUrl,
            cancel_url: `${process.env.NEXT_URL || "http://localhost:3000"}/dashboard/billing`,
            metadata: {
              orgId,
              planKey: input.planKey,
            },
            subscription_data: {
              metadata: {
                orgId,
                planKey: input.planKey,
              },
            },
          })
          return { success: true, checkoutUrl: checkoutSession.url }
        } catch (checkoutErr: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: checkoutErr.message || "Failed to create checkout session",
          })
        }
      }

      // 6. If they have a card on file, execute plan modification directly
      try {
        await changePlan(orgId, input.planKey)
        return { success: true }
      } catch (err: any) {
        // If the org doesn't have an active subscription yet, start a new one!
        if (err.message && err.message.includes("does not have an active Stripe subscription to change")) {
          try {
            await startSubscription(orgId, input.planKey)
            return { success: true }
          } catch (startErr: any) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: startErr.message || "Failed to start subscription",
            })
          }
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message || "Failed to change plan",
        })
      }
    }),

  getPortalSession: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.user.orgId
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    })

    if (!org || !org.stripeCustomerId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Organization does not have a valid Stripe Customer ID",
      })
    }

    const returnUrl = `${process.env.NEXT_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"}/dashboard/billing`

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: org.stripeCustomerId,
        return_url: returnUrl,
      })
      return { url: session.url }
    } catch (err: any) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: err.message || "Failed to create portal session",
      })
    }
  }),

  getInvoiceHistory: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.user.orgId
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    })

    if (!org || !org.stripeCustomerId) {
      return []
    }

    try {
      const invoices = await stripe.invoices.list({
        customer: org.stripeCustomerId,
        limit: 15,
      })

      return invoices.data.map((inv) => ({
        id: inv.id,
        number: inv.number,
        total: inv.total,
        status: inv.status,
        created: inv.created,
        pdfUrl: inv.invoice_pdf,
      }))
    } catch (err: any) {
      console.error("Failed to fetch invoices from Stripe:", err.message)
      return []
    }
  }),
})
