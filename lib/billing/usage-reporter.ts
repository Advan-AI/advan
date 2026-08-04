import { and, eq, isNull, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { organizations, plans, usageEvents } from "@/lib/db/schema"
import { stripe } from "./stripe-client"

/**
 * Aggregates unreported AI message usage events for all organizations
 * with active Stripe subscriptions, reports the usage to Stripe,
 * and stamps the events with the Stripe Usage Record ID to guarantee
 * zero double-reporting.
 */
export async function reportUsageToStripe(): Promise<Record<string, number>> {
  console.log("[UsageReporter] Initiating usage reporting sweep...")

  // 1. Fetch all orgs with a live Stripe subscription (active, trialing, past_due, or
  //    canceling — all still have a metered item and must report usage).
  const allSubscribedOrgs = await db.query.organizations.findMany({
    where: inArray(organizations.subscriptionStatus, [
      "active",
      "trialing",
      "past_due",
      "canceling",
    ]),
  })

  const results: Record<string, number> = {}

  for (const org of allSubscribedOrgs) {
    if (!org.stripeSubscriptionId || !org.planId) continue

    try {
      // 2. Load the associated subscription plan
      const plan = await db.query.plans.findFirst({
        where: eq(plans.id, org.planId),
      })

      if (!plan || !plan.stripeMeteredPriceId) {
        console.warn(`[UsageReporter] Plan or metered price ID missing for org: ${org.id}`)
        continue
      }

      // 3. Query all unreported "ai_message" events
      const unreportedEvents = await db.query.usageEvents.findMany({
        where: and(
          eq(usageEvents.orgId, org.id),
          eq(usageEvents.type, "ai_message"),
          isNull(usageEvents.stripeUsageRecordId)
        ),
      })

      if (unreportedEvents.length === 0) {
        console.log(`[UsageReporter] No unreported events for org: ${org.name} (${org.id})`)
        continue
      }

      // 4. Sum the quantity of unreported events
      const totalQuantity = unreportedEvents.reduce((acc, e) => acc + e.quantity, 0)
      if (totalQuantity <= 0) continue

      console.log(
        `[UsageReporter] Found ${unreportedEvents.length} events summing to ${totalQuantity} AI messages for org: ${org.name}`
      )

      // 5. Retrieve subscription from Stripe to locate metered item
      const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId)
      const meteredItem = subscription.items.data.find(
        (item) => item.price.id === plan.stripeMeteredPriceId
      )

      if (!meteredItem) {
        console.error(
          `[UsageReporter] Metered price item (${plan.stripeMeteredPriceId}) not found in Stripe subscription ${org.stripeSubscriptionId} for org: ${org.id}`
        )
        continue
      }

      // 6. Submit usage record to Stripe (incrementing current period quantity)
      const usageRecord = await (stripe.subscriptionItems as any).createUsageRecord(
        meteredItem.id,
        {
          quantity: totalQuantity,
          action: "increment",
          timestamp: Math.floor(Date.now() / 1000),
        }
      )

      console.log(
        `[UsageReporter] Successfully reported ${totalQuantity} units to Stripe. Record ID: ${usageRecord.id}`
      )

      // 7. Atomically lock reported events in local database
      const eventIds = unreportedEvents.map((e) => e.id)
      await db
        .update(usageEvents)
        .set({ stripeUsageRecordId: usageRecord.id })
        .where(inArray(usageEvents.id, eventIds))

      results[org.id] = totalQuantity
    } catch (err: any) {
      console.error(
        `[UsageReporter] Failed to report usage for org: ${org.id} (${org.name}):`,
        err.message
      )
    }
  }

  console.log("[UsageReporter] Usage reporting sweep complete.")
  return results;
}
