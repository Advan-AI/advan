"use client"

import { Users, Plus, Search, Filter, ExternalLink } from "lucide-react"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"

const ROWS = [
  { name: "Jenna Lee",   org: "Acme Corp",       plan: "Enterprise", mrr: "$4,200", csat: "4.9", owner: "Jordan Kim",   last: "2m ago" },
  { name: "Marcus Hall", org: "Northwind",       plan: "Growth",     mrr: "$1,400", csat: "4.6", owner: "Sarah Johnson",last: "9m ago" },
  { name: "Priya Shah",  org: "Helio Robotics",  plan: "Enterprise", mrr: "$7,800", csat: "4.8", owner: "Sarah Johnson",last: "22m ago" },
  { name: "Tom Becker",  org: "Lattice Labs",    plan: "Growth",     mrr: "$1,200", csat: "5.0", owner: "Jordan Kim",   last: "47m ago" },
  { name: "Dana Romero", org: "Veridian Inc",    plan: "Enterprise", mrr: "$11,400",csat: "4.7", owner: "Mia Carter",   last: "1h ago" },
  { name: "Liam Patel",  org: "Stratify",        plan: "Enterprise", mrr: "$9,100", csat: "4.5", owner: "Jordan Kim",   last: "3h ago" },
]

export default function CustomersPage() {
  return (
    <div>
      <DashPageHeader
        eyebrow="Directory"
        title="Customers"
        subtitle="Cross-channel memory of every customer, account owner, and live signal."
        actions={
          <>
            <button className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:dash-shadow-sm transition">
              <Filter className="w-4 h-4" /> Filters
            </button>
            <button className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] hover:-translate-y-px transition">
              <Plus className="w-4 h-4" /> Add customer
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {[
          { k: "Total customers", v: "1,284", sub: "+38 this month" },
          { k: "Enterprise", v: "168", sub: "13% of base" },
          { k: "NPS (90d)", v: "62", sub: "+11 vs last quarter" },
          { k: "At risk", v: "12", sub: "2 escalated" },
        ].map((c) => (
          <div key={c.k} className="dash-card p-4">
            <div className="text-[11.5px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">{c.k}</div>
            <div className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--dash-ink)]">{c.v}</div>
            <div className="text-[11.5px] text-[var(--dash-ink-soft)]">{c.sub}</div>
          </div>
        ))}
      </div>

      <DashCard
        title="All customers"
        icon={<Users className="w-[18px] h-[18px]" />}
        right={
          <div className="flex items-center gap-2 dash-bg-card border dash-border rounded-lg px-2.5 py-1.5 w-[220px]">
            <Search className="w-3.5 h-3.5 text-[var(--dash-ink-faint)]" />
            <input
              placeholder="Search…"
              className="bg-transparent outline-none text-[12px] text-[var(--dash-ink)] placeholder:text-[var(--dash-ink-faint)] w-full"
            />
          </div>
        }
        padded={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="text-left text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">
              <tr>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Plan</th>
                <th className="px-4 py-2.5">MRR</th>
                <th className="px-4 py-2.5">CSAT</th>
                <th className="px-4 py-2.5">Owner</th>
                <th className="px-4 py-2.5">Last touch</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.name} className="border-t dash-border-soft hover:bg-[rgba(107,92,214,0.04)] transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full dash-bg-deep flex items-center justify-center text-[11px] font-bold text-[var(--dash-ink-soft)]">
                        {r.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <div className="font-bold text-[var(--dash-ink)]">{r.name}</div>
                        <div className="text-[11px] text-[var(--dash-ink-faint)]">{r.org}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[11px] font-bold rounded-md px-2 py-0.5 ${
                        r.plan === "Enterprise"
                          ? "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]"
                          : "bg-[var(--dash-blue-wash)] text-[#244e8a]"
                      }`}
                    >
                      {r.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[var(--dash-ink)]">{r.mrr}</td>
                  <td className="px-4 py-3 font-bold text-[var(--dash-sage)]">{r.csat}</td>
                  <td className="px-4 py-3 text-[var(--dash-ink-soft)]">{r.owner}</td>
                  <td className="px-4 py-3 text-[var(--dash-ink-faint)]">{r.last}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-[var(--dash-ink-faint)] hover:text-[var(--dash-accent)]">
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashCard>
    </div>
  )
}
