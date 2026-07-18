"use client"

import { DashboardOverview } from "@/components/dashboard/overview"

export default function DashboardOverviewPage() {
  return <DashboardOverview />
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
