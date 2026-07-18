"use client"

import { useState, FormEvent, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck, CheckCircle2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api/trpc-client"
import { toast } from "sonner"

export default function SignUpPage() {
  const router = useRouter()

  // Form fields
  const [orgName, setOrgName] = useState("")
  const [orgSlug, setOrgSlug] = useState("")
  const [adminName, setAdminName] = useState("")
  const [adminEmail, setAdminEmail] = useState("")
  const [password, setPassword] = useState("")

  // OTP step
  const [step, setStep] = useState<"form" | "otp">("form")
  const [otp, setOtp] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)

  // UI states
  const [showPassword, setShowPassword] = useState(false)
  const [signingUp, setSigningUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const signupMut = api.auth.signup.useMutation()
  const verifyOtpMut = api.auth.verifyOtp.useMutation()
  const resendOtpMut = api.auth.resendOtp.useMutation()

  // Load state from sessionStorage on mount
  useEffect(() => {
    try {
      const savedStep = sessionStorage.getItem("signup_step") as "form" | "otp" | null
      const savedEmail = sessionStorage.getItem("signup_email")
      const savedName = sessionStorage.getItem("signup_name")
      const savedOrgName = sessionStorage.getItem("signup_org_name")
      const savedOrgSlug = sessionStorage.getItem("signup_org_slug")

      if (savedStep) setStep(savedStep)
      if (savedEmail) setAdminEmail(savedEmail)
      if (savedName) setAdminName(savedName)
      if (savedOrgName) setOrgName(savedOrgName)
      if (savedOrgSlug) setOrgSlug(savedOrgSlug)
    } catch (e) {
      console.error("Failed to load signup state from sessionStorage:", e)
    }
  }, [])

  // Sync state to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem("signup_step", step)
      sessionStorage.setItem("signup_email", adminEmail)
      sessionStorage.setItem("signup_name", adminName)
      sessionStorage.setItem("signup_org_name", orgName)
      sessionStorage.setItem("signup_org_slug", orgSlug)
    } catch (e) {
      console.error("Failed to save signup state to sessionStorage:", e)
    }
  }, [step, adminEmail, adminName, orgName, orgSlug])

  const handleOrgNameChange = (val: string) => {
    setOrgName(val)
    setOrgSlug(
      val.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/[\s_]+/g, "-").replace(/-+/g, "-").trim()
    )
  }

  const handleSlugChange = (val: string) => {
    setOrgSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-"))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!orgName || !orgSlug || !adminName || !adminEmail || !password) {
      setError("Please fill in all fields to register your workspace.")
      return
    }
    if (orgSlug.length < 2) { setError("Subdomain slug must be at least 2 characters."); return }
    if (password.length < 6) { setError("Password must be at least 6 characters long."); return }

    setSigningUp(true)
    try {
      await signupMut.mutateAsync({ orgName, orgSlug, adminName, adminEmail, password })
      toast.success("Verification code sent to your email!")
      setStep("otp")
    } catch (err: any) {
      const msg = err.message || "Signup failed. Please try again."
      setError(msg)
      toast.error(msg)
    } finally {
      setSigningUp(false)
    }
  }

  const clearSessionStorage = () => {
    try {
      sessionStorage.removeItem("signup_step")
      sessionStorage.removeItem("signup_email")
      sessionStorage.removeItem("signup_name")
      sessionStorage.removeItem("signup_org_name")
      sessionStorage.removeItem("signup_org_slug")
    } catch (e) {
      console.error("Failed to clear signup state from sessionStorage:", e)
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (otp.length !== 6) { setError("Please enter the 6-digit code."); return }

    setVerifying(true)
    try {
      const result = await verifyOtpMut.mutateAsync({ email: adminEmail, otp })
      clearSessionStorage()
      if (result.checkoutUrl) {
        toast.success("Email verified! Redirecting to payment...")
        window.location.href = result.checkoutUrl
      } else {
        setSuccess(true)
        toast.success("Email verified! Redirecting to dashboard...")
        router.push("/dashboard")
        router.refresh()
      }
    } catch (err: any) {
      if (err.message === "Email already verified.") {
        clearSessionStorage()
        toast.info("Your email is already verified! Redirecting to sign in...")
        setTimeout(() => {
          router.push("/signin")
        }, 2000)
      } else {
        setError(err.message || "Invalid or expired code.")
      }
    } finally {
      setVerifying(false)
    }
  }

  async function handleResend() {
    setResending(true)
    setError(null)
    try {
      await resendOtpMut.mutateAsync({ email: adminEmail, name: adminName })
      toast.success("New verification code sent!")
    } catch (err: any) {
      if (err.message === "Email already verified.") {
        clearSessionStorage()
        toast.info("Your email is already verified! Redirecting to sign in...")
        setTimeout(() => {
          router.push("/signin")
        }, 2000)
      } else {
        setError(err.message || "Failed to resend code.")
      }
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(1000px 600px at 80% -10%, rgba(107,92,214,0.10), transparent 60%), radial-gradient(900px 600px at -10% 110%, rgba(92,154,112,0.10), transparent 55%)",
        }}
      />

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
          Already have an account?{" "}
          <Link href="/signin" className="font-medium text-[#6B5CD6] hover:underline">Sign in</Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[480px]"
        >
          <div className="relative rounded-3xl glass-strong p-8 sm:p-10 shadow-[0_20px_60px_-20px_rgba(60,50,30,0.18)]">

            {/* Success */}
            {success ? (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}>
                  <CheckCircle2 className="w-16 h-16 text-[#5C9A70]" />
                </motion.div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Workspace Ready!</h1>
                <div className="flex items-center gap-2 text-[12px] text-[var(--dash-ink-soft)] bg-[var(--dash-sage-wash)] rounded-lg px-3 py-1.5 font-semibold">
                  <Loader2 className="w-4 h-4 animate-spin text-[#2f5d3f]" />
                  Redirecting to dashboard...
                </div>
              </div>

            ) : step === "otp" ? (
              /* OTP verification step */
              <>
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#ECE9FB] flex items-center justify-center mb-4">
                    <Mail className="w-6 h-6 text-[#6B5CD6]" />
                  </div>
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">Check your email</h1>
                  <p className="mt-2 text-sm text-foreground/60">
                    We sent a 6-digit code to <span className="font-medium text-foreground">{adminEmail}</span>
                  </p>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <label htmlFor="otp" className="block text-xs font-medium text-foreground/70 mb-1.5">
                      Verification Code
                    </label>
                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      className="w-full h-14 rounded-xl border border-black/10 bg-white/80 px-3.5 text-center text-2xl font-mono tracking-[0.5em] text-foreground placeholder:text-foreground/20 outline-none focus:border-[#6B5CD6] focus:ring-2 focus:ring-[#ECE9FB] transition"
                    />
                  </div>

                  {error && (
                    <div className="text-xs font-medium text-[#BE6A6A] leading-relaxed">
                      {error === "Email already verified." ? (
                        <span>
                          Your email is already verified!{" "}
                          <Link href="/signin" className="underline font-semibold hover:text-[#BE6A6A]/80">
                            Sign in to your workspace
                          </Link>
                        </span>
                      ) : (
                        error
                      )}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={verifying || otp.length !== 6}
                    className="group w-full h-11 rounded-full bg-[#6B5CD6] hover:bg-[#4E3FB6] text-white text-sm font-semibold shadow-[0_10px_28px_-12px_rgba(107,92,214,0.65)] disabled:opacity-60 transition"
                  >
                    {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verify Email <ArrowRight className="ml-1.5 w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>}
                  </Button>

                  <div className="text-center text-sm text-foreground/50">
                    Didn't receive it?{" "}
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resending}
                      className="font-medium text-[#6B5CD6] hover:underline disabled:opacity-50"
                    >
                      {resending ? "Sending..." : "Resend code"}
                    </button>
                  </div>
                </form>
              </>

            ) : (
              /* Registration form */
              <>
                <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-center text-foreground">
                  Create your workspace
                </h1>
                <p className="mt-2 text-sm text-foreground/60 text-center">
                  Set up a secure, multi-tenant AI support workspace in seconds.
                </p>

                <form onSubmit={handleSubmit} className="mt-7 space-y-4">
                  <div>
                    <label htmlFor="orgName" className="block text-xs font-medium text-foreground/70 mb-1.5">Organization Name</label>
                    <input id="orgName" type="text" required value={orgName} onChange={(e) => handleOrgNameChange(e.target.value)} placeholder="Acme Corp" className="w-full h-11 rounded-xl border border-black/10 bg-white/80 px-3.5 text-sm text-foreground placeholder:text-foreground/40 outline-none focus:border-[#6B5CD6] focus:ring-2 focus:ring-[#ECE9FB] transition" />
                  </div>

                  <div>
                    <label htmlFor="orgSlug" className="block text-xs font-medium text-foreground/70 mb-1.5">Workspace Domain Slug</label>
                    <div className="relative flex items-center">
                      <input id="orgSlug" type="text" required value={orgSlug} onChange={(e) => handleSlugChange(e.target.value)} placeholder="acme" className="w-full h-11 rounded-xl border border-black/10 bg-white/80 pl-3.5 pr-28 text-sm text-foreground placeholder:text-foreground/40 outline-none focus:border-[#6B5CD6] focus:ring-2 focus:ring-[#ECE9FB] transition font-mono text-[13px]" />
                      <span className="absolute right-3.5 text-xs text-foreground/40 font-mono pointer-events-none select-none">.advan.ai</span>
                    </div>
                    <p className="mt-1.5 text-[10.5px] text-foreground/40 leading-normal">This unique URL slug separates your customer chats, tickets, and KB citations.</p>
                  </div>

                  <div className="py-2 flex items-center gap-3 text-[10px] uppercase tracking-[0.15em] text-foreground/30">
                    <span className="flex-1 h-px bg-black/[0.05]" />
                    <span>Administrator Profile</span>
                    <span className="flex-1 h-px bg-black/[0.05]" />
                  </div>

                  <div>
                    <label htmlFor="adminName" className="block text-xs font-medium text-foreground/70 mb-1.5">Your Name</label>
                    <input id="adminName" type="text" required value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Jane Doe" className="w-full h-11 rounded-xl border border-black/10 bg-white/80 px-3.5 text-sm text-foreground placeholder:text-foreground/40 outline-none focus:border-[#6B5CD6] focus:ring-2 focus:ring-[#ECE9FB] transition" />
                  </div>

                  <div>
                    <label htmlFor="adminEmail" className="block text-xs font-medium text-foreground/70 mb-1.5">Work Email</label>
                    <input id="adminEmail" type="email" required value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="jane@company.com" className="w-full h-11 rounded-xl border border-black/10 bg-white/80 px-3.5 text-sm text-foreground placeholder:text-foreground/40 outline-none focus:border-[#6B5CD6] focus:ring-2 focus:ring-[#ECE9FB] transition" />
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-xs font-medium text-foreground/70 mb-1.5">Password (min. 6 characters)</label>
                    <div className="relative">
                      <input id="password" type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full h-11 rounded-xl border border-black/10 bg-white/80 px-3.5 pr-11 text-sm text-foreground placeholder:text-foreground/40 outline-none focus:border-[#6B5CD6] focus:ring-2 focus:ring-[#ECE9FB] transition" />
                      <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute inset-y-0 right-0 px-3 flex items-center text-foreground/40 hover:text-foreground transition" aria-label={showPassword ? "Hide password" : "Show password"}>
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="text-xs font-medium text-[#BE6A6A] leading-relaxed">
                      {error === "A user with this email address is already registered." ? (
                        <span>
                          This email is already registered.{" "}
                          <Link href="/signin" className="underline font-semibold hover:text-[#BE6A6A]/80">
                            Sign in instead
                          </Link>
                        </span>
                      ) : (
                        error
                      )}
                    </div>
                  )}

                  <Button type="submit" disabled={signingUp} className="group w-full h-11 rounded-full bg-[#6B5CD6] hover:bg-[#4E3FB6] text-white text-sm font-semibold shadow-[0_10px_28px_-12px_rgba(107,92,214,0.65)] disabled:opacity-60 transition">
                    {signingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Provision Workspace <ArrowRight className="ml-1.5 w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>}
                  </Button>
                </form>

                <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-foreground/50">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#5C9A70]" />
                  Zero manual config · Locked widgets · SOC 2 Compliant
                </div>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-foreground/50">
            By creating a workspace you agree to our{" "}
            <Link href="/terms" className="underline hover:text-foreground">Terms</Link>{" "}and{" "}
            <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
          </p>
        </motion.div>
      </main>
    </div>
  )
}
