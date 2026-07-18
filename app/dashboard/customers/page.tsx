"use client"

import { type ReactNode, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Crown,
  ExternalLink,
  Filter,
  Loader2,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserRound,
  Users,
  X,
} from "lucide-react"
import { DashCard, DashPageHeader } from "@/components/dashboard/page-header"
import { api } from "@/lib/api/trpc-client"
import { formatRelativeTime, getInitials } from "@/lib/dashboard/format"
import { cn } from "@/lib/utils"

type Tier = "free" | "growth" | "enterprise"
type TierFilter = "all" | Tier
type SortCol = "name" | "company" | "tier" | "tickets" | "csat" | "createdAt"
type SortDir = "asc" | "desc"
type TicketStatus = "open" | "pending" | "resolved" | "closed"
type TicketPriority = "low" | "medium" | "high" | "urgent"

type Customer = {
  id: string
  email: string
  name: string | null
  company: string | null
  tier: Tier
  totalTickets: number
  csatAvg: string | null
  stripeCustomerId: string | null
  createdAt: string | Date
}

type CustomerTicket = {
  id: string
  subject: string
  status: TicketStatus
  priority: TicketPriority
  channel: "email" | "chat" | "voice" | "slack" | "portal"
  aiResolved: boolean
  confidenceScore: number | null
  createdAt: string | Date
  updatedAt: string | Date
}

type CreateCustomerDraft = {
  email: string
  name: string
  company: string
  tier: Tier
  stripeCustomerId: string
}

const PAGE_SIZE = 100
const TIERS: Tier[] = ["enterprise", "growth", "free"]

const TIER_TONE: Record<Tier, string> = {
  enterprise: "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]",
  growth: "bg-[var(--dash-blue-wash)] text-[#244e8a]",
  free: "bg-[var(--dash-line)] text-[var(--dash-ink-faint)]",
}

const PRIORITY_TONE: Record<TicketPriority, string> = {
  low: "bg-[var(--dash-line-soft)] text-[var(--dash-ink-faint)]",
  medium: "bg-[var(--dash-blue-wash)] text-[#244e8a]",
  high: "bg-[var(--dash-amber-wash)] text-[#8a5a1e]",
  urgent: "bg-[var(--dash-rose-wash)] text-[var(--dash-rose)]",
}

const STATUS_TONE: Record<TicketStatus, string> = {
  open: "bg-[var(--dash-amber-wash)] text-[#8a5a1e]",
  pending: "bg-[var(--dash-blue-wash)] text-[#244e8a]",
  resolved: "bg-[var(--dash-sage-wash)] text-[#2f5d3f]",
  closed: "bg-[var(--dash-line-soft)] text-[var(--dash-ink-faint)]",
}
const FIELD_CLASS =
  "h-10 w-full rounded-lg border dash-border bg-white px-3 text-[13px] text-[var(--dash-ink)] outline-none transition placeholder:text-[var(--dash-ink-faint)] focus:border-[#9D91EA] focus:ring-2 focus:ring-[#6B5CD6]/15"

export default function CustomersPage() {
  const utils = api.useUtils()
  const [search, setSearch] = useState("")
  const [tierFilter, setTierFilter] = useState<TierFilter>("all")
  const [sortCol, setSortCol] = useState<SortCol>("createdAt")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [activeId, setActiveId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [draft, setDraft] = useState<CreateCustomerDraft>({
    email: "",
    name: "",
    company: "",
    tier: "free",
    stripeCustomerId: "",
  })

  const customersQuery = api.customers.list.useQuery(
    {
      search: search.trim() || undefined,
      tier: tierFilter === "all" ? undefined : tierFilter,
      limit: PAGE_SIZE,
    },
    { staleTime: 20_000 },
  )

  const customers = useMemo(() => ((customersQuery.data ?? []) as Customer[]), [customersQuery.data])
  const sortedCustomers = useMemo(() => sortCustomers(customers, sortCol, sortDir), [customers, sortCol, sortDir])
  const activeCustomer = sortedCustomers.find((customer) => customer.id === activeId) ?? sortedCustomers[0] ?? null

  const historyQuery = api.customers.getHistory.useQuery(
    { customerId: activeCustomer?.id ?? "" },
    { enabled: Boolean(activeCustomer?.id), staleTime: 20_000 },
  )
  const history = (historyQuery.data ?? []) as CustomerTicket[]

  const createCustomer = api.customers.create.useMutation({
    onSuccess: async (customer) => {
      toast.success("Customer added")
      setCreateOpen(false)
      setDraft({ email: "", name: "", company: "", tier: "free", stripeCustomerId: "" })
      setActiveId(customer.id)
      await utils.customers.list.invalidate()
    },
    onError: (error) => toast.error(error.message || "Could not add customer"),
  })

  const stats = useMemo(() => {
    const total = customers.length
    const enterprise = customers.filter((customer) => customer.tier === "enterprise").length
    const avgCsat = averageCsat(customers)
    const atRisk = customers.filter((customer) => isAtRisk(customer)).length
    const ticketCount = customers.reduce((sum, customer) => sum + (customer.totalTickets ?? 0), 0)
    return { total, enterprise, avgCsat, atRisk, ticketCount }
  }, [customers])

  useEffect(() => {
    if (!sortedCustomers.some((customer) => customer.id === activeId)) {
      setActiveId(sortedCustomers[0]?.id ?? null)
    }
  }, [sortedCustomers, activeId])

  async function refresh() {
    await Promise.all([
      utils.customers.list.invalidate(),
      utils.customers.getHistory.invalidate(),
    ])
    toast.success("Customer directory refreshed")
  }

  function toggleSort(column: SortCol) {
    if (sortCol === column) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"))
    } else {
      setSortCol(column)
      setSortDir(column === "name" || column === "company" ? "asc" : "desc")
    }
  }

  function submitCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = draft.email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid customer email")
      return
    }
    createCustomer.mutate({
      email,
      name: draft.name.trim() || undefined,
      company: draft.company.trim() || undefined,
      tier: draft.tier,
      stripeCustomerId: draft.stripeCustomerId.trim() || undefined,
    })
  }

  return (
    <div>
      <DashPageHeader
        eyebrow="Directory"
        title="Customers"
        subtitle="A live account directory for support history, customer health, plan context, and AI-ready handoff signals."
        actions={
          <>
            <button
              type="button"
              onClick={refresh}
              disabled={customersQuery.isFetching}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border dash-border bg-[var(--dash-card)] px-3.5 text-[13px] font-semibold text-[var(--dash-ink-soft)] transition hover:dash-shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={cn("h-4 w-4", customersQuery.isFetching && "animate-spin")} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] px-4 text-[13px] font-semibold text-white shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] transition hover:-translate-y-px"
            >
              <Plus className="h-4 w-4" />
              Add customer
            </button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Customers" value={customersQuery.isLoading ? "—" : stats.total} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Enterprise" value={customersQuery.isLoading ? "—" : stats.enterprise} icon={<Crown className="h-4 w-4" />} tone="accent" />
        <StatCard label="Tickets" value={customersQuery.isLoading ? "—" : stats.ticketCount} icon={<Ticket className="h-4 w-4" />} />
        <StatCard label="Avg CSAT" value={customersQuery.isLoading ? "—" : stats.avgCsat} icon={<ShieldCheck className="h-4 w-4" />} tone={Number(stats.avgCsat) >= 4.5 ? "sage" : "amber"} />
        <StatCard label="At risk" value={customersQuery.isLoading ? "—" : stats.atRisk} icon={<AlertTriangle className="h-4 w-4" />} tone={stats.atRisk ? "rose" : "sage"} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <DashCard
          title="Customer directory"
          icon={<Users className="h-[18px] w-[18px]" />}
          right={
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative block w-[230px] max-w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--dash-ink-faint)]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, email, company..."
                  className="h-9 w-full rounded-lg border dash-border bg-white pl-8 pr-3 text-[12px] text-[var(--dash-ink)] outline-none transition placeholder:text-[var(--dash-ink-faint)] focus:border-[#9D91EA] focus:ring-2 focus:ring-[#6B5CD6]/15"
                />
              </label>
              <label className="relative">
                <span className="sr-only">Filter by tier</span>
                <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--dash-ink-faint)]" />
                <select
                  value={tierFilter}
                  onChange={(event) => setTierFilter(event.target.value as TierFilter)}
                  className="h-9 rounded-lg border dash-border bg-white pl-8 pr-7 text-[12px] font-semibold text-[var(--dash-ink-soft)] outline-none transition focus:border-[#9D91EA] focus:ring-2 focus:ring-[#6B5CD6]/15"
                >
                  <option value="all">All tiers</option>
                  {TIERS.map((tier) => (
                    <option key={tier} value={tier}>{capitalize(tier)}</option>
                  ))}
                </select>
              </label>
            </div>
          }
          padded={false}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="text-left text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">
                <tr>
                  <SortableTh label="Customer" active={sortCol === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
                  <SortableTh label="Plan" active={sortCol === "tier"} dir={sortDir} onClick={() => toggleSort("tier")} />
                  <SortableTh label="Company" active={sortCol === "company"} dir={sortDir} onClick={() => toggleSort("company")} />
                  <SortableTh label="Tickets" active={sortCol === "tickets"} dir={sortDir} onClick={() => toggleSort("tickets")} />
                  <SortableTh label="CSAT" active={sortCol === "csat"} dir={sortDir} onClick={() => toggleSort("csat")} />
                  <SortableTh label="Created" active={sortCol === "createdAt"} dir={sortDir} onClick={() => toggleSort("createdAt")} />
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {customersQuery.isLoading ? (
                  Array.from({ length: 7 }).map((_, index) => (
                    <tr key={index} className="border-t dash-border-soft">
                      <td className="px-4 py-3"><div className="skeleton h-9 w-48 rounded" /></td>
                      <td className="px-4 py-3"><div className="skeleton h-5 w-20 rounded" /></td>
                      <td className="px-4 py-3"><div className="skeleton h-4 w-28 rounded" /></td>
                      <td className="px-4 py-3"><div className="skeleton h-4 w-12 rounded" /></td>
                      <td className="px-4 py-3"><div className="skeleton h-4 w-12 rounded" /></td>
                      <td className="px-4 py-3"><div className="skeleton h-4 w-20 rounded" /></td>
                      <td />
                    </tr>
                  ))
                ) : customersQuery.isError ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10">
                      <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="Could not load customers" body={customersQuery.error.message} />
                    </td>
                  </tr>
                ) : sortedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10">
                      <EmptyState
                        icon={<Users className="h-5 w-5" />}
                        title="No customers found"
                        body={search || tierFilter !== "all" ? "Adjust the search or filters to see more accounts." : "Add your first customer to start building support memory."}
                        action={<button type="button" onClick={() => setCreateOpen(true)} className="font-bold text-[var(--dash-accent-deep)] hover:underline">Add customer</button>}
                      />
                    </td>
                  </tr>
                ) : (
                  sortedCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      onClick={() => setActiveId(customer.id)}
                      className={cn(
                        "cursor-pointer border-t dash-border-soft transition hover:bg-[rgba(107,92,214,0.04)]",
                        activeCustomer?.id === customer.id && "bg-[#F6F4FF]",
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex min-w-[220px] items-center gap-3">
                          <Avatar customer={customer} />
                          <div className="min-w-0">
                            <div className="truncate font-bold text-[var(--dash-ink)]">{displayName(customer)}</div>
                            <div className="flex items-center gap-1.5 truncate text-[11px] text-[var(--dash-ink-faint)]">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate">{customer.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <TierBadge tier={customer.tier} />
                      </td>
                      <td className="px-4 py-3 text-[var(--dash-ink-soft)]">{customer.company ?? "—"}</td>
                      <td className="px-4 py-3 font-semibold text-[var(--dash-ink)]">{customer.totalTickets ?? 0}</td>
                      <td className="px-4 py-3">
                        <HealthPill customer={customer} />
                      </td>
                      <td className="px-4 py-3 text-[var(--dash-ink-soft)]">{formatRelativeTime(customer.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/dashboard/tickets?q=${encodeURIComponent(customer.email)}`}
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--dash-ink-faint)] transition hover:bg-white hover:text-[var(--dash-accent)]"
                          aria-label={`View tickets for ${displayName(customer)}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DashCard>

        <div className="flex flex-col gap-4">
          <CustomerPanel customer={activeCustomer} history={history} isHistoryLoading={historyQuery.isLoading} />
        </div>
      </div>

      <AnimatePresence>
        {createOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => setCreateOpen(false)}
          >
            <motion.form
              onSubmit={submitCustomer}
              onMouseDown={(event) => event.stopPropagation()}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.22 }}
              className="w-full max-w-[520px] overflow-hidden rounded-2xl border dash-border bg-[var(--dash-card)] shadow-[0_30px_90px_-45px_rgba(23,26,23,0.55)]"
            >
              <div className="flex items-center gap-3 border-b dash-border-soft px-5 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ECE9FB] text-[var(--dash-accent)]">
                  <UserRound className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-bold text-[var(--dash-ink)]">Add customer</div>
                  <div className="text-[12px] text-[var(--dash-ink-faint)]">Create an account record for tickets, Copilot context, and customer history.</div>
                </div>
                <button type="button" onClick={() => setCreateOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--dash-ink-faint)] transition hover:bg-[var(--dash-bg)] hover:text-[var(--dash-ink)]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 p-5">
                <Field label="Email" required>
                  <input value={draft.email} onChange={(event) => setDraft((value) => ({ ...value, email: event.target.value }))} autoFocus placeholder="customer@company.com" className={FIELD_CLASS} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name">
                    <input value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} placeholder="Ada Lovelace" className={FIELD_CLASS} />
                  </Field>
                  <Field label="Company">
                    <input value={draft.company} onChange={(event) => setDraft((value) => ({ ...value, company: event.target.value }))} placeholder="Analytical Engines Inc." className={FIELD_CLASS} />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Plan">
                    <select value={draft.tier} onChange={(event) => setDraft((value) => ({ ...value, tier: event.target.value as Tier }))} className={FIELD_CLASS}>
                      {TIERS.map((tier) => (
                        <option key={tier} value={tier}>{capitalize(tier)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Stripe ID">
                    <input value={draft.stripeCustomerId} onChange={(event) => setDraft((value) => ({ ...value, stripeCustomerId: event.target.value }))} placeholder="cus_..." className={FIELD_CLASS} />
                  </Field>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t dash-border-soft px-5 py-4">
                <button type="button" onClick={() => setCreateOpen(false)} className="h-9 rounded-lg border dash-border bg-white px-3.5 text-[13px] font-semibold text-[var(--dash-ink-soft)] transition hover:text-[var(--dash-ink)]">
                  Cancel
                </button>
                <button type="submit" disabled={createCustomer.isPending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] px-4 text-[13px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60">
                  {createCustomer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create customer
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function sortCustomers(customers: Customer[], col: SortCol, dir: SortDir) {
  return [...customers].sort((a, b) => {
    let cmp = 0
    if (col === "name") cmp = displayName(a).localeCompare(displayName(b))
    if (col === "company") cmp = (a.company ?? "").localeCompare(b.company ?? "")
    if (col === "tier") cmp = tierRank(b.tier) - tierRank(a.tier)
    if (col === "tickets") cmp = (a.totalTickets ?? 0) - (b.totalTickets ?? 0)
    if (col === "csat") cmp = parseCsat(a.csatAvg) - parseCsat(b.csatAvg)
    if (col === "createdAt") cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    return dir === "desc" ? -cmp : cmp
  })
}

function displayName(customer: Pick<Customer, "name" | "email">) {
  return customer.name?.trim() || customer.email
}

function tierRank(tier: Tier) {
  return tier === "enterprise" ? 3 : tier === "growth" ? 2 : 1
}

function parseCsat(value: string | null | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function averageCsat(customers: Customer[]) {
  const values = customers.map((customer) => parseCsat(customer.csatAvg)).filter((value) => value > 0)
  if (values.length === 0) return "—"
  return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)
}

function isAtRisk(customer: Customer) {
  const csat = parseCsat(customer.csatAvg)
  return (csat > 0 && csat < 4) || (customer.totalTickets ?? 0) >= 8
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function StatCard({ label, value, icon, tone = "default" }: { label: string; value: ReactNode; icon: ReactNode; tone?: "default" | "accent" | "sage" | "amber" | "rose" }) {
  const toneClass = {
    default: "bg-[var(--dash-bg)] text-[var(--dash-ink-faint)]",
    accent: "bg-[#ECE9FB] text-[var(--dash-accent)]",
    sage: "bg-[var(--dash-sage-wash)] text-[var(--dash-sage)]",
    amber: "bg-[var(--dash-amber-wash)] text-[var(--dash-amber)]",
    rose: "bg-[var(--dash-rose-wash)] text-[var(--dash-rose)]",
  }[tone]
  return (
    <div className="dash-card p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">{label}</div>
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", toneClass)}>{icon}</span>
      </div>
      <div className="mt-1 text-[22px] font-bold tracking-tight text-[var(--dash-ink)]">{value}</div>
    </div>
  )
}

function SortableTh({ label, active, dir, onClick }: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  return (
    <th className="px-4 py-2.5">
      <button type="button" onClick={onClick} className={cn("inline-flex items-center gap-1 rounded-md transition hover:text-[var(--dash-ink)]", active && "text-[var(--dash-ink)]")}>
        {label}
        {active ? (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-55" />}
      </button>
    </th>
  )
}

function Avatar({ customer }: { customer: Customer }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--dash-bg-deep)] text-[11px] font-bold text-[var(--dash-ink-soft)] ring-1 ring-black/[0.04]">
      {getInitials(customer.name || customer.email)}
    </div>
  )
}

function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold capitalize", TIER_TONE[tier])}>
      {tier}
    </span>
  )
}

function HealthPill({ customer }: { customer: Customer }) {
  const csat = parseCsat(customer.csatAvg)
  const risk = isAtRisk(customer)
  if (!csat) {
    return <span className="text-[var(--dash-ink-faint)]">—</span>
  }
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold", risk ? "bg-[var(--dash-rose-wash)] text-[var(--dash-rose)]" : "bg-[var(--dash-sage-wash)] text-[var(--dash-sage)]")}>
      {risk ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
      {csat.toFixed(2)}
    </span>
  )
}

function CustomerPanel({ customer, history, isHistoryLoading }: { customer: Customer | null; history: CustomerTicket[]; isHistoryLoading: boolean }) {
  if (!customer) {
    return (
      <DashCard title="Customer profile" icon={<UserRound className="h-[18px] w-[18px]" />}>
        <EmptyState icon={<Users className="h-5 w-5" />} title="No customer selected" body="Select a customer to inspect their account, ticket history, and support health." />
      </DashCard>
    )
  }

  return (
    <>
      <DashCard title="Customer profile" icon={<UserRound className="h-[18px] w-[18px]" />}>
        <div className="flex items-start gap-3">
          <Avatar customer={customer} />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold text-[var(--dash-ink)]">{displayName(customer)}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[var(--dash-ink-soft)]">
              <Mail className="h-3.5 w-3.5" />
              <span className="truncate">{customer.email}</span>
            </div>
          </div>
          <TierBadge tier={customer.tier} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <MiniMetric label="Tickets" value={customer.totalTickets ?? 0} />
          <MiniMetric label="CSAT" value={customer.csatAvg ?? "—"} tone={isAtRisk(customer) ? "rose" : "sage"} />
          <MiniMetric label="Company" value={customer.company ?? "—"} />
          <MiniMetric label="Since" value={formatRelativeTime(customer.createdAt)} />
        </div>

        <div className="mt-4 space-y-2 text-[12.5px]">
          <ProfileRow icon={<Building2 className="h-4 w-4" />} label="Company" value={customer.company ?? "Not set"} />
          <ProfileRow icon={<BriefcaseBusiness className="h-4 w-4" />} label="Stripe" value={customer.stripeCustomerId ?? "Not linked"} />
          <ProfileRow icon={<Sparkles className="h-4 w-4" />} label="Copilot context" value={customer.tier === "enterprise" ? "Priority account" : "Standard account"} />
        </div>

        <div className="mt-4 flex gap-2">
          <Link href={`/dashboard/tickets?q=${encodeURIComponent(customer.email)}`} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border dash-border bg-white text-[12.5px] font-semibold text-[var(--dash-accent-deep)] transition hover:dash-shadow-sm">
            <Ticket className="h-4 w-4" />
            Tickets
          </Link>
          <Link href={`/dashboard/conversations?q=${encodeURIComponent(customer.email)}`} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border dash-border bg-white text-[12.5px] font-semibold text-[var(--dash-accent-deep)] transition hover:dash-shadow-sm">
            <MessageSquare className="h-4 w-4" />
            Threads
          </Link>
        </div>
      </DashCard>

      <DashCard title="Recent ticket history" icon={<Ticket className="h-[18px] w-[18px]" />}>
        {isHistoryLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="skeleton h-16 rounded-lg" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <EmptyState icon={<Ticket className="h-5 w-5" />} title="No tickets yet" body="Ticket history will appear here as the customer contacts support." />
        ) : (
          <div className="space-y-2">
            {history.map((ticket) => (
              <Link key={ticket.id} href={`/dashboard/tickets?q=${encodeURIComponent(ticket.subject)}`} className="block rounded-lg border dash-border-soft bg-white px-3 py-2.5 transition hover:dash-shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] font-bold text-[var(--dash-ink)]">{ticket.subject}</div>
                    <div className="mt-1 text-[10.5px] text-[var(--dash-ink-faint)]">{formatRelativeTime(ticket.createdAt)}</div>
                  </div>
                  <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold capitalize", STATUS_TONE[ticket.status])}>{ticket.status}</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold capitalize", PRIORITY_TONE[ticket.priority])}>{ticket.priority}</span>
                  {ticket.aiResolved && <span className="rounded-md bg-[#ECE9FB] px-1.5 py-0.5 text-[10px] font-bold text-[var(--dash-accent-deep)]">AI resolved</span>}
                  {ticket.confidenceScore != null && <span className="rounded-md bg-[var(--dash-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--dash-ink-faint)]">{ticket.confidenceScore}% conf</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </DashCard>
    </>
  )
}

function MiniMetric({ label, value, tone }: { label: string; value: ReactNode; tone?: "sage" | "rose" }) {
  return (
    <div className="rounded-xl border dash-border-soft bg-white p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">{label}</div>
      <div className={cn("mt-1 truncate text-[15px] font-bold text-[var(--dash-ink)]", tone === "sage" && "text-[var(--dash-sage)]", tone === "rose" && "text-[var(--dash-rose)]")}>{value}</div>
    </div>
  )
}

function ProfileRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-[var(--dash-bg)] px-3 py-2">
      <span className="text-[var(--dash-ink-faint)]">{icon}</span>
      <span className="text-[var(--dash-ink-faint)]">{label}</span>
      <span className="ml-auto truncate font-semibold text-[var(--dash-ink)]">{value}</span>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">
        {label}{required ? " *" : ""}
      </span>
      {children}
    </label>
  )
}

function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-[130px] flex-col items-center justify-center rounded-xl border dash-border-soft bg-white px-5 py-7 text-center">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--dash-bg)] text-[var(--dash-ink-faint)]">{icon}</div>
      <div className="text-[13px] font-bold text-[var(--dash-ink)]">{title}</div>
      <p className="mt-1 max-w-sm text-[12px] leading-5 text-[var(--dash-ink-soft)]">{body}</p>
      {action && <div className="mt-3 text-[12.5px]">{action}</div>}
    </div>
  )
}
