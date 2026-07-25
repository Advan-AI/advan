import { stripe } from "../lib/billing/stripe-client"
import * as fs from "fs"
import * as path from "path"

async function run() {
  console.log("🔍 Checking and creating missing Stripe metered prices...")

  try {
    // 1. Create Starter Metered Price ($0.10 / message)
    console.log("Creating Starter Metered Product...")
    const starterProduct = await stripe.products.create({
      name: "Starter Overage Messages",
      description: "Overage messages for Advan AI Starter Plan",
    })
    const starterMeteredPrice = await stripe.prices.create({
      product: starterProduct.id,
      currency: "usd",
      unit_amount: 10, // 10 cents
      recurring: {
        interval: "month",
        usage_type: "metered",
        aggregate_usage: "sum",
      } as any,
    })
    console.log(`✅ Starter Metered Price Created: ${starterMeteredPrice.id}`)

    // 2. Create Pro Metered Price ($0.05 / message)
    console.log("Creating Pro Metered Product...")
    const proProduct = await stripe.products.create({
      name: "Pro Overage Messages",
      description: "Overage messages for Advan AI Pro Plan",
    })
    const proMeteredPrice = await stripe.prices.create({
      product: proProduct.id,
      currency: "usd",
      unit_amount: 5, // 5 cents
      recurring: {
        interval: "month",
        usage_type: "metered",
        aggregate_usage: "sum",
      } as any,
    })
    console.log(`✅ Pro Metered Price Created: ${proMeteredPrice.id}`)

    // 3. Create Enterprise Metered Price ($0.02 / message)
    console.log("Creating Enterprise Metered Product...")
    const enterpriseProduct = await stripe.products.create({
      name: "Enterprise Overage Messages",
      description: "Overage messages for Advan AI Enterprise Plan",
    })
    const enterpriseMeteredPrice = await stripe.prices.create({
      product: enterpriseProduct.id,
      currency: "usd",
      unit_amount: 2, // 2 cents
      recurring: {
        interval: "month",
        usage_type: "metered",
        aggregate_usage: "sum",
      } as any,
    })
    console.log(`✅ Enterprise Metered Price Created: ${enterpriseMeteredPrice.id}`)

    console.log("\n🚀 RECOMMENDED ENV CONFIGURATION:")
    console.log("-----------------------------------------")
    console.log(`STRIPE_PRICE_STARTER_FLAT="price_1TtKr0LqSRj8IpR6AItmIdMu"`)
    console.log(`STRIPE_PRICE_STARTER_METERED="${starterMeteredPrice.id}"`)
    console.log(`STRIPE_PRICE_PRO_FLAT="price_1TtKrRLqSRj8IpR6ReJx63Js"`)
    console.log(`STRIPE_PRICE_PRO_METERED="${proMeteredPrice.id}"`)
    console.log(`STRIPE_PRICE_ENTERPRISE_FLAT="price_1TtKrkLqSRj8IpR6g4vxzCwk"`)
    console.log(`STRIPE_PRICE_ENTERPRISE_METERED="${enterpriseMeteredPrice.id}"`)
    console.log("-----------------------------------------")

  } catch (err: any) {
    console.error("❌ Failed to create missing Stripe resources:", err)
  }
}

run()
