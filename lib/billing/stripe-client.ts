import Stripe from "stripe"
import { requireEnv } from "@/lib/env/required"

// Initialize Stripe singleton client
const stripeSecretKey = requireEnv("STRIPE_SECRET_KEY")

export const stripe = new Stripe(stripeSecretKey, {
  // Use a stable Stripe API version
  apiVersion: "2024-06-20" as any,
  typescript: true,
})
