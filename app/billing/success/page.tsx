"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2 } from "lucide-react"
import { signIn } from "next-auth/react"

export default function BillingSuccessPage() {
  const router = useRouter()

  useEffect(() => {
    // Webhook may take a moment — wait briefly then send to sign in
    const t = setTimeout(() => {
      router.push("/signin?message=payment_confirmed")
    }, 3000)
    return () => clearTimeout(t)
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <CheckCircle2 className="w-16 h-16 text-[#5C9A70] mx-auto" />
        <h1 className="text-2xl font-semibold tracking-tight">Payment confirmed!</h1>
        <p className="text-sm text-foreground/60">
          Your 14-day free trial has started. Redirecting to sign in...
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-foreground/50">
          <Loader2 className="w-4 h-4 animate-spin" />
          Redirecting...
        </div>
      </div>
    </div>
  )
}
