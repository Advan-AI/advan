"use client"

import { BookOpen, Plus, Search, Sparkles, FileText, FolderTree } from "lucide-react"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"

const COLLECTIONS = [
  { name: "Billing & Payments",  docs: 42, sourced: 3214, owner: "Sarah Johnson" },
  { name: "Webhooks & API",      docs: 78, sourced: 5421, owner: "Jordan Kim" },
  { name: "SSO / Identity",      docs: 26, sourced: 1480, owner: "Mia Carter" },
  { name: "Onboarding Playbooks",docs: 19, sourced:  812, owner: "Sarah Johnson" },
]

const RECENT = [
  { title: "Refund process — overcharge edge cases", updated: "Today", status: "Live" },
  { title: "Webhook signature rotation guide",       updated: "Yesterday", status: "Live" },
  { title: "EU residency configuration",             updated: "2d ago", status: "Draft" },
  { title: "SCIM error reference",                   updated: "4d ago", status: "Live" },
]

export default function KnowledgeBasePage() {
  return (
    <div>
      <DashPageHeader
        eyebrow="Library"
        title="Knowledge Base"
        subtitle="Every article the AI cites. Add, version, and audit sources from one place."
        actions={
          <>
            <button className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:dash-shadow-sm transition">
              <Sparkles className="w-4 h-4" /> Suggest from drafts
            </button>
            <button className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] hover:-translate-y-px transition">
              <Plus className="w-4 h-4" /> New article
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <DashCard title="Collections" icon={<FolderTree className="w-[18px] h-[18px]" />} padded={false}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
            {COLLECTIONS.map((c) => (
              <div
                key={c.name}
                className="rounded-xl border dash-border-soft bg-white p-3.5 hover:dash-shadow-sm hover:-translate-y-px transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-9 h-9 rounded-lg dash-bg-accent-wash flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-[var(--dash-accent-deep)]" />
                  </div>
                  <div>
                    <div className="font-bold text-[13.5px] text-[var(--dash-ink)]">{c.name}</div>
                    <div className="text-[11px] text-[var(--dash-ink-faint)]">{c.docs} articles · owner {c.owner}</div>
                  </div>
                </div>
                <div className="text-[11.5px] text-[var(--dash-ink-soft)]">
                  Cited <b className="text-[var(--dash-sage)]">{c.sourced.toLocaleString()}</b> times in the last 30 days.
                </div>
              </div>
            ))}
          </div>
        </DashCard>

        <DashCard
          title="Recent updates"
          icon={<FileText className="w-[18px] h-[18px]" />}
          right={
            <div className="flex items-center gap-2 dash-bg-card border dash-border rounded-lg px-2 py-1">
              <Search className="w-3.5 h-3.5 text-[var(--dash-ink-faint)]" />
              <input
                placeholder="Find…"
                className="bg-transparent outline-none text-[12px] text-[var(--dash-ink)] placeholder:text-[var(--dash-ink-faint)] w-[140px]"
              />
            </div>
          }
        >
          <ul className="divide-y dash-border-soft">
            {RECENT.map((r) => (
              <li key={r.title} className="py-2.5 flex items-center gap-3">
                <span className="w-8 h-8 rounded-md dash-bg-blue-wash flex items-center justify-center text-[var(--dash-blue)]">
                  <FileText className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13px] text-[var(--dash-ink)] truncate">{r.title}</div>
                  <div className="text-[11px] text-[var(--dash-ink-faint)]">Updated {r.updated}</div>
                </div>
                <span
                  className={`text-[10.5px] font-bold rounded-md px-1.5 py-0.5 ${
                    r.status === "Live"
                      ? "bg-[var(--dash-sage-wash)] text-[#2f5d3f]"
                      : "bg-[var(--dash-amber-wash)] text-[#8a5a1e]"
                  }`}
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        </DashCard>
      </div>
    </div>
  )
}
