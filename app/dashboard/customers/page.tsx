"use client"

import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronDown,
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
type MobilePane = "list" | "profile"

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
const TABLE_LAYOUT_MQ = "(min-width: 1024px)"
const WORKBENCH_MQ = "(min-width: 1280px)"

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
  "h-11 sm:h-10 w-full rounded-lg border dash-border bg-white px-3 text-[13px] text-[var(--dash-ink)] outline-none transition placeholder:text-[var(--dash-ink-faint)] focus:border-[#9D91EA] focus:ring-2 focus:ring-[#6B5CD6]/15"

const SORT_LABELS: Record<SortCol, string> = {
  name: "Name",
  company: "Company",
  tier: "Plan",
  tickets: "Tickets",
  csat: "CSAT",
  createdAt: "Created",
}

function subscribeMq(query: string, onChange: () => void) {
  const mql = window.matchMedia(query)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function useMediaQuery(query: string, serverSnapshot = false) {
  return useSyncExternalStore(
    (onChange) => subscribeMq(query, onChange),
    () => window.matchMedia(query).matches,
    () => serverSnapshot,
  )
}

export default function CustomersPage() {
  const utils = api.useUtils()
  const isTableLayout = useMediaQuery(TABLE_LAYOUT_MQ)
  const isWorkbench = useMediaQuery(WORKBENCH_MQ)

  const [search, setSearch] = useState("")
  const [tierFilter, setTierFilter] = useState<TierFilter>("all")
  const [sortCol, setSortCol] = useState<SortCol>("createdAt")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mobilePane, setMobilePane] = useState<MobilePane>("list")
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
      if (!isWorkbench) setMobilePane("profile")
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

  // Reset to list when collapsing from desktop workbench
  useEffect(() => {
    if (isWorkbench) setMobilePane("list")
  }, [isWorkbench])

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

  function selectCustomer(id: string) {
    setActiveId(id)
    if (!isWorkbench) setMobilePane("profile")
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

  const showList = isWorkbench || mobilePane === "list"
  const showProfile = isWorkbench || mobilePane === "profile"

  return (
    <div className="customers-page min-w-0 w-full max-w-full">
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
              className="inline-flex min-h-10 h-10 sm:h-9 flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg border dash-border bg-[var(--dash-card)] px-3 sm:px-3.5 text-[13px] font-semibold text-[var(--dash-ink-soft)] transition hover:dash-shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={cn("h-4 w-4 shrink-0", customersQuery.isFetching && "animate-spin")} />
              <span className="truncate">Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex min-h-10 h-10 sm:h-9 flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] px-3.5 sm:px-4 text-[13px] font-semibold text-white shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] transition hover:-translate-y-px"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="truncate">Add customer</span>
            </button>
          </>
        }
      />

      {/* KPI strip — 2 → 3 → 5 across breakpoints; denser on 4K */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 xl:grid-cols-5 3xl:gap-4">
        <StatCard label="Customers" value={customersQuery.isLoading ? "—" : stats.total} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Enterprise" value={customersQuery.isLoading ? "—" : stats.enterprise} icon={<Crown className="h-4 w-4" />} tone="accent" />
        <StatCard label="Tickets" value={customersQuery.isLoading ? "—" : stats.ticketCount} icon={<Ticket className="h-4 w-4" />} />
        <StatCard label="Avg CSAT" value={customersQuery.isLoading ? "—" : stats.avgCsat} icon={<ShieldCheck className="h-4 w-4" />} tone={Number(stats.avgCsat) >= 4.5 ? "sage" : "amber"} />
        <StatCard label="At risk" value={customersQuery.isLoading ? "—" : stats.atRisk} icon={<AlertTriangle className="h-4 w-4" />} tone={stats.atRisk ? "rose" : "sage"} className="col-span-2 sm:col-span-1" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(17rem,21rem)] 3xl:grid-cols-[minmax(0,1fr)_minmax(19rem,24rem)] 4xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] items-start">
        {/* ── Directory ── */}
        <div className={cn(showList ? "min-w-0" : "hidden", "xl:block xl:min-w-0")}>
          <DashCard
            title="Customer directory"
            icon={<Users className="h-[18px] w-[18px]" />}
            right={
              <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto">
                <label className="relative block w-full min-w-0 sm:flex-1 sm:min-w-[12rem] lg:flex-none lg:w-[14rem] xl:w-[16rem] 3xl:w-[18rem]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--dash-ink-faint)]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search name, email, company…"
                    aria-label="Search customers"
                    className="h-10 sm:h-9 w-full rounded-lg border dash-border bg-white pl-8 pr-3 text-[13px] sm:text-[12px] text-[var(--dash-ink)] outline-none transition placeholder:text-[var(--dash-ink-faint)] focus:border-[#9D91EA] focus:ring-2 focus:ring-[#6B5CD6]/15"
                  />
                </label>
                <div className="flex items-center gap-2 shrink-0">
                  <label className="relative min-w-0 flex-1 sm:flex-none">
                    <span className="sr-only">Filter by tier</span>
                    <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--dash-ink-faint)]" />
                    <select
                      value={tierFilter}
                      onChange={(event) => setTierFilter(event.target.value as TierFilter)}
                      className="h-10 sm:h-9 w-full sm:w-auto appearance-none rounded-lg border dash-border bg-white pl-8 pr-8 text-[12px] font-semibold text-[var(--dash-ink-soft)] outline-none transition focus:border-[#9D91EA] focus:ring-2 focus:ring-[#6B5CD6]/15"
                    >
                      <option value="all">All tiers</option>
                      {TIERS.map((tier) => (
                        <option key={tier} value={tier}>{capitalize(tier)}</option>
                      ))}
                    </select>
                  </label>
                  {!isTableLayout && (
                    <MobileSortControl
                      sortCol={sortCol}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                  )}
                </div>
              </div>
            }
            padded={false}
          >
            {/* Count rail */}
            <div className="flex items-center justify-between gap-2 border-b dash-border-soft px-3 sm:px-4 py-2">
              <span className="text-[11px] text-[var(--dash-ink-faint)] tabular-nums">
                {customersQuery.isLoading ? "…" : `${sortedCustomers.length} account${sortedCustomers.length === 1 ? "" : "s"}`}
              </span>
              {(search || tierFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => { setSearch(""); setTierFilter("all") }}
                  className="text-[11.5px] font-semibold text-[var(--dash-accent)] hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>

            {isTableLayout ? (
              <div className="overflow-x-auto overscroll-x-contain">
                <table className="w-full min-w-[44rem] xl:min-w-0 text-[12.5px] 3xl:text-[13px] table-fixed xl:table-auto">
                  <thead className="sticky top-0 z-10 text-left text-[11px] 3xl:text-[11.5px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)] bg-[var(--dash-bg-deep)]/60 backdrop-blur-sm">
                    <tr>
                      <SortableTh label="Customer" active={sortCol === "name"} dir={sortDir} onClick={() => toggleSort("name")} className="w-[32%] xl:w-auto" />
                      <SortableTh label="Plan" active={sortCol === "tier"} dir={sortDir} onClick={() => toggleSort("tier")} className="w-[10%] xl:w-auto" />
                      <SortableTh label="Company" active={sortCol === "company"} dir={sortDir} onClick={() => toggleSort("company")} className="w-[16%] xl:w-auto hidden xl:table-cell" />
                      <SortableTh label="Tickets" active={sortCol === "tickets"} dir={sortDir} onClick={() => toggleSort("tickets")} className="w-[10%] xl:w-auto" />
                      <SortableTh label="CSAT" active={sortCol === "csat"} dir={sortDir} onClick={() => toggleSort("csat")} className="w-[10%] xl:w-auto" />
                      <SortableTh label="Created" active={sortCol === "createdAt"} dir={sortDir} onClick={() => toggleSort("createdAt")} className="w-[12%] xl:w-auto" />
                      <th className="px-3 xl:px-4 3xl:px-5 py-2.5 3xl:py-3 w-[10%] xl:w-auto" />
                    </tr>
                  </thead>
                  <tbody>
                    {customersQuery.isLoading ? (
                      Array.from({ length: 7 }).map((_, index) => (
                        <tr key={index} className="border-t dash-border-soft">
                          <td className="px-3 xl:px-4 3xl:px-5 py-3"><div className="skeleton h-9 w-44 xl:w-52 rounded" /></td>
                          <td className="px-3 xl:px-4 3xl:px-5 py-3"><div className="skeleton h-5 w-16 rounded" /></td>
                          <td className="px-3 xl:px-4 3xl:px-5 py-3 hidden xl:table-cell"><div className="skeleton h-4 w-24 rounded" /></td>
                          <td className="px-3 xl:px-4 3xl:px-5 py-3"><div className="skeleton h-4 w-10 rounded" /></td>
                          <td className="px-3 xl:px-4 3xl:px-5 py-3"><div className="skeleton h-4 w-12 rounded" /></td>
                          <td className="px-3 xl:px-4 3xl:px-5 py-3"><div className="skeleton h-4 w-16 rounded" /></td>
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
                          onClick={() => selectCustomer(customer.id)}
                          className={cn(
                            "group cursor-pointer border-t dash-border-soft transition hover:bg-[rgba(107,92,214,0.04)]",
                            activeCustomer?.id === customer.id && "bg-[#F6F4FF]",
                          )}
                        >
                          <td className="px-3 xl:px-4 3xl:px-5 py-3 3xl:py-3.5">
                            <div className="flex min-w-0 items-center gap-2.5 xl:gap-3">
                              <Avatar customer={customer} />
                              <div className="min-w-0">
                                <div className="truncate font-bold text-[var(--dash-ink)] max-w-[10rem] xl:max-w-[14rem] 2xl:max-w-[18rem] 3xl:max-w-[22rem] 4xl:max-w-[28rem]">
                                  {displayName(customer)}
                                </div>
                                <div className="flex items-center gap-1.5 truncate text-[11px] text-[var(--dash-ink-faint)]">
                                  <Mail className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{customer.email}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 xl:px-4 3xl:px-5 py-3 3xl:py-3.5">
                            <TierBadge tier={customer.tier} />
                          </td>
                          <td className="px-3 xl:px-4 3xl:px-5 py-3 3xl:py-3.5 text-[var(--dash-ink-soft)] truncate max-w-[8rem] 3xl:max-w-[12rem] hidden xl:table-cell">
                            {customer.company ?? "—"}
                          </td>
                          <td className="px-3 xl:px-4 3xl:px-5 py-3 3xl:py-3.5 font-semibold tabular-nums text-[var(--dash-ink)]">
                            {customer.totalTickets ?? 0}
                          </td>
                          <td className="px-3 xl:px-4 3xl:px-5 py-3 3xl:py-3.5">
                            <HealthPill customer={customer} />
                          </td>
                          <td className="px-3 xl:px-4 3xl:px-5 py-3 3xl:py-3.5 text-[var(--dash-ink-soft)] whitespace-nowrap tabular-nums">
                            {formatRelativeTime(customer.createdAt)}
                          </td>
                          <td className="px-3 xl:px-4 3xl:px-5 py-3 3xl:py-3.5 text-right">
                            <Link
                              href={`/dashboard/tickets?q=${encodeURIComponent(customer.email)}`}
                              onClick={(event) => event.stopPropagation()}
                              className="inline-flex min-h-9 min-w-9 h-9 w-9 items-center justify-center rounded-md text-[var(--dash-ink-faint)] transition hover:bg-white hover:text-[var(--dash-accent)] opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
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
            ) : (
              <div className="divide-y divide-[var(--dash-line-soft)]" role="list">
                {customersQuery.isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <CustomerCardSkeleton key={index} />
                  ))
                ) : customersQuery.isError ? (
                  <div className="px-4 py-10">
                    <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="Could not load customers" body={customersQuery.error.message} />
                  </div>
                ) : sortedCustomers.length === 0 ? (
                  <div className="px-4 py-10">
                    <EmptyState
                      icon={<Users className="h-5 w-5" />}
                      title="No customers found"
                      body={search || tierFilter !== "all" ? "Adjust the search or filters to see more accounts." : "Add your first customer to start building support memory."}
                      action={<button type="button" onClick={() => setCreateOpen(true)} className="font-bold text-[var(--dash-accent-deep)] hover:underline">Add customer</button>}
                    />
                  </div>
                ) : (
                  sortedCustomers.map((customer) => (
                    <CustomerCard
                      key={customer.id}
                      customer={customer}
                      isActive={activeCustomer?.id === customer.id}
                      onSelect={() => selectCustomer(customer.id)}
                    />
                  ))
                )}
              </div>
            )}
          </DashCard>
        </div>

        {/* ── Profile pane ── */}
        <div className={cn(
          showProfile ? "flex" : "hidden",
          "xl:flex flex-col gap-3 sm:gap-4 min-w-0",
          !isWorkbench && "min-h-[min(70dvh,36rem)]",
        )}>
          {!isWorkbench && (
            <button
              type="button"
              onClick={() => setMobilePane("list")}
              className="inline-flex items-center gap-1.5 self-start min-h-10 px-2 -ml-1 rounded-lg text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:bg-[var(--dash-bg-deep)] transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to directory
            </button>
          )}
          <CustomerPanel customer={activeCustomer} history={history} isHistoryLoading={historyQuery.isLoading} />
        </div>
      </div>

      <AnimatePresence>
        {createOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-0 sm:p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => setCreateOpen(false)}
          >
            <motion.form
              onSubmit={submitCustomer}
              onMouseDown={(event) => event.stopPropagation()}
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.22 }}
              className="w-full max-w-[520px] 3xl:max-w-[560px] max-h-[min(100dvh,100%)] overflow-y-auto overflow-x-hidden rounded-t-2xl sm:rounded-2xl border dash-border bg-[var(--dash-card)] shadow-[0_30px_90px_-45px_rgba(23,26,23,0.55)] pb-[env(safe-area-inset-bottom)]"
            >
              <div className="flex items-start sm:items-center gap-3 border-b dash-border-soft px-4 sm:px-5 py-4 sticky top-0 bg-[var(--dash-card)] z-10">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ECE9FB] text-[var(--dash-accent)]">
                  <UserRound className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-bold text-[var(--dash-ink)]">Add customer</div>
                  <div className="text-[12px] text-[var(--dash-ink-faint)] leading-snug">
                    Create an account record for tickets, Copilot context, and customer history.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="flex min-h-9 min-w-9 h-9 w-9 items-center justify-center rounded-md text-[var(--dash-ink-faint)] transition hover:bg-[var(--dash-bg)] hover:text-[var(--dash-ink)] shrink-0"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 p-4 sm:p-5">
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
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t dash-border-soft px-4 sm:px-5 py-4">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="min-h-11 sm:min-h-9 h-11 sm:h-9 rounded-lg border dash-border bg-white px-3.5 text-[13px] font-semibold text-[var(--dash-ink-soft)] transition hover:text-[var(--dash-ink)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCustomer.isPending}
                  className="inline-flex min-h-11 sm:min-h-9 h-11 sm:h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] px-4 text-[13px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                >
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

function StatCard({
  label,
  value,
  icon,
  tone = "default",
  className,
}: {
  label: string
  value: ReactNode
  icon: ReactNode
  tone?: "default" | "accent" | "sage" | "amber" | "rose"
  className?: string
}) {
  const toneClass = {
    default: "bg-[var(--dash-bg)] text-[var(--dash-ink-faint)]",
    accent: "bg-[#ECE9FB] text-[var(--dash-accent)]",
    sage: "bg-[var(--dash-sage-wash)] text-[var(--dash-sage)]",
    amber: "bg-[var(--dash-amber-wash)] text-[var(--dash-amber)]",
    rose: "bg-[var(--dash-rose-wash)] text-[var(--dash-rose)]",
  }[tone]
  return (
    <div className={cn("dash-card p-3 sm:p-3.5 3xl:p-4 min-w-0", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)] truncate">{label}</div>
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", toneClass)}>{icon}</span>
      </div>
      <div className="mt-1 text-[clamp(1.15rem,2vw+0.5rem,1.5rem)] font-bold tracking-tight text-[var(--dash-ink)] tabular-nums truncate">{value}</div>
    </div>
  )
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
  className?: string
}) {
  return (
    <th className={cn("px-3 xl:px-4 3xl:px-5 py-2.5 3xl:py-3", className)}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 rounded-md transition hover:text-[var(--dash-ink)]",
          active && "text-[var(--dash-ink)]",
        )}
      >
        {label}
        {active ? (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-55" />}
      </button>
    </th>
  )
}

function MobileSortControl({
  sortCol,
  sortDir,
  onSort,
}: {
  sortCol: SortCol
  sortDir: SortDir
  onSort: (col: SortCol) => void
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Sort customers"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 min-h-10 h-10 sm:h-9 px-2.5 rounded-lg border dash-border bg-white text-[12px] font-semibold text-[var(--dash-ink-soft)] transition hover:bg-[var(--dash-bg-deep)]"
      >
        {sortDir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
        <span className="max-w-[4.5rem] truncate">{SORT_LABELS[sortCol]}</span>
        <ChevronDown className="h-3 w-3 opacity-50" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="Dismiss" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.11 }}
              className="absolute right-0 top-full mt-1 z-50 min-w-[11rem] rounded-xl bg-[var(--dash-card)] border dash-border shadow-lg overflow-hidden"
            >
              {(Object.keys(SORT_LABELS) as SortCol[]).map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => { onSort(col); setOpen(false) }}
                  className={cn(
                    "w-full text-left px-3 py-2.5 text-[12px] font-semibold transition flex items-center gap-2 hover:bg-[var(--dash-bg-deep)] min-h-10",
                    col === sortCol
                      ? "text-[var(--dash-accent-deep)] bg-[var(--dash-accent-wash)]"
                      : "text-[var(--dash-ink-soft)]",
                  )}
                >
                  {SORT_LABELS[col]}
                  {col === sortCol && (
                    sortDir === "desc"
                      ? <ArrowDown className="h-3 w-3 ml-auto" />
                      : <ArrowUp className="h-3 w-3 ml-auto" />
                  )}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function CustomerCard({
  customer,
  isActive,
  onSelect,
}: {
  customer: Customer
  isActive: boolean
  onSelect: () => void
}) {
  return (
    <div
      role="listitem"
      className={cn(
        "px-3.5 sm:px-4 py-3.5 transition",
        isActive ? "bg-[#F6F4FF]" : "",
      )}
    >
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onSelect}
          className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-accent)]/40"
          aria-label={`Open profile for ${displayName(customer)}`}
        >
          <Avatar customer={customer} size="lg" />
        </button>
        <div className="min-w-0 flex-1 flex flex-col gap-2">
          <button
            type="button"
            onClick={onSelect}
            className="w-full text-left cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-accent)]/40"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold text-[14px] sm:text-[13.5px] text-[var(--dash-ink)] truncate leading-snug">
                  {displayName(customer)}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[var(--dash-ink-faint)]">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{customer.email}</span>
                </div>
              </div>
              <TierBadge tier={customer.tier} />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-[var(--dash-ink-soft)]">
              {customer.company && (
                <span className="inline-flex items-center gap-1 truncate max-w-[12rem]">
                  <Building2 className="h-3 w-3 shrink-0 text-[var(--dash-ink-faint)]" />
                  {customer.company}
                </span>
              )}
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Ticket className="h-3 w-3 shrink-0 text-[var(--dash-ink-faint)]" />
                {customer.totalTickets ?? 0} tickets
              </span>
              <HealthPill customer={customer} />
              <span className="ml-auto text-[11px] text-[var(--dash-ink-faint)] tabular-nums shrink-0">
                {formatRelativeTime(customer.createdAt)}
              </span>
            </div>
          </button>

          <div className="flex items-center gap-2 pt-0.5">
            <Link
              href={`/dashboard/tickets?q=${encodeURIComponent(customer.email)}`}
              className="inline-flex items-center justify-center min-h-9 px-3 rounded-lg text-[12px] font-semibold text-[var(--dash-accent)] bg-[var(--dash-accent-wash)] hover:opacity-90 transition"
            >
              Tickets
            </Link>
            <button
              type="button"
              onClick={onSelect}
              className="text-[11.5px] font-semibold text-[var(--dash-ink-faint)] ml-auto min-h-9 px-1 hover:text-[var(--dash-accent)] transition"
            >
              View profile →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CustomerCardSkeleton() {
  return (
    <div className="px-3.5 sm:px-4 py-3.5 flex gap-3">
      <div className="skeleton h-11 w-11 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex justify-between gap-2">
          <div className="skeleton h-4 w-36 rounded" />
          <div className="skeleton h-5 w-16 rounded-md" />
        </div>
        <div className="skeleton h-3 w-48 rounded" />
        <div className="flex gap-2">
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-3 w-16 rounded" />
        </div>
      </div>
    </div>
  )
}

function Avatar({ customer, size = "md" }: { customer: Customer; size?: "md" | "lg" }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-[var(--dash-bg-deep)] font-bold text-[var(--dash-ink-soft)] ring-1 ring-black/[0.04]",
        size === "lg" ? "h-11 w-11 text-[12px]" : "h-9 w-9 text-[11px]",
      )}
    >
      {getInitials(customer.name || customer.email)}
    </div>
  )
}

function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold capitalize shrink-0", TIER_TONE[tier])}>
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
          <Avatar customer={customer} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] sm:text-[15px] 3xl:text-[16px] font-bold text-[var(--dash-ink)] break-words">{displayName(customer)}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[var(--dash-ink-soft)] min-w-0">
              <Mail className="h-3.5 w-3.5 shrink-0" />
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

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <Link
            href={`/dashboard/tickets?q=${encodeURIComponent(customer.email)}`}
            className="inline-flex min-h-10 h-10 sm:h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border dash-border bg-white text-[12.5px] font-semibold text-[var(--dash-accent-deep)] transition hover:dash-shadow-sm"
          >
            <Ticket className="h-4 w-4" />
            Tickets
          </Link>
          <Link
            href={`/dashboard/conversations?q=${encodeURIComponent(customer.email)}`}
            className="inline-flex min-h-10 h-10 sm:h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border dash-border bg-white text-[12.5px] font-semibold text-[var(--dash-accent-deep)] transition hover:dash-shadow-sm"
          >
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
              <Link
                key={ticket.id}
                href={`/dashboard/tickets?q=${encodeURIComponent(ticket.subject)}`}
                className="block rounded-lg border dash-border-soft bg-white px-3 py-2.5 transition hover:dash-shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] font-bold text-[var(--dash-ink)]">{ticket.subject}</div>
                    <div className="mt-1 text-[10.5px] text-[var(--dash-ink-faint)]">{formatRelativeTime(ticket.createdAt)}</div>
                  </div>
                  <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold capitalize", STATUS_TONE[ticket.status])}>{ticket.status}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
    <div className="rounded-xl border dash-border-soft bg-white p-2.5 sm:p-3 min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">{label}</div>
      <div className={cn("mt-1 truncate text-[14px] sm:text-[15px] font-bold text-[var(--dash-ink)]", tone === "sage" && "text-[var(--dash-sage)]", tone === "rose" && "text-[var(--dash-rose)]")}>{value}</div>
    </div>
  )
}

function ProfileRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-[var(--dash-bg)] px-3 py-2 min-w-0">
      <span className="text-[var(--dash-ink-faint)] shrink-0">{icon}</span>
      <span className="text-[var(--dash-ink-faint)] shrink-0">{label}</span>
      <span className="ml-auto truncate font-semibold text-[var(--dash-ink)] text-right">{value}</span>
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
    <div className="flex min-h-[120px] sm:min-h-[130px] flex-col items-center justify-center rounded-xl border dash-border-soft bg-white px-4 sm:px-5 py-6 sm:py-7 text-center">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--dash-bg)] text-[var(--dash-ink-faint)]">{icon}</div>
      <div className="text-[13px] font-bold text-[var(--dash-ink)]">{title}</div>
      <p className="mt-1 max-w-sm text-[12px] leading-5 text-[var(--dash-ink-soft)]">{body}</p>
      {action && <div className="mt-3 text-[12.5px]">{action}</div>}
    </div>
  )
}
