import Stripe from "stripe"

// Initialize Stripe singleton client
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "sk_test_placeholder"

export const stripe = new Stripe(stripeSecretKey, {
  // Use a stable Stripe API version
  apiVersion: "2024-06-20" as any,
  typescript: true,
})
