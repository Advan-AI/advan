"use client"

import { useMemo, useState } from "react"
import { Filter, Plus, Search, Ticket } from "lucide-react"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"
import { api } from "@/lib/api/trpc-client"

type StatusFilter = "All" | "open" | "pending" | "resolved" | "closed"

const STATUS_TONE: Record<string, string> = {
  open:    "bg-[var(--dash-amber-wash)] text-[#8a5a1e]",
  pending: "bg-[var(--dash-blue-wash)] text-[#244e8a]",
  resolved:"bg-[var(--dash-sage-wash)] text-[#2f5d3f]",
  closed:  "bg-[var(--dash-line)] text-[var(--dash-ink-faint)]",
}
const PRIORITY_TONE: Record<string, string> = {
  low:    "text-[var(--dash-ink-faint)]",
  medium: "text-[var(--dash-blue)]",
  high:   "text-[var(--dash-amber)]",
  urgent: "text-[var(--dash-rose)]",
}
const STATUSES: StatusFilter[] = ["All", "open", "pending", "resolved", "closed"]

export default function TicketsPage() {
  const [filter, setFilter] = useState<StatusFilter>("All")
  const [q, setQ] = useState("")

  const { data, isLoading } = api.tickets.list.useQuery({
    status: filter === "All" ? undefined : filter,
    limit: 50,
  })

  const rows = useMemo(() => {
    if (!data?.tickets) return []
    if (!q) return data.tickets
    const lower = q.toLowerCase()
    return data.tickets.filter((r) =>
      `${r.ticket.subject} ${r.customer?.name ?? ""} ${r.ticket.id}`.toLowerCase().includes(lower)
    )
  }, [data, q])

  return (
    <div>
      <DashPageHeader
        eyebrow="Queue"
        title="Tickets"
        subtitle="Every channel, every customer, one queue. Filter, triage, and route in seconds."
        actions={
          <>
            <button className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:dash-shadow-sm transition">
              <Filter className="w-4 h-4" /> Filters
            </button>
            <button className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] hover:-translate-y-px transition">
              <Plus className="w-4 h-4" /> New ticket
            </button>
          </>
        }
      />

      <DashCard
        title="All tickets"
        icon={<Ticket className="w-[18px] h-[18px]" />}
        right={
          <div className="flex items-center gap-2 dash-bg-card border dash-border rounded-lg px-2.5 py-1.5 w-[220px]">
            <Search className="w-3.5 h-3.5 text-[var(--dash-ink-faint)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="bg-transparent outline-none text-[12px] text-[var(--dash-ink)] placeholder:text-[var(--dash-ink-faint)] w-full"
            />
          </div>
        }
        padded={false}
      >
        {/* Filter chips */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b dash-border-soft overflow-x-auto">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`text-[11.5px] font-semibold rounded-md px-2.5 py-1 transition capitalize ${
                filter === s
                  ? "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]"
                  : "text-[var(--dash-ink-faint)] hover:text-[var(--dash-ink-soft)]"
              }`}
            >
              {s}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-[var(--dash-ink-faint)]">
            {rows.length} {data?.total ? `of ${data.total}` : ""}
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="text-left text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">
              <tr>
                <Th>Ticket</Th>
                <Th>Customer</Th>
                <Th>Channel</Th>
                <Th>Status</Th>
                <Th>Priority</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-t dash-border-soft">
                      <Td><div className="skeleton h-4 w-48 rounded" /></Td>
                      <Td><div className="skeleton h-4 w-24 rounded" /></Td>
                      <Td><div className="skeleton h-4 w-16 rounded" /></Td>
                      <Td><div className="skeleton h-4 w-20 rounded" /></Td>
                      <Td><div className="skeleton h-4 w-16 rounded" /></Td>
                    </tr>
                  ))
                : rows.map((r) => (
                    <tr
                      key={r.ticket.id}
                      className="border-t dash-border-soft hover:bg-[rgba(107,92,214,0.04)] transition cursor-pointer"
                    >
                      <Td>
                        <div className="flex flex-col">
                          <span className="font-mono text-[10.5px] text-[var(--dash-ink-faint)]">
                            {r.ticket.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span className="font-semibold text-[var(--dash-ink)]">{r.ticket.subject}</span>
                        </div>
                      </Td>
                      <Td className="text-[var(--dash-ink-soft)]">{r.customer?.name ?? "—"}</Td>
                      <Td className="text-[var(--dash-ink-soft)] capitalize">{r.ticket.channel}</Td>
                      <Td>
                        <span className={`text-[11px] font-bold rounded-md px-2 py-1 capitalize ${STATUS_TONE[r.ticket.status] ?? ""}`}>
                          {r.ticket.status}
                        </span>
                      </Td>
                      <Td className={`font-bold capitalize ${PRIORITY_TONE[r.ticket.priority] ?? ""}`}>
                        {r.ticket.priority}
                      </Td>
                    </tr>
                  ))}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[13px] text-[var(--dash-ink-faint)]">
                    No tickets found.
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

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 font-bold">{children}</th>
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>
}
