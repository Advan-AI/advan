"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
  ArrowUpRight,
  Sparkles,
  MessageSquare,
  Clock,
  Smile,
  CheckCircle2,
  Activity,
  Ticket,
} from "lucide-react"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"
import { api } from "@/lib/api/trpc-client"
import { useSession } from "next-auth/react"

const STATUS_TONE: Record<string, string> = {
  open:    "bg-[var(--dash-amber-wash)] text-[#8a5a1e]",
  pending: "bg-[var(--dash-blue-wash)] text-[#244e8a]",
  resolved:"bg-[var(--dash-sage-wash)] text-[#2f5d3f]",
  closed:  "bg-[var(--dash-line)] text-[var(--dash-ink-faint)]",
}

export default function DashboardOverviewPage() {
  const { data: session } = useSession()
  const firstName = session?.user?.name?.split(" ")[0] ?? "there"

  const { data: kpis, isLoading: kpisLoading } = api.tickets.kpis.useQuery()
  const { data: recentData, isLoading: recentLoading } = api.tickets.list.useQuery({
    limit: 5,
  })

  const STATS = [
    { label: "Tickets resolved", value: kpis ? String(kpis.resolved) : "—", icon: CheckCircle2 },
    { label: "AI resolution rate", value: kpis ? `${kpis.aiResolutionRate}%` : "—", icon: Sparkles },
    { label: "Avg first response", value: "11s", icon: Clock },
    { label: "CSAT", value: "4.86", icon: Smile },
  ]

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

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {STATS.map((s, i) => {
          const Icon = s.icon
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
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
                {s.label}
              </div>
              {kpisLoading ? (
                <div className="skeleton h-7 w-16 rounded mt-1" />
              ) : (
                <div className="mt-0.5 text-[24px] font-bold tracking-tight text-[var(--dash-ink)]">
                  {s.value}
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
        <DashCard
          title="Recent activity"
          icon={<Activity className="w-[18px] h-[18px]" />}
          right={
            <Link href="/dashboard/tickets" className="text-[12px] font-semibold text-[var(--dash-accent-deep)] hover:underline">
              View all
            </Link>
          }
          padded={false}
        >
          <ul>
            {recentLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-3 border-b dash-border-soft">
                    <div className="skeleton w-8 h-8 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-3.5 w-32 rounded" />
                      <div className="skeleton h-3 w-48 rounded" />
                    </div>
                  </li>
                ))
              : (recentData?.tickets ?? []).map((row) => (
                  <li
                    key={row.ticket.id}
                    className="flex items-center gap-3 px-4 py-3 border-b dash-border-soft last:border-b-0 hover:bg-[rgba(107,92,214,0.04)] transition"
                  >
                    <div className="w-8 h-8 rounded-full dash-bg-deep flex items-center justify-center text-[11px] font-bold text-[var(--dash-ink-soft)]">
                      {(row.customer?.name ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-[var(--dash-ink)] truncate">
                          {row.customer?.name ?? "Unknown"}
                        </span>
                      </div>
                      <div className="text-[12.5px] text-[var(--dash-ink-soft)] truncate">
                        {row.ticket.subject}
                      </div>
                    </div>
                    <span className={`text-[11px] font-bold rounded-md px-2 py-1 ${STATUS_TONE[row.ticket.status] ?? ""}`}>
                      {row.ticket.status}
                    </span>
                  </li>
                ))}
          </ul>
        </DashCard>

        <div className="flex flex-col gap-4">
          <DashCard title="Today's queue" icon={<Ticket className="w-[18px] h-[18px]" />}>
            <div className="space-y-3">
              {[
                { label: "Open",       value: kpis?.open ?? "—",     color: "var(--dash-amber)", wash: "var(--dash-amber-wash)" },
                { label: "Resolved",   value: kpis?.resolved ?? "—", color: "var(--dash-sage)",  wash: "var(--dash-sage-wash)" },
                { label: "AI resolved",value: kpis ? `${kpis.aiResolutionRate}%` : "—", color: "var(--dash-accent)", wash: "var(--dash-accent-wash)" },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full" style={{ background: row.color }} />
                  <span className="text-[13px] text-[var(--dash-ink-soft)] flex-1">{row.label}</span>
                  <span className="text-[12px] font-bold rounded-md px-2 py-0.5" style={{ background: row.wash, color: row.color }}>
                    {kpisLoading ? "—" : row.value}
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
              <Link
                href="/dashboard/tap-box"
                className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--dash-accent-deep)] hover:underline mt-1"
              >
                Inspect with Tap Box <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </DashCard>
        </div>
      </div>
    </div>
  )
}
