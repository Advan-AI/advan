import { eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { organizations, plans, users } from "@/lib/db/schema"
import { stripe } from "./stripe-client"

/**
 * Creates a Stripe Customer for an organization if it doesn't already have one.
 * IDEMPOTENT: returns existing customer ID if already present.
 */
export async function createCustomerForOrg(orgId: string): Promise<string> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  })

  if (!org) {
    throw new Error(`Organization with ID ${orgId} not found`)
  }

  // Idempotency check: if customer ID already exists, return it
  if (org.stripeCustomerId) {
    return org.stripeCustomerId
  }

  // Create the customer on Stripe
  const customer = await stripe.customers.create({
    name: org.name,
    email: `billing@${org.slug}.advan.ai`,
    metadata: {
      orgId: org.id,
      slug: org.slug,
    },
  })

  // Store the Stripe Customer ID locally
  await db
    .update(organizations)
    .set({ stripeCustomerId: customer.id })
    .where(eq(organizations.id, org.id))

  return customer.id
}

/**
 * Starts a Stripe Subscription for an organization with dual subscription items:
 * 1. Flat monthly licensed price
 * 2. Metered overage message price
 *
 * Configures a 14-day trial since signup is card-optional.
 */
export async function startSubscription(orgId: string, planKey: string): Promise<any> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  })

  if (!org) {
    throw new Error(`Organization with ID ${orgId} not found`)
  }

  const targetPlan = await db.query.plans.findFirst({
    where: eq(plans.key, planKey),
  })

  if (!targetPlan) {
    throw new Error(`Plan with key ${planKey} not found`)
  }

  // Ensure Stripe customer exists
  const stripeCustomerId = org.stripeCustomerId || (await createCustomerForOrg(orgId))

  // Create Stripe subscription with dual pricing items and a 14-day trial
  const subscription = await stripe.subscriptions.create({
    customer: stripeCustomerId,
    items: [
      { price: targetPlan.stripePriceId },
      { price: targetPlan.stripeMeteredPriceId },
    ],
    trial_period_days: 14,
    trial_settings: {
      end_behavior: {
        missing_payment_method: "pause", // pause if no card added by end of trial
      },
    },
  })

  // Update local organization record
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
  const periodStart = new Date(subscription.current_period_start * 1000)
  const periodEnd = new Date(subscription.current_period_end * 1000)

  await db
    .update(organizations)
    .set({
      stripeSubscriptionId: subscription.id,
      planId: targetPlan.id,
      subscriptionStatus: subscription.status,
      trialEndsAt: trialEnd,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    })
    .where(eq(organizations.id, org.id))

  return subscription
}

/**
 * Switches the organization's existing subscription to a new subscription plan.
 * PRORATION DECISION: Uses standard Stripe "create_prorations" behavior.
 * This guarantees that if a tenant upgrades mid-month, they are charged a fractional,
 * prorated amount for the tier difference, and credits are computed for downgrades.
 */
export async function changePlan(orgId: string, newPlanKey: string): Promise<any> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  })

  if (!org) {
    throw new Error(`Organization with ID ${orgId} not found`)
  }

  if (!org.stripeSubscriptionId) {
    throw new Error(`Organization ${orgId} does not have an active Stripe subscription to change`)
  }

  const newPlan = await db.query.plans.findFirst({
    where: eq(plans.key, newPlanKey),
  })

  if (!newPlan) {
    throw new Error(`Plan with key ${newPlanKey} not found`)
  }

  // Find the old plan to identify existing subscription item price IDs
  const oldPlan = org.planId
    ? await db.query.plans.findFirst({ where: eq(plans.id, org.planId) })
    : null

  // Fetch the subscription from Stripe to obtain item IDs
  const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId)

  // Map existing items to their replacement price IDs
  const itemsToUpdate = sub.items.data.map((item) => {
    if (oldPlan && item.price.id === oldPlan.stripePriceId) {
      return {
        id: item.id,
        price: newPlan.stripePriceId,
      }
    }
    if (oldPlan && item.price.id === oldPlan.stripeMeteredPriceId) {
      return {
        id: item.id,
        price: newPlan.stripeMeteredPriceId,
      }
    }
    // Fallback/safeguard: if prices aren't resolved or match, let them stand
    return { id: item.id }
  })

  // Update Stripe subscription with prorations enabled
  const updatedSub = await stripe.subscriptions.update(org.stripeSubscriptionId, {
    items: itemsToUpdate,
    proration_behavior: "create_prorations",
  })

  // Update organization metadata locally
  await db
    .update(organizations)
    .set({
      planId: newPlan.id,
      subscriptionStatus: updatedSub.status,
      currentPeriodStart: new Date(updatedSub.current_period_start * 1000),
      currentPeriodEnd: new Date(updatedSub.current_period_end * 1000),
    })
    .where(eq(organizations.id, org.id))

  return updatedSub
}

/**
 * Cancels an active subscription either immediately or at the end of the current billing cycle.
 */
export async function cancelSubscription(orgId: string, atPeriodEnd: boolean): Promise<any> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  })

  if (!org) {
    throw new Error(`Organization with ID ${orgId} not found`)
  }

  if (!org.stripeSubscriptionId) {
    throw new Error(`Organization ${orgId} does not have an active Stripe subscription to cancel`)
  }

  let sub: any

  if (atPeriodEnd) {
    // Schedule cancellation for period end in Stripe
    sub = await stripe.subscriptions.update(org.stripeSubscriptionId, {
      cancel_at_period_end: true,
    })

    // Locally mark as "canceling" (still functionally active until cycle rollover)
    await db
      .update(organizations)
      .set({ subscriptionStatus: "canceling" })
      .where(eq(organizations.id, org.id))
  } else {
    // Cancel immediately in Stripe
    sub = await stripe.subscriptions.cancel(org.stripeSubscriptionId)

    // Mark as canceled locally
    await db
      .update(organizations)
      .set({ subscriptionStatus: "canceled" })
      .where(eq(organizations.id, org.id))
  }

  return sub
}

/**
 * Counts the active users under an organization and asserts whether
 * the seat limit for their current subscription plan has been reached.
 * Hard cap enforcement.
 */
export async function assertSeatLimit(orgId: string): Promise<void> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  })

  if (!org) {
    throw new Error(`Organization with ID ${orgId} not found`)
  }

  // If they don't have a plan yet, skip seat restriction
  if (!org.planId) {
    return
  }

  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, org.planId),
  })

  if (!plan) {
    throw new Error(`Plan associated with organization not found`)
  }

  // Count current users in database for this org
  const currentUsersResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.orgId, orgId))

  const userCount = Number(currentUsersResult[0]?.count ?? 0)

  if (userCount >= plan.seatLimit) {
    throw new Error(`Seat limit reached (${plan.seatLimit} seats). Please upgrade your plan to add more seats.`)
  }
}
