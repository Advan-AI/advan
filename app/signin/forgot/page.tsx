"use client"

import { useState, FormEvent } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    await new Promise((r) => setTimeout(r, 700))
    setLoading(false)
    setSent(true)
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(1000px 600px at 20% -10%, rgba(107,92,214,0.10), transparent 60%), radial-gradient(900px 600px at 110% 110%, rgba(92,154,112,0.10), transparent 55%)",
        }}
      />

      <header className="px-6 sm:px-10 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <Image src="/images/advan-logo.svg" alt="Advan" width={32} height={32} className="rounded-lg ring-1 ring-black/10" />
          <span className="font-semibold text-base text-foreground tracking-tight">Advan</span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[420px]"
        >
          <Link
            href="/signin"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/60 hover:text-foreground mb-4 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to sign in
          </Link>

          <div className="rounded-3xl glass-strong p-8 sm:p-10 shadow-[0_20px_60px_-20px_rgba(60,50,30,0.18)]">
            {sent ? (
              <div className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-[#E3EFE5] flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-6 h-6 text-[#5C9A70]" />
                </div>
                <h1 className="text-xl font-semibold text-foreground">Check your inbox</h1>
                <p className="mt-2 text-sm text-foreground/60">
                  If <span className="font-medium text-foreground">{email}</span> matches an Advan account, we sent a reset link.
                </p>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reset your password</h1>
                <p className="mt-2 text-sm text-foreground/60">
                  Enter your email and we'll send a secure reset link.
                </p>
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full h-11 rounded-xl border border-black/10 bg-white/80 px-3.5 text-sm text-foreground placeholder:text-foreground/40 outline-none focus:border-[#6B5CD6] focus:ring-2 focus:ring-[#ECE9FB] transition"
                  />
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 rounded-full bg-[#6B5CD6] hover:bg-[#4E3FB6] text-white text-sm font-semibold shadow-[0_10px_28px_-12px_rgba(107,92,214,0.65)] disabled:opacity-60"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send reset link"}
                  </Button>
                </form>
              </>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  )
}
