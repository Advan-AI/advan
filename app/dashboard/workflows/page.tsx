"use client"

import Link from "next/link"
import { LayoutGrid, Plus, PlayCircle, Pause, GitBranch } from "lucide-react"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"

const WORKFLOWS = [
  { name: "Webhook support v2",     status: "Live",   nodes: 8,  runs: "4.2k/wk", success: "98.4%" },
  { name: "Refund escalation flow", status: "Live",   nodes: 6,  runs: "1.1k/wk", success: "99.0%" },
  { name: "SSO onboarding",         status: "Draft",  nodes: 12, runs: "—",        success: "—" },
  { name: "Outage comms blast",     status: "Paused", nodes: 5,  runs: "0/wk",     success: "—" },
]

export default function WorkflowsPage() {
  return (
    <div>
      <DashPageHeader
        eyebrow="Automation"
        title="Workflows"
        subtitle="Pre-built and custom support flows wired into Advan. Edit any node, deploy in seconds."
        actions={
          <>
            <Link
              href="/dashboard/orchestration"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:dash-shadow-sm transition"
            >
              <GitBranch className="w-4 h-4" /> Open builder
            </Link>
            <button className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] hover:-translate-y-px transition">
              <Plus className="w-4 h-4" /> New workflow
            </button>
          </>
        }
      />

      <DashCard title="All workflows" icon={<LayoutGrid className="w-[18px] h-[18px]" />} padded={false}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
          {WORKFLOWS.map((w) => (
            <div
              key={w.name}
              className="rounded-xl border dash-border-soft bg-white p-4 hover:dash-shadow-sm transition"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg dash-bg-accent-wash flex items-center justify-center">
                  <GitBranch className="w-4 h-4 text-[var(--dash-accent-deep)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold text-[var(--dash-ink)] truncate">{w.name}</div>
                  <div className="text-[11px] text-[var(--dash-ink-faint)]">{w.nodes} nodes</div>
                </div>
                <span
                  className={`text-[10.5px] font-bold rounded-md px-1.5 py-0.5 ${
                    w.status === "Live"
                      ? "bg-[var(--dash-sage-wash)] text-[#2f5d3f]"
                      : w.status === "Draft"
                      ? "bg-[var(--dash-amber-wash)] text-[#8a5a1e]"
                      : "bg-[var(--dash-rose-wash)] text-[#8a3e3e]"
                  }`}
                >
                  {w.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-[11.5px]">
                <div>
                  <div className="text-[var(--dash-ink-faint)]">Runs</div>
                  <div className="font-bold text-[var(--dash-ink)]">{w.runs}</div>
                </div>
                <div>
                  <div className="text-[var(--dash-ink-faint)]">Success</div>
                  <div className="font-bold text-[var(--dash-sage)]">{w.success}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border dash-border bg-[var(--dash-card)] text-[12px] font-semibold text-[var(--dash-ink-soft)] hover:dash-shadow-sm transition">
                  {w.status === "Paused" ? <PlayCircle className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  {w.status === "Paused" ? "Resume" : "Pause"}
                </button>
                <Link
                  href="/dashboard/orchestration"
                  className="ml-auto text-[11.5px] font-bold text-[var(--dash-accent-deep)] hover:underline"
                >
                  Open →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </DashCard>
    </div>
  )
}
