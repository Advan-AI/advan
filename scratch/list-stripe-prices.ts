import { stripe } from "../lib/billing/stripe-client"

async function run() {
  try {
    const prices = await stripe.prices.list({ limit: 100 })
    console.log("--- All Stripe Prices ---")
    prices.data.forEach((p) => {
      console.log(`ID: ${p.id} | Product: ${p.product} | Nickname: ${p.nickname || "N/A"} | Type: ${p.type} | Active: ${p.active} | Unit Amount: ${p.unit_amount_decimal} Cents | Billing Scheme: ${p.billing_scheme}`)
    })
  } catch (err) {
    console.error("Error fetching stripe prices:", err)
  }
}

run()
