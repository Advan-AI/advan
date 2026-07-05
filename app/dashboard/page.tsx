"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  ArrowUpRight,
  Sparkles,
  MessageSquare,
  Clock,
  Smile,
  CheckCircle2,
  Ticket,
} from "lucide-react"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist"
import { ReviewQueue } from "@/components/dashboard/review-queue"
import { AuditTrailCard } from "@/components/dashboard/audit-trail-card"
import { CountUp } from "@/components/count-up"
import { queueItems } from "@/lib/demo-fixtures"
import { api } from "@/lib/api/trpc-client"
import { useSession } from "next-auth/react"

export default function DashboardOverviewPage() {
  const { data: session } = useSession()
  const firstName = session?.user?.name?.split(" ")[0] ?? "there"

  const { data: kpis, isLoading: kpisLoading } = api.tickets.kpis.useQuery()

  const [queue, setQueue] = useState(queueItems)
  function approve(id: string) {
    setQueue((q) => q.filter((item) => item.id !== id))
  }

  return (
    <div>
      <DashPageHeader
        eyebrow="Workspace"
        title={`Good afternoon, ${firstName}`}
        subtitle="Here's how your support team and Advan AI are performing today."
        actions={
          <>
            <Link
              href="/dashboard/conversations"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:dash-shadow-sm transition"
            >
              <MessageSquare className="w-4 h-4" />
              Open conversations
            </Link>
            <Link
              href="/dashboard/copilot"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] hover:-translate-y-px transition"
            >
              <Sparkles className="w-4 h-4" />
              Launch Copilot
            </Link>
          </>
        }
      />

      <OnboardingChecklist />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard label="Tickets resolved" icon={CheckCircle2} loading={kpisLoading}>
          {kpis ? <CountUp value={kpis.resolved} duration={1.4} /> : "—"}
        </KpiCard>
        <KpiCard label="AI resolution rate" icon={Sparkles} loading={kpisLoading}>
          {kpis ? <CountUp value={kpis.aiResolutionRate} suffix="%" duration={1.4} /> : "—"}
        </KpiCard>
        <KpiCard label="Avg first response" icon={Clock} loading={false}>
          11s
        </KpiCard>
        <KpiCard label="CSAT" icon={Smile} loading={false}>
          4.86
        </KpiCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-4">
        <ReviewQueue items={queue} onApprove={approve} />

        <div className="flex flex-col gap-4">
          <DashCard title="Today's queue" icon={<Ticket className="w-[18px] h-[18px]" />}>
            <div className="space-y-3">
              {[
                { label: "Open", value: kpis?.open ?? "—", color: "var(--dash-amber)", wash: "var(--dash-amber-wash)" },
                { label: "Resolved", value: kpis?.resolved ?? "—", color: "var(--dash-sage)", wash: "var(--dash-sage-wash)" },
                { label: "AI resolved", value: kpis ? `${kpis.aiResolutionRate}%` : "—", color: "var(--dash-accent)", wash: "var(--dash-accent-wash)" },
                { label: "Awaiting human review", value: queue.length, color: "var(--dash-rose)", wash: "var(--dash-rose-wash)" },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full" style={{ background: row.color }} />
                  <span className="text-[13px] text-[var(--dash-ink-soft)] flex-1">{row.label}</span>
                  <span
                    className="text-[12px] font-bold rounded-md px-2 py-0.5"
                    style={{ background: row.wash, color: row.color }}
                  >
                    {kpisLoading && row.label !== "Awaiting human review" ? "—" : row.value}
                  </span>
                </div>
              ))}
            </div>
          </DashCard>

          <DashCard title="AI Copilot status" icon={<Sparkles className="w-[18px] h-[18px]" />}>
            <div className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-[var(--dash-ink-soft)]">Model</span>
                <span className="font-mono text-[12px] text-[var(--dash-ink)]">Advan-Trust v1.3</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--dash-ink-soft)]">Avg confidence</span>
                <span className="font-bold text-[var(--dash-sage)]">94%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--dash-ink-soft)]">Sources / answer</span>
                <span className="font-bold text-[var(--dash-ink)]">3.2</span>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[var(--dash-ink-soft)]">Confidence threshold</span>
                  <span className="font-mono text-[12px] font-bold text-[var(--dash-ink)]">85%</span>
                </div>
                <div className="h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: "85%", background: "linear-gradient(90deg, #C5883C, #5C9A70)" }}
                  />
                </div>
              </div>
              <Link
                href="/dashboard/tap-box"
                className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--dash-accent-deep)] hover:underline mt-1"
              >
                Inspect with Tap Box <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </DashCard>

          <AuditTrailCard />
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  icon: Icon,
  loading,
  children,
}: {
  label: string
  icon: React.ElementType
  loading: boolean
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="dash-card p-4 lift cursor-default"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-lg dash-bg-accent-wash flex items-center justify-center">
          <Icon className="w-4 h-4 text-[var(--dash-accent-deep)]" />
        </div>
        <span className="inline-flex items-center gap-0.5 text-[11px] font-bold rounded-md px-1.5 py-0.5 text-[#2f5d3f] bg-[var(--dash-sage-wash)]">
          <ArrowUpRight className="w-3 h-3" /> Live
        </span>
      </div>
      <div className="text-[11.5px] font-semibold uppercase tracking-wider text-[var(--dash-ink-faint)]">
        {label}
      </div>
      {loading ? (
        <div className="skeleton h-7 w-16 rounded mt-1" />
      ) : (
        <div className="mt-0.5 text-[24px] font-bold tracking-tight text-[var(--dash-ink)]">
          {children}
        </div>
      )}
    </motion.div>
  )
}
