"use client"

import { useState, FormEvent } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { motion } from "framer-motion"
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState<"email" | "google" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email || !password) {
      setError("Enter your email and password to continue.")
      return
    }
    setLoading("email")
    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
    })
    setLoading(null)
    if (result?.error) {
      setError("Invalid email or password. Please try again.")
    } else {
      router.push("/dashboard")
      router.refresh()
    }
  }

  async function handleGoogle() {
    setError(null)
    setLoading("google")
    await signIn("google", { callbackUrl: "/dashboard" })
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Soft ambient backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(1000px 600px at 20% -10%, rgba(107,92,214,0.10), transparent 60%), radial-gradient(900px 600px at 110% 110%, rgba(92,154,112,0.10), transparent 55%)",
        }}
      />

      {/* Minimal header */}
      <header className="px-6 sm:px-10 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <Image
            src="/images/advan-logo.svg"
            alt="Advan AI"
            width={32}
            height={32}
            priority
            className="rounded-lg ring-1 ring-black/10 group-hover:ring-black/30 transition"
          />
          <span className="font-semibold text-base text-foreground tracking-tight">Advan</span>
        </Link>
        <div className="text-sm text-foreground/60">
          New to Advan?{" "}
          <Link href="/" className="font-medium text-foreground hover:underline">
            Book a demo
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[440px]"
        >
          <div className="relative rounded-3xl glass-strong p-8 sm:p-10 shadow-[0_20px_60px_-20px_rgba(60,50,30,0.18)]">
            {/* Card top: micro logo */}
            <div className="flex items-center justify-center mb-7">
              <Image
                src="/images/advan-logo.svg"
                alt="Advan"
                width={56}
                height={56}
                className="rounded-2xl shadow-[0_8px_24px_-10px_rgba(0,0,0,0.5)]"
                priority
              />
            </div>

            <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-center text-foreground">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-foreground/60 text-center">
              Sign in to your Advan support workspace.
            </p>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading !== null}
              className="mt-7 w-full inline-flex items-center justify-center gap-3 rounded-full border border-black/10 bg-white/90 hover:bg-white px-4 h-11 text-sm font-medium text-foreground transition disabled:opacity-60"
            >
              {loading === "google" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <GoogleIcon className="w-4 h-4" />
              )}
              Continue with Google
            </button>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-foreground/40">
              <span className="flex-1 h-px bg-black/[0.08]" />
              <span>or</span>
              <span className="flex-1 h-px bg-black/[0.08]" />
            </div>

            {/* Email form */}
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-foreground/70 mb-1.5">
                  Work email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full h-11 rounded-xl border border-black/10 bg-white/80 px-3.5 text-sm text-foreground placeholder:text-foreground/40 outline-none focus:border-[#6B5CD6] focus:ring-2 focus:ring-[#ECE9FB] transition"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-xs font-medium text-foreground/70">
                    Password
                  </label>
                  <Link
                    href="/signin/forgot"
                    className="text-xs font-medium text-[#4E3FB6] hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 rounded-xl border border-black/10 bg-white/80 px-3.5 pr-11 text-sm text-foreground placeholder:text-foreground/40 outline-none focus:border-[#6B5CD6] focus:ring-2 focus:ring-[#ECE9FB] transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-foreground/40 hover:text-foreground transition"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-xs font-medium text-[#BE6A6A]">{error}</p>
              )}

              <Button
                type="submit"
                disabled={loading !== null}
                className="group w-full h-11 rounded-full bg-[#6B5CD6] hover:bg-[#4E3FB6] text-white text-sm font-semibold shadow-[0_10px_28px_-12px_rgba(107,92,214,0.65)] disabled:opacity-60"
              >
                {loading === "email" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="ml-1.5 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </Button>
            </form>

            {/* Trust footer */}
            <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-foreground/50">
              <ShieldCheck className="w-3.5 h-3.5 text-[#5C9A70]" />
              SOC 2 · GDPR · SSO available on Enterprise
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-foreground/50">
            By signing in you agree to our{" "}
            <Link href="/terms" className="underline hover:text-foreground">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-foreground">
              Privacy
            </Link>
            .
          </p>
        </motion.div>
      </main>
    </div>
  )
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.5 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C33.9 5.5 29.2 3.5 24 3.5 12.7 3.5 3.5 12.7 3.5 24S12.7 44.5 24 44.5 44.5 35.3 44.5 24c0-1.2-.1-2.4-.9-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C33.9 7 29.2 5 24 5 16.3 5 9.6 9 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 43c5.1 0 9.8-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.3 0-9.7-3.5-11.3-8.3l-6.5 5C9.4 38.6 16.1 43 24 43z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.6l6.2 5.2c-.4.4 6.5-4.7 6.5-14.8 0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  )
}
