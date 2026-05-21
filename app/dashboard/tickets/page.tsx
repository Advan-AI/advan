"use client"

import { useMemo, useState } from "react"
import { Filter, Plus, Search, Ticket } from "lucide-react"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"

type Status = "Open" | "AI Draft" | "Pending" | "Escalated" | "Resolved"
type Priority = "Low" | "Normal" | "High" | "Urgent"

const TICKETS: {
  id: string
  subject: string
  customer: string
  channel: string
  status: Status
  priority: Priority
  age: string
}[] = [
  { id: "TK-84219", subject: "Overcharge on May invoice",     customer: "Jenna Lee",  channel: "Email",  status: "AI Draft",  priority: "High",   age: "2m"  },
  { id: "TK-84211", subject: "Webhook signature rotation",    customer: "Marcus Hall", channel: "Slack",  status: "Open",      priority: "Urgent", age: "9m"  },
  { id: "TK-84203", subject: "SSO not provisioning new seats",customer: "Priya Shah",  channel: "Chat",   status: "Escalated", priority: "High",   age: "22m" },
  { id: "TK-84198", subject: "Refund processed — confirm",    customer: "Tom Becker",  channel: "Email",  status: "Resolved",  priority: "Normal", age: "47m" },
  { id: "TK-84190", subject: "Quarterly usage report export", customer: "Dana Romero", channel: "Web",    status: "Pending",   priority: "Low",    age: "1h"  },
  { id: "TK-84182", subject: "Enable EU residency",           customer: "Liam Patel",  channel: "Email",  status: "Open",      priority: "High",   age: "3h"  },
  { id: "TK-84171", subject: "Custom SLA escalation tier",    customer: "Mia Carter",  channel: "Chat",   status: "AI Draft",  priority: "Normal", age: "5h"  },
  { id: "TK-84160", subject: "Bulk seat reassignment",        customer: "Noah Chen",   channel: "Slack",  status: "Open",      priority: "Normal", age: "8h"  },
]

const STATUS_TONE: Record<Status, string> = {
  "Open":      "bg-[var(--dash-amber-wash)] text-[#8a5a1e]",
  "AI Draft":  "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]",
  "Pending":   "bg-[var(--dash-blue-wash)] text-[#244e8a]",
  "Escalated": "bg-[var(--dash-rose-wash)] text-[#8a3e3e]",
  "Resolved":  "bg-[var(--dash-sage-wash)] text-[#2f5d3f]",
}
const PRIORITY_TONE: Record<Priority, string> = {
  "Low":    "text-[var(--dash-ink-faint)]",
  "Normal": "text-[var(--dash-blue)]",
  "High":   "text-[var(--dash-amber)]",
  "Urgent": "text-[var(--dash-rose)]",
}

const STATUSES: Array<"All" | Status> = ["All", "Open", "AI Draft", "Pending", "Escalated", "Resolved"]

export default function TicketsPage() {
  const [filter, setFilter] = useState<"All" | Status>("All")
  const [q, setQ] = useState("")

  const rows = useMemo(() => {
    return TICKETS.filter((t) => {
      if (filter !== "All" && t.status !== filter) return false
      if (q && !`${t.id} ${t.subject} ${t.customer}`.toLowerCase().includes(q.toLowerCase())) return false
      return true
    })
  }, [filter, q])

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
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 dash-bg-card border dash-border rounded-lg px-2.5 py-1.5 w-[220px]">
              <Search className="w-3.5 h-3.5 text-[var(--dash-ink-faint)]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="bg-transparent outline-none text-[12px] text-[var(--dash-ink)] placeholder:text-[var(--dash-ink-faint)] w-full"
              />
            </div>
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
              className={`text-[11.5px] font-semibold rounded-md px-2.5 py-1 transition ${
                filter === s
                  ? "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]"
                  : "text-[var(--dash-ink-faint)] hover:text-[var(--dash-ink-soft)]"
              }`}
            >
              {s}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-[var(--dash-ink-faint)]">
            {rows.length} of {TICKETS.length}
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
                <Th>Age</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr
                  key={t.id}
                  className="border-t dash-border-soft hover:bg-[rgba(107,92,214,0.04)] transition cursor-pointer"
                >
                  <Td>
                    <div className="flex flex-col">
                      <span className="font-mono text-[10.5px] text-[var(--dash-ink-faint)]">{t.id}</span>
                      <span className="font-semibold text-[var(--dash-ink)]">{t.subject}</span>
                    </div>
                  </Td>
                  <Td className="text-[var(--dash-ink-soft)]">{t.customer}</Td>
                  <Td className="text-[var(--dash-ink-soft)]">{t.channel}</Td>
                  <Td>
                    <span className={`text-[11px] font-bold rounded-md px-2 py-1 ${STATUS_TONE[t.status]}`}>
                      {t.status}
                    </span>
                  </Td>
                  <Td className={`font-bold ${PRIORITY_TONE[t.priority]}`}>{t.priority}</Td>
                  <Td className="text-[var(--dash-ink-faint)]">{t.age}</Td>
                </tr>
              ))}
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
