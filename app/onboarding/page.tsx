"use client"

import { useState, FormEvent, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { motion } from "framer-motion"
import { Sparkles, Loader2, ArrowRight, ShieldCheck, CheckCircle2, Globe, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api/trpc-client"
import { toast } from "sonner"
import Image from "next/image"

export default function OnboardingPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  // Onboarding queries & mutations
  const onboarding = api.auth.getOnboardingStatus.useQuery(undefined, {
    enabled: status === "authenticated",
    refetchOnWindowFocus: false,
    retry: false,
  })

  const completeOnboardingMut = api.auth.completeOnboarding.useMutation()

  // Form states
  const [orgName, setOrgName] = useState("")
  const [orgSlug, setOrgSlug] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Redirect if not logged in, or already completed onboarding
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signin")
    }
  }, [status, router])

  useEffect(() => {
    if (status === "authenticated" && onboarding.data && !onboarding.data.isPending) {
      router.push("/dashboard")
    }
  }, [status, onboarding.data, router])

  // Sync workspace slug when name changes
  const handleOrgNameChange = (val: string) => {
    setOrgName(val)
    setOrgSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-")
        .trim()
    )
  }

  const handleSlugChange = (val: string) => {
    setOrgSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-"))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!orgName || !orgSlug) {
      setError("Please fill in all fields to complete your workspace onboarding.")
      return
    }
    if (orgSlug.length < 2) {
      setError("Workspace subdomain must be at least 2 characters.")
      return
    }

    setSubmitting(true)
    try {
      await completeOnboardingMut.mutateAsync({ orgName, orgSlug })
      toast.success("Workspace created successfully!")
      setSuccess(true)
      
      // Force refresh and redirect to dashboard
      setTimeout(() => {
        router.push("/dashboard")
        router.refresh()
      }, 1500)
    } catch (err: any) {
      const msg = err.message || "Something went wrong. Please try again."
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Loading skeleton while verifying session / onboarding status
  if (status === "loading" || onboarding.isLoading || (onboarding.data && !onboarding.data.isPending)) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-[#6B5CD6]" />
          <p className="text-sm font-semibold text-slate-500 tracking-wide animate-pulse">
            Configuring workspace environment...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-[#FDFBF7]">
      {/* Dynamic ambient gradients mapping back to warm aesthetic */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(1200px 700px at 80% -10%, rgba(107,92,214,0.06), transparent 60%), radial-gradient(1000px 700px at -10% 110%, rgba(92,154,112,0.06), transparent 55%)",
        }}
      />

      <header className="px-6 sm:px-10 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5 group">
          <Image
            src="/images/advan-logo.svg"
            alt="Advan AI Logo"
            width={32}
            height={32}
            priority
            className="rounded-lg ring-1 ring-black/10 group-hover:ring-black/20 transition"
          />
          <span className="font-bold text-lg text-slate-800 tracking-tight">Advan</span>
        </div>
        <div className="text-sm text-slate-500 font-medium">
          Logged in as <span className="text-slate-800 font-semibold">{session?.user?.email}</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[500px]"
        >
          <div className="relative rounded-3xl bg-white border border-[#E7DFD0] p-8 sm:p-10 shadow-[0_24px_50px_-20px_rgba(100,85,60,0.08)]">
            
            {success ? (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                >
                  <CheckCircle2 className="w-16 h-16 text-[#5C9A70]" />
                </motion.div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">Workspace Activated!</h1>
                <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
                  Your team hub has been created under <span className="font-semibold text-slate-800">{orgName}</span>.
                </p>
                <div className="flex items-center gap-2 text-[12px] text-[#2f5d3f] bg-[#eef7f2] rounded-lg px-3 py-1.5 font-semibold">
                  <Loader2 className="w-4 h-4 animate-spin text-[#5C9A70]" />
                  Redirecting to dashboard...
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-[#f1f0fa] px-3 py-1 text-[11px] font-bold text-[#6B5CD6] tracking-wide uppercase">
                    <Sparkles className="h-3.5 w-3.5" /> Workspace Setup
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800 leading-tight">
                    Complete your workspace registration
                  </h1>
                  <p className="text-[14px] leading-relaxed text-slate-500">
                    You've successfully signed in with Google! Let's finalize your workspace subdomain and business details.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="p-3 text-sm font-semibold text-rose-600 bg-rose-50/70 border border-rose-100 rounded-xl"
                    >
                      {error}
                    </motion.div>
                  )}

                  <div className="space-y-1.5">
                    <label htmlFor="orgName" className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Workspace Name
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        id="orgName"
                        type="text"
                        placeholder="e.g. Acme Corp"
                        value={orgName}
                        onChange={(e) => handleOrgNameChange(e.target.value)}
                        className="w-full h-11 pl-9 pr-4 rounded-xl border border-slate-200 bg-slate-50/30 text-sm focus:outline-none focus:border-[#6B5CD6] focus:ring-2 focus:ring-[#6B5CD6]/10 transition"
                        required
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="orgSlug" className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Workspace Subdomain
                      </label>
                      <span className="text-[11px] text-slate-400 font-medium">URL-friendly slug</span>
                    </div>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        id="orgSlug"
                        type="text"
                        placeholder="e.g. acme"
                        value={orgSlug}
                        onChange={(e) => handleSlugChange(e.target.value)}
                        className="w-full h-11 pl-9 pr-4 rounded-xl border border-slate-200 bg-slate-50/30 text-sm focus:outline-none focus:border-[#6B5CD6] focus:ring-2 focus:ring-[#6B5CD6]/10 transition font-medium"
                        required
                        disabled={submitting}
                      />
                    </div>
                    {orgSlug && (
                      <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                        Your admin desk will be hosted at:{" "}
                        <span className="font-semibold text-slate-700">{orgSlug}.advan.ai</span>
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-11 rounded-xl bg-[#6B5CD6] hover:bg-[#5a4cb5] text-white font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-[#6B5CD6]/15 hover:shadow-lg hover:shadow-[#6B5CD6]/20 active:scale-[0.98] mt-6"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Provisioning assets...
                      </>
                    ) : (
                      <>
                        Complete Registration
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </form>
              </div>
            )}
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Secure Enterprise SLA &bull; 99.9% guaranteed uptime
          </div>
        </motion.div>
      </main>
    </div>
  )
}
