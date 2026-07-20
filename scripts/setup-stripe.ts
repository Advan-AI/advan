/**
 * scripts/setup-stripe.ts
 *
 * One-time script: creates Advan AI products and prices in Stripe test mode,
 * then prints the IDs to paste into your .env / .env.local.
 *
 * Run ONCE per Stripe account (test mode):
 *   STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/setup-stripe.ts
 *
 * The script is idempotent via metadata lookup — re-running it will detect
 * existing products/prices and skip creation rather than duplicating them.
 *
 * Architecture:
 *   Each plan has TWO Stripe Price objects on ONE Product:
 *   1. Flat recurring price  — charged monthly regardless of usage
 *   2. Metered overage price — charged per AI message above the included limit
 *      (billing_scheme=per_unit, usage_type=metered, aggregate_usage=sum)
 *
 * After running, add the printed IDs to your .env:
 *   STRIPE_PRICE_STARTER_FLAT=price_...
 *   STRIPE_PRICE_STARTER_METERED=price_...
 *   STRIPE_PRICE_PRO_FLAT=price_...
 *   STRIPE_PRICE_PRO_METERED=price_...
 *   STRIPE_PRICE_ENTERPRISE_FLAT=price_...
 *   STRIPE_PRICE_ENTERPRISE_METERED=price_...
 *
 * Then re-run: npx drizzle-kit migrate && npx tsx lib/db/seed.ts
 */

import Stripe from "stripe"

const key = process.env.STRIPE_SECRET_KEY
if (!key || key === "sk_test_placeholder") {
  console.error(
    "\n❌  STRIPE_SECRET_KEY is not set or is still the placeholder.\n" +
    "    Run: STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/setup-stripe.ts\n"
  )
  process.exit(1)
}

if (!key.startsWith("sk_test_")) {
  console.error(
    "\n❌  STRIPE_SECRET_KEY does not look like a test-mode key (expected sk_test_...).\n" +
    "    This script is for test mode only. Use your Stripe Dashboard test keys.\n"
  )
  process.exit(1)
}

const stripe = new Stripe(key, { apiVersion: "2024-06-20" as any })

const PLANS = [
  {
    key: "starter",
    name: "Advan AI — Starter",
    flatCents: 4900,       // $49/mo
    overageCents: 10,      // $0.10 per extra AI message
    envFlat: "STRIPE_PRICE_STARTER_FLAT",
    envMetered: "STRIPE_PRICE_STARTER_METERED",
  },
  {
    key: "pro",
    name: "Advan AI — Pro",
    flatCents: 14900,      // $149/mo
    overageCents: 5,       // $0.05 per extra AI message
    envFlat: "STRIPE_PRICE_PRO_FLAT",
    envMetered: "STRIPE_PRICE_PRO_METERED",
  },
  {
    key: "enterprise",
    name: "Advan AI — Enterprise",
    flatCents: 49900,      // $499/mo
    overageCents: 2,       // $0.02 per extra AI message
    envFlat: "STRIPE_PRICE_ENTERPRISE_FLAT",
    envMetered: "STRIPE_PRICE_ENTERPRISE_METERED",
  },
]

async function findOrCreateProduct(plan: (typeof PLANS)[number]): Promise<string> {
  // Search by metadata tag so re-runs are idempotent
  const existing = await stripe.products.search({
    query: `metadata["advan_plan_key"]:"${plan.key}"`,
    limit: 1,
  })
  if (existing.data.length > 0) {
    console.log(`  ↩  Product already exists: ${existing.data[0].id} (${plan.name})`)
    return existing.data[0].id
  }
  const product = await stripe.products.create({
    name: plan.name,
    metadata: { advan_plan_key: plan.key },
  })
  console.log(`  ✓  Created product: ${product.id} (${plan.name})`)
  return product.id
}

async function findOrCreateFlatPrice(productId: string, plan: (typeof PLANS)[number]): Promise<string> {
  const existing = await stripe.prices.search({
    query: `product:"${productId}" AND metadata["advan_price_type"]:"flat"`,
    limit: 1,
  })
  if (existing.data.length > 0) {
    console.log(`  ↩  Flat price already exists: ${existing.data[0].id}`)
    return existing.data[0].id
  }
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: plan.flatCents,
    currency: "usd",
    recurring: { interval: "month" },
    metadata: { advan_plan_key: plan.key, advan_price_type: "flat" },
  })
  console.log(`  ✓  Created flat price: ${price.id} ($${(plan.flatCents / 100).toFixed(2)}/mo)`)
  return price.id
}

async function findOrCreateMeteredPrice(productId: string, plan: (typeof PLANS)[number]): Promise<string> {
  const existing = await stripe.prices.search({
    query: `product:"${productId}" AND metadata["advan_price_type"]:"metered"`,
    limit: 1,
  })
  if (existing.data.length > 0) {
    console.log(`  ↩  Metered price already exists: ${existing.data[0].id}`)
    return existing.data[0].id
  }
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: plan.overageCents,
    currency: "usd",
    recurring: {
      interval: "month",
      usage_type: "metered",
      aggregate_usage: "sum",
    },
    billing_scheme: "per_unit",
    metadata: { advan_plan_key: plan.key, advan_price_type: "metered" },
  })
  console.log(`  ✓  Created metered price: ${price.id} ($${(plan.overageCents / 100).toFixed(3)}/msg overage)`)
  return price.id
}

async function main() {
  console.log("\n🔧  Advan AI — Stripe test-mode setup\n")

  const results: Array<{ plan: string; flatId: string; meteredId: string; envFlat: string; envMetered: string }> = []

  for (const plan of PLANS) {
    console.log(`\n📦  ${plan.name}`)
    const productId = await findOrCreateProduct(plan)
    const flatId = await findOrCreateFlatPrice(productId, plan)
    const meteredId = await findOrCreateMeteredPrice(productId, plan)
    results.push({ plan: plan.key, flatId, meteredId, envFlat: plan.envFlat, envMetered: plan.envMetered })
  }

  console.log("\n\n✅  Done! Add these to your .env / .env.local:\n")
  console.log("# ── Stripe Price IDs (generated by scripts/setup-stripe.ts) ──")
  for (const r of results) {
    console.log(`${r.envFlat}=${r.flatId}`)
    console.log(`${r.envMetered}=${r.meteredId}`)
  }
  console.log("")
  console.log("Then run: npx drizzle-kit migrate && npx tsx lib/db/seed.ts")
  console.log("")
}

main().catch((err) => {
  console.error("\n❌  Setup failed:", err.message)
  process.exit(1)
})
