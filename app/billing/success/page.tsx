"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2 } from "lucide-react"
import { useSession } from "next-auth/react"

/**
 * Landing page for Stripe Checkout's `success_url`.
 *
 * The Stripe webhook (checkout.session.completed) is what actually activates
 * the subscription — this page just gives the user a moment of confirmation
 * and routes them to wherever they can see it reflected:
 *  - Already signed in (upgrading from Billing) -> straight back to Billing.
 *  - Not signed in (paid during signup, rare) -> to Sign In.
 */
export default function BillingSuccessPage() {
  const router = useRouter()
  const { status } = useSession()
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    if (status === "loading" || redirecting) return
    setRedirecting(true)

    // Webhook may take a moment to land — brief pause before sending them on.
    const t = setTimeout(() => {
      if (status === "authenticated") {
        router.push("/dashboard/billing?upgraded=1")
      } else {
        router.push("/signin?message=payment_confirmed")
      }
    }, 2500)
    return () => clearTimeout(t)
  }, [status, redirecting, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <CheckCircle2 className="w-16 h-16 text-[#5C9A70] mx-auto" />
        <h1 className="text-2xl font-semibold tracking-tight">Payment confirmed!</h1>
        <p className="text-sm text-foreground/60">
          {status === "authenticated"
            ? "Your subscription is being activated."
            : "Your 14-day free trial has started."}
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-foreground/50">
          <Loader2 className="w-4 h-4 animate-spin" />
          Redirecting...
        </div>
      </div>
    </div>
  )
}
