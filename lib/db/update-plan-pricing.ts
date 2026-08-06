import "dotenv/config"
import { eq } from "drizzle-orm"
import { db } from "./index"
import { plans } from "./schema"

/**
 * Idempotent price sync for already-provisioned databases.
 *
 * `seed.ts` truncates and re-seeds everything, which is fine for local dev
 * but destroys real org/customer/ticket data — never run it against a
 * populated environment. This script only updates `monthlyPriceCents` on
 * the three existing plan rows (by `key`), leaving Stripe price IDs,
 * organizations, and every other table untouched.
 *
 * Run: npx tsx lib/db/update-plan-pricing.ts
 *
 * After running this, also update the corresponding Stripe Price objects
 * (or create new ones and swap `stripePriceId`/`stripeMeteredPriceId`) so
 * what Stripe actually charges matches what the UI displays.
 */
const NEW_PRICING: Record<string, number> = {
  starter: 2900, // was 4900 ($49 -> $29)
  pro: 5900, // was 14900 ($149 -> $59)
  // enterprise intentionally omitted — pricing is negotiated ("Custom"),
  // the UI never renders monthlyPriceCents for this plan.
}

async function main() {
  console.log("Syncing plan pricing...")
  for (const [key, monthlyPriceCents] of Object.entries(NEW_PRICING)) {
    const existing = await db.query.plans.findFirst({ where: eq(plans.key, key) })
    if (!existing) {
      console.warn(`  skip: no plan found with key="${key}"`)
      continue
    }
    if (existing.monthlyPriceCents === monthlyPriceCents) {
      console.log(`  ${key}: already $${(monthlyPriceCents / 100).toFixed(2)}/mo, no change`)
      continue
    }
    await db.update(plans).set({ monthlyPriceCents }).where(eq(plans.key, key))
    console.log(
      `  ${key}: $${(existing.monthlyPriceCents / 100).toFixed(2)} -> $${(monthlyPriceCents / 100).toFixed(2)}/mo`
    )
  }
  console.log("Done.")
  process.exit(0)
}

main().catch((err) => {
  console.error("Plan pricing sync failed:", err)
  process.exit(1)
})
