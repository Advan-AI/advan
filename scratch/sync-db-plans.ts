import { db } from "../lib/db"
import { plans } from "../lib/db/schema"
import { eq } from "drizzle-orm"

async function run() {
  console.log("🔄 Syncing database plans table with new .env price IDs...")
  try {
    // Starter
    await db.update(plans).set({
      stripePriceId: process.env.STRIPE_PRICE_STARTER_FLAT,
      stripeMeteredPriceId: process.env.STRIPE_PRICE_STARTER_METERED,
    }).where(eq(plans.key, "starter"))

    // Pro
    await db.update(plans).set({
      stripePriceId: process.env.STRIPE_PRICE_PRO_FLAT,
      stripeMeteredPriceId: process.env.STRIPE_PRICE_PRO_METERED,
    }).where(eq(plans.key, "pro"))

    // Enterprise
    await db.update(plans).set({
      stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE_FLAT,
      stripeMeteredPriceId: process.env.STRIPE_PRICE_ENTERPRISE_METERED,
    }).where(eq(plans.key, "enterprise"))

    console.log("✅ Database plans synced successfully!")
  } catch (err) {
    console.error("❌ Failed to sync database plans:", err)
  }
}

run()
