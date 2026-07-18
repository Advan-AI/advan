"use client"

import { useState } from "react"
import {
  CreditCard,
  Crown,
  Users,
  MessageSquare,
  ChevronRight,
  ExternalLink,
  FileText,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  HelpCircle,
} from "lucide-react"
import { toast } from "sonner"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"
import { api } from "@/lib/api/trpc-client"

interface Plan {
  id: string
  key: string
  name: string
  seatLimit: number
  includedMessages: number
  monthlyPriceCents: number
  stripePriceId: string
  stripeMeteredPriceId: string
}

export default function BillingPage() {
  const utils = api.useUtils()
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [confirmingChange, setConfirmingChange] = useState(false)
  const [loadingPortal, setLoadingPortal] = useState(false)

  // tRPC Queries
  const { data: info, isLoading: loadingInfo, error: infoError } = api.billing.getBillingInfo.useQuery()
  const { data: plansList, isLoading: loadingPlans } = api.billing.listPlans.useQuery()
  const { data: invoices, isLoading: loadingInvoices } = api.billing.getInvoiceHistory.useQuery()

  // tRPC Mutations
  const changePlanMutation = api.billing.changeSubscriptionPlan.useMutation({
    onSuccess: (data) => {
      if (data?.checkoutUrl) {
        toast.loading("Redirecting to Stripe Checkout...")
        window.location.href = data.checkoutUrl
        return
      }
      toast.success("Subscription tier upgraded successfully!")
      setConfirmingChange(false)
      setSelectedPlan(null)
      utils.billing.getBillingInfo.invalidate()
    },
    onError: (err) => {
      toast.error(err.message || "Failed to change subscription plan. Please try again.")
    },
  })

  const getPortalSessionQuery = api.billing.getPortalSession.useQuery(undefined, {
    enabled: false,
  })

  const handleManagePayment = async () => {
    try {
      setLoadingPortal(true)
      const res = await getPortalSessionQuery.refetch()
      if (res.data?.url) {
        window.location.href = res.data.url
      }
    } catch (err) {
      console.error("Failed to load customer portal session:", err)
      toast.error("Failed to open billing portal. Please try again.")
    } finally {
      setLoadingPortal(false)
    }
  }

  const handleSelectPlan = (plan: Plan) => {
    if (plan.id === info?.currentPlan?.id) return
    setSelectedPlan(plan)
    setConfirmingChange(true)
  }

  const handleConfirmPlanChange = async () => {
    if (!selectedPlan) return
    try {
      await changePlanMutation.mutateAsync({ planKey: selectedPlan.key })
    } catch (err) {
      // Handled by mutation's onError hook
    }
  }

  if (loadingInfo || loadingPlans) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--dash-accent)]" />
        <p className="text-[13.5px] text-[var(--dash-ink-soft)] font-medium">Loading subscription details...</p>
      </div>
    )
  }

  if (infoError || !info) {
    return (
      <div className="p-6 text-center max-w-md mx-auto">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-[var(--dash-ink)]">Billing Data Unavailable</h3>
        <p className="text-[13px] text-[var(--dash-ink-soft)] mt-1 mb-4">
          There was an error loading your organization's subscription details. Please try again.
        </p>
        <button
          onClick={() => utils.billing.getBillingInfo.invalidate()}
          className="px-4 py-1.5 rounded-lg bg-[var(--dash-accent)] text-white text-[13px] font-semibold"
        >
          Retry
        </button>
      </div>
    )
  }

  const { org, currentPlan, seatsUsed, messagesUsed, overageCostCents, overageRateCents, currentPeriodStart, currentPeriodEnd } = info

  // Compute trial statistics
  const isTrialing = org.subscriptionStatus === "trialing"
  const isPastDue = org.subscriptionStatus === "past_due"
  let trialDaysRemaining = 0
  if (org.trialEndsAt) {
    const end = new Date(org.trialEndsAt).getTime()
    const diff = end - Date.now()
    trialDaysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  const trialEndsDateFormatted = org.trialEndsAt
    ? new Date(org.trialEndsAt).toLocaleDateString(undefined, { dateStyle: "medium" })
    : null

  const percentSeats = currentPlan ? Math.min(100, (seatsUsed / currentPlan.seatLimit) * 100) : 0
  const percentMessages = currentPlan ? Math.min(100, (messagesUsed / currentPlan.includedMessages) * 100) : 0

  return (
    <div className="space-y-6">
      <DashPageHeader
        eyebrow="Billing & Plan"
        title="Workspace billing"
        subtitle="Manage your subscription, seat licensing limits, AI message usage thresholds, and invoice history."
        actions={
          <button
            onClick={handleManagePayment}
            disabled={loadingPortal}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-[13px] font-semibold text-white bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] hover:-translate-y-px transition disabled:opacity-75"
          >
            {loadingPortal ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
            Stripe Customer Portal
          </button>
        }
      />

      {/* Trial / Past-Due Alert Banners */}
      {isTrialing && (
        <div className="p-4 rounded-xl border border-blue-200/50 bg-blue-50/70 dark:bg-blue-950/20 backdrop-blur-sm text-blue-900 dark:text-blue-200 flex items-center gap-3 shadow-sm">
          <span className="text-xl">💡</span>
          <div className="text-[13px] leading-relaxed">
            <span className="font-bold">Trial Account:</span> You are currently in a 14-day free trial. There are{" "}
            <span className="font-semibold underline">{trialDaysRemaining} days remaining</span> before your card will be charged. You can add a payment method or change tiers anytime in the Customer Portal.
          </div>
        </div>
      )}

      {isPastDue && (
        <div className="p-4 rounded-xl border border-rose-200/50 bg-rose-50/70 dark:bg-rose-950/20 backdrop-blur-sm text-rose-900 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500" />
            <div className="text-[13px] leading-relaxed">
              <span className="font-bold">Subscription Past Due:</span> Your payment has failed. Non-essential features (Knowledge Base and workflows) are locked until payment details are updated.
            </div>
          </div>
          <button
            onClick={handleManagePayment}
            className="shrink-0 text-center text-[12px] font-bold px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors"
          >
            Update Payment Details
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Plan Overview Card */}
        <DashCard
          title="Current Subscription"
          icon={<Crown className="w-[18px] h-[18px] text-[var(--dash-accent)]" />}
          className="lg:col-span-1"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--dash-ink-faint)]">Plan Tier</div>
                <div className="text-[17px] font-black text-[var(--dash-ink)] tracking-tight capitalize mt-0.5 flex flex-wrap items-center gap-1.5 leading-tight">
                  {currentPlan?.name ?? "No Plan active"}
                  {currentPlan?.key === "pro" && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/50">
                      ⚡ Popular
                    </span>
                  )}
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1 shrink-0 ${
                org.subscriptionStatus === "active"
                  ? "bg-[var(--dash-sage-wash)] text-[#2f5d3f] border border-[rgba(47,93,63,0.15)]"
                  : org.subscriptionStatus === "trialing"
                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                    : "bg-rose-100 text-rose-700 border border-rose-200"
              }`}>
                {org.subscriptionStatus === "active" && <span className="w-1.5 h-1.5 rounded-full bg-[#2f5d3f] animate-pulse" />}
                {org.subscriptionStatus === "trialing" && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                {org.subscriptionStatus}
              </span>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--dash-ink-faint)]">Pricing</div>
              <div className="text-2xl font-black text-[var(--dash-ink)] tracking-tight mt-0.5">
                ${currentPlan ? (currentPlan.monthlyPriceCents / 100).toFixed(2) : "0.00"}
                <span className="text-[12px] font-medium text-[var(--dash-ink-soft)]">/month</span>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--dash-ink-faint)]">Billing Cycle</div>
              <div className="text-[12.5px] font-semibold text-[var(--dash-ink-soft)] mt-0.5 leading-relaxed">
                {new Date(currentPeriodStart).toLocaleDateString(undefined, { dateStyle: "medium" })} to {new Date(currentPeriodEnd).toLocaleDateString(undefined, { dateStyle: "medium" })}
              </div>
            </div>

            {/* Trial Information Section */}
            {org.trialEndsAt && (
              <div className="pt-3.5 border-t border-[rgba(0,0,0,0.06)] space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--dash-ink-faint)]">Trial Details</div>
                <div className="grid grid-cols-2 gap-2 bg-black/[0.02] dark:bg-white/[0.02] p-2.5 rounded-lg border border-[rgba(0,0,0,0.04)]">
                  <div>
                    <div className="text-[10px] text-[var(--dash-ink-soft)] font-medium">Expire Date</div>
                    <div className="text-[12px] font-bold text-[var(--dash-ink)] mt-0.5">
                      {trialEndsDateFormatted}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--dash-ink-soft)] font-medium">Days Left</div>
                    <div className={`text-[12px] font-bold mt-0.5 ${
                      org.subscriptionStatus === "trialing"
                        ? trialDaysRemaining <= 3 ? "text-rose-600 animate-pulse" : "text-amber-600"
                        : "text-[var(--dash-ink-soft)]"
                    }`}>
                      {org.subscriptionStatus === "trialing" 
                        ? `${trialDaysRemaining} days` 
                        : "Trial converted"
                      }
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DashCard>

        {/* Usage Gauges Card */}
        <DashCard
          title="Resource Limits & Metering"
          icon={<Users className="w-[18px] h-[18px]" />}
          className="lg:col-span-2"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Seat Count Usage */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-bold text-[var(--dash-ink)]">Seats Used</div>
                  <div className="text-[11px] text-[var(--dash-ink-soft)]">Hard limit cap (Upgrade required to add users)</div>
                </div>
                <div className="text-right">
                  <div className="text-[14px] font-black text-[var(--dash-ink)]">
                    {seatsUsed} <span className="text-[var(--dash-ink-faint)]">/ {currentPlan?.seatLimit ?? 0}</span>
                  </div>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-black/[0.05] overflow-hidden">
                <div
                  style={{ width: `${percentSeats}%` }}
                  className={`h-full rounded-full transition-all duration-500 ${
                    percentSeats >= 90 ? "bg-amber-500" : "bg-[#6B5CD6]"
                  }`}
                />
              </div>
              {currentPlan && seatsUsed >= currentPlan.seatLimit && (
                <p className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Seat limit reached. Switch plans below to invite more team members.
                </p>
              )}
            </div>

            {/* AI Message Usage */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-bold text-[var(--dash-ink)]">AI Conversations Metered</div>
                  <div className="text-[11px] text-[var(--dash-ink-soft)]">Soft limit (Overage charged per extra message)</div>
                </div>
                <div className="text-right">
                  <div className="text-[14px] font-black text-[var(--dash-ink)]">
                    {messagesUsed} <span className="text-[var(--dash-ink-faint)]">/ {currentPlan?.includedMessages ?? 0}</span>
                  </div>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-black/[0.05] overflow-hidden">
                <div
                  style={{ width: `${percentMessages}%` }}
                  className={`h-full rounded-full transition-all duration-500 ${
                    messagesUsed > (currentPlan?.includedMessages ?? 0) ? "bg-rose-500" : "bg-[#6B5CD6]"
                  }`}
                />
              </div>
              
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                <div className="text-[11.5px] font-semibold text-[var(--dash-ink-soft)]">
                  Overage Rate: ${(overageRateCents / 100).toFixed(2)}/msg
                </div>
                <div className="text-[12.5px] font-black text-[var(--dash-ink)]">
                  Accrued overage: <span className={overageCostCents > 0 ? "text-rose-600" : "text-[var(--dash-ink-soft)]"}>
                    ${(overageCostCents / 100).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </DashCard>
      </div>

      {/* Available plans grid */}
      <div>
        <div className="text-[14px] font-bold text-[var(--dash-ink)] mb-3">Available Workspace Tiers</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plansList?.map((plan) => {
            const isCurrent = plan.id === currentPlan?.id
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-xl border p-5 transition-all ${
                  isCurrent
                    ? "border-[2px] border-[var(--dash-accent)] bg-[rgba(107,92,214,0.03)]"
                    : "border-[rgba(0,0,0,0.08)] bg-white hover:dash-shadow-sm"
                }`}
              >
                {isCurrent && (
                  <span className="absolute -top-3 left-4 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide bg-[var(--dash-accent)] text-white rounded-full px-2.5 py-0.5">
                    Current Plan
                  </span>
                )}
                <div className="text-[15px] font-extrabold capitalize text-[var(--dash-ink)]">{plan.name}</div>
                <div className="flex items-baseline mt-2">
                  <span className="text-3xl font-black text-[var(--dash-ink)] tracking-tight">
                    ${(plan.monthlyPriceCents / 100).toFixed(0)}
                  </span>
                  <span className="text-[12px] font-semibold text-[var(--dash-ink-soft)] ml-1">/month</span>
                </div>

                <ul className="space-y-2 mt-5 mb-6 text-[12.5px] font-medium text-[var(--dash-ink-soft)] flex-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--dash-accent)]" />
                    <span>Up to <strong className="font-semibold text-[var(--dash-ink)]">{plan.seatLimit} seats</strong> included</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--dash-accent)]" />
                    <span><strong className="font-semibold text-[var(--dash-ink)]">{plan.includedMessages}</strong> monthly AI messages</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--dash-accent)]" />
                    <span>${(overageRateCents / 100).toFixed(2)} / extra AI conversation</span>
                  </li>
                </ul>

                <button
                  onClick={() => handleSelectPlan(plan)}
                  disabled={isCurrent}
                  className={`w-full h-9 rounded-lg text-[13px] font-bold transition-all ${
                    isCurrent
                      ? "bg-black/[0.05] text-[var(--dash-ink-soft)] cursor-default"
                      : "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)] hover:bg-[var(--dash-accent)] hover:text-white"
                  }`}
                >
                  {isCurrent ? "Active Tier" : `Switch to ${plan.name}`}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Invoice History */}
      <DashCard title="Billing & Invoice History" icon={<FileText className="w-[18px] h-[18px]" />} padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px] font-medium text-[var(--dash-ink-soft)]">
            <thead>
              <tr className="border-b border-black/[0.05] text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {loadingInvoices ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[var(--dash-ink-faint)]">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[var(--dash-accent)]" /> Loading invoices...
                  </td>
                </tr>
              ) : invoices && invoices.length > 0 ? (
                invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-black/[0.03] hover:bg-black/[0.01] transition-all">
                    <td className="py-3.5 px-4 font-bold text-[var(--dash-ink)]">{inv.number}</td>
                    <td className="py-3.5 px-4">{new Date(inv.created * 1000).toLocaleDateString()}</td>
                    <td className="py-3.5 px-4 text-[var(--dash-ink)] font-semibold">${(inv.total / 100).toFixed(2)}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-extrabold uppercase tracking-wide ${
                        inv.status === "paid" ? "bg-[var(--dash-sage-wash)] text-[#2f5d3f]" : "bg-amber-100 text-amber-700"
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {inv.pdfUrl ? (
                        <a
                          href={inv.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[12.5px] font-bold text-[var(--dash-accent-deep)] hover:underline"
                        >
                          PDF <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-[12.5px] text-[var(--dash-ink-faint)]">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[var(--dash-ink-faint)]">
                    No past invoices found under this workspace customer account.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DashCard>

      {/* Confirmation Modal */}
      {confirmingChange && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="dash-card max-w-md w-full p-6 space-y-4 animate-scaleIn">
            <div className="flex items-center gap-2.5 pb-2 border-b border-black/[0.05]">
              <Crown className="w-[18px] h-[18px] text-[var(--dash-accent)]" />
              <h3 className="text-[16px] font-extrabold text-[var(--dash-ink)]">Confirm Tier Transition</h3>
            </div>

            <div className="text-[13.5px] text-[var(--dash-ink-soft)] leading-relaxed space-y-3">
              <p>
                You are switching your workspace plan from <strong className="font-bold text-[var(--dash-ink)] capitalize">{currentPlan?.name}</strong> to{" "}
                <strong className="font-bold text-[var(--dash-ink)] capitalize">{selectedPlan.name}</strong>.
              </p>
              <div className="p-3 bg-[var(--dash-accent-wash)] rounded-lg text-[12.5px] font-semibold text-[var(--dash-accent-deep)] space-y-2">
                <div className="font-bold uppercase tracking-wider text-[11px] opacity-75">Stripe Mid-Cycle Prorations:</div>
                <p className="font-normal leading-relaxed opacity-95">
                  Stripe automatically computes prorated credits for any unused days in your current cycle and adds charges for your new tier. Your next invoice will reflect these changes dynamically.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => {
                  setConfirmingChange(false)
                  setSelectedPlan(null)
                }}
                disabled={changePlanMutation.isPending}
                className="px-4 py-1.5 rounded-lg border border-black/[0.1] text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:bg-black/[0.02] transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPlanChange}
                disabled={changePlanMutation.isPending}
                className="px-4 py-1.5 rounded-lg bg-[var(--dash-accent)] text-white text-[13px] font-semibold hover:opacity-90 transition disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {changePlanMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Upgrade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
