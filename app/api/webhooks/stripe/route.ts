import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/billing/stripe-client"
import { startSubscription } from "@/lib/billing/subscription-service"
import { db } from "@/lib/db"
import { stripeEvents, organizations, plans } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getResendClient } from "@/lib/email/resend-client"
import { requireEmailConfig } from "@/lib/email/config"

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  let event: ReturnType<typeof stripe.webhooks.constructEvent> extends Promise<infer T> ? T : ReturnType<typeof stripe.webhooks.constructEvent>
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  // Idempotency — skip already-processed events
  try {
    await db.insert(stripeEvents).values({ id: event.id, type: event.type })
  } catch {
    return NextResponse.json({ received: true, duplicate: true }) // duplicate
  }

  // 1. Checkout session completed -> start subscription
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as { metadata?: { orgId?: string }; subscription?: string }
    const orgId = session.metadata?.orgId
    if (orgId) {
      await startSubscription(orgId, "starter")
    }
  }

  // 2. Subscription updated -> sync status, period, and plan changes
  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as any
    const customerId = sub.customer
    const status = sub.status
    const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : null
    const currentPeriodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000) : null
    const currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.stripeCustomerId, customerId),
    })

    if (org) {
      const stripePriceId = sub.items?.data?.[0]?.price?.id
      let planId = org.planId
      if (stripePriceId) {
        const plan = await db.query.plans.findFirst({
          where: eq(plans.stripePriceId, stripePriceId),
        })
        if (plan) {
          planId = plan.id
        }
      }

      await db.update(organizations)
        .set({
          subscriptionStatus: status,
          trialEndsAt: trialEnd,
          currentPeriodStart,
          currentPeriodEnd,
          planId,
        })
        .where(eq(organizations.id, org.id))
    }
  }

  // 3. Subscription deleted -> mark status as canceled
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as any
    const customerId = sub.customer

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.stripeCustomerId, customerId),
    })

    if (org) {
      await db.update(organizations)
        .set({
          subscriptionStatus: "canceled",
        })
        .where(eq(organizations.id, org.id))
    }
  }

  // 4. Invoice payment failed -> set past_due status and send dunning notification
  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as any
    const customerId = invoice.customer

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.stripeCustomerId, customerId),
    })

    if (org) {
      await db.update(organizations)
        .set({
          subscriptionStatus: "past_due",
        })
        .where(eq(organizations.id, org.id))

      // Trigger dunning notification
      try {
        const emailConfig = requireEmailConfig()
        const resend = getResendClient()
        await resend.emails.send({
          from: emailConfig.from || process.env.EMAIL_FROM || "billing@mail.test.local",
          to: `billing@${org.slug}.advan.ai`,
          subject: "Subscription Payment Failed - Advan AI",
          html: `<p>Your payment failed. Please update your payment method in the Advan AI Billing dashboard.</p>`,
        })
      } catch (err) {
        console.error("Failed to send dunning email:", err)
      }
    }
  }

  // 5. Invoice paid -> clear past_due/set status back to active upon payment confirmation
  if (event.type === "invoice.paid") {
    const invoice = event.data.object as any
    const customerId = invoice.customer

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.stripeCustomerId, customerId),
    })

    if (org) {
      await db.update(organizations)
        .set({
          subscriptionStatus: "active",
        })
        .where(eq(organizations.id, org.id))
    }
  }

  return NextResponse.json({ received: true })
}
