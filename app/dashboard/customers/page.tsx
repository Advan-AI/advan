"use client"

import { useState } from "react"
import { Users, Plus, Search, Filter, ExternalLink } from "lucide-react"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"
import { api } from "@/lib/api/trpc-client"

const TIER_TONE: Record<string, string> = {
  enterprise: "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]",
  growth:     "bg-[var(--dash-blue-wash)] text-[#244e8a]",
  free:       "bg-[var(--dash-line)] text-[var(--dash-ink-faint)]",
}

export default function CustomersPage() {
  const [search, setSearch] = useState("")

  const { data: customers, isLoading } = api.customers.list.useQuery({
    search: search || undefined,
    limit: 50,
  })

  const enterpriseCount = customers?.filter((c) => c.tier === "enterprise").length ?? 0
  const total = customers?.length ?? 0

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
          { k: "Total customers", v: isLoading ? "—" : String(total) },
          { k: "Enterprise",      v: isLoading ? "—" : String(enterpriseCount) },
          { k: "NPS (90d)",       v: "62" },
          { k: "At risk",         v: "12" },
        ].map((c) => (
          <div key={c.k} className="dash-card p-4">
            <div className="text-[11.5px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">{c.k}</div>
            <div className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--dash-ink)]">{c.v}</div>
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
                <th className="px-4 py-2.5">Company</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-t dash-border-soft">
                      <td className="px-4 py-3"><div className="skeleton h-8 w-40 rounded" /></td>
                      <td className="px-4 py-3"><div className="skeleton h-5 w-20 rounded" /></td>
                      <td className="px-4 py-3"><div className="skeleton h-4 w-28 rounded" /></td>
                      <td className="px-4 py-3"><div className="skeleton h-4 w-36 rounded" /></td>
                      <td />
                    </tr>
                  ))
                : (customers ?? []).map((c) => (
                    <tr key={c.id} className="border-t dash-border-soft hover:bg-[rgba(107,92,214,0.04)] transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full dash-bg-deep flex items-center justify-center text-[11px] font-bold text-[var(--dash-ink-soft)]">
                            {(c.name ?? c.email).split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-[var(--dash-ink)]">{c.name ?? "—"}</div>
                            <div className="text-[11px] text-[var(--dash-ink-faint)]">{c.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-bold rounded-md px-2 py-0.5 capitalize ${TIER_TONE[c.tier ?? "free"]}`}>
                          {c.tier}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--dash-ink-soft)]">{c.company ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--dash-ink-soft)]">{c.email}</td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-[var(--dash-ink-faint)] hover:text-[var(--dash-accent)]">
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
              {!isLoading && (customers ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[13px] text-[var(--dash-ink-faint)]">
                    No customers yet. <button className="text-[var(--dash-accent-deep)] font-semibold hover:underline">Add one →</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DashCard>
    </div>
  )
}
