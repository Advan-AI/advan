"use client"

import Link from "next/link"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckSquare,
  ChevronDown,
  Filter,
  Globe,
  Hash,
  Inbox,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Square,
  Tag,
  Ticket,
  X,
  Zap,
} from "lucide-react"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"
import { api } from "@/lib/api/trpc-client"

// ─── Types ────────────────────────────────────────────────────────────────────

type TicketStatus   = "open" | "pending" | "resolved" | "closed"
type TicketPriority = "low" | "medium" | "high" | "urgent"
type TicketChannel  = "email" | "chat" | "voice" | "slack" | "portal"
type StatusFilter   = "All" | TicketStatus
type PriorityFilter = "All" | TicketPriority
type SortCol        = "subject" | "customer" | "status" | "priority" | "createdAt"

type TicketRow = {
  ticket: {
    id: string
    orgId: string
    subject: string
    status: TicketStatus
    priority: TicketPriority
    channel: TicketChannel
    assignedTo: string | null
    aiResolved: boolean
    confidenceScore: number | null
    firstReplyMs: number | null
    resolutionMs: number | null
    createdAt: string
    updatedAt: string
  }
  customer: {
    id: string
    name: string | null
    email: string | null
    tier: "free" | "growth" | "enterprise"
  } | null
}

type CreateTicketInput = {
  subject: string
  priority: TicketPriority
  channel: TicketChannel
  customerId?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_FILTERS: StatusFilter[]   = ["All", "open", "pending", "resolved", "closed"]
const PRIORITY_FILTERS: PriorityFilter[] = ["All", "low", "medium", "high", "urgent"]
const TICKET_STATUSES: TicketStatus[]  = ["open", "pending", "resolved", "closed"]
const TICKET_CHANNELS: TicketChannel[] = ["email", "chat", "voice", "slack", "portal"]
const TICKET_PRIORITIES: TicketPriority[] = ["low", "medium", "high", "urgent"]
const PAGE_SIZE = 25

const STATUS_TONE: Record<TicketStatus, string> = {
  open:     "bg-[var(--dash-sage-wash)] text-[#2f5d3f]",
  pending:  "bg-[var(--dash-amber-wash)] text-[#8a5a1e]",
  resolved: "bg-[var(--dash-blue-wash)] text-[#244e8a]",
  closed:   "bg-[var(--dash-line-soft)] text-[var(--dash-ink-faint)]",
}

const PRIORITY_TONE: Record<TicketPriority, string> = {
  low:    "text-[var(--dash-ink-faint)] bg-[var(--dash-bg-deep)]",
  medium: "text-[var(--dash-blue)] bg-[var(--dash-blue-wash)]",
  high:   "text-[var(--dash-amber)] bg-[var(--dash-amber-wash)]",
  urgent: "text-[var(--dash-rose)] bg-[var(--dash-rose-wash)]",
}

const CHANNEL_ICONS: Record<TicketChannel, React.ReactNode> = {
  email:  <Mail className="w-3.5 h-3.5" />,
  chat:   <MessageCircle className="w-3.5 h-3.5" />,
  voice:  <Phone className="w-3.5 h-3.5" />,
  slack:  <Hash className="w-3.5 h-3.5" />,
  portal: <Globe className="w-3.5 h-3.5" />,
}

const PRIORITY_ORDER: Record<TicketPriority, number> = { urgent: 4, high: 3, medium: 2, low: 1 }
const STATUS_ORDER: Record<TicketStatus, number>     = { open: 4, pending: 3, resolved: 2, closed: 1 }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(d: Date | string): string {
  const ms = Date.now() - new Date(d).getTime()
  if (ms < 60_000)        return "Just now"
  if (ms < 3_600_000)     return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000)    return `${Math.floor(ms / 3_600_000)}h ago`
  if (ms < 604_800_000)   return `${Math.floor(ms / 86_400_000)}d ago`
  return new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" })
}

function sortRows(rows: TicketRow[], col: SortCol, dir: "asc" | "desc"): TicketRow[] {
  return [...rows].sort((a, b) => {
    let cmp = 0
    switch (col) {
      case "subject":
        cmp = a.ticket.subject.localeCompare(b.ticket.subject); break
      case "customer":
        cmp = (a.customer?.name ?? "zzz").localeCompare(b.customer?.name ?? "zzz"); break
      case "status":
        cmp = (STATUS_ORDER[a.ticket.status] ?? 0) - (STATUS_ORDER[b.ticket.status] ?? 0); break
      case "priority":
        cmp = (PRIORITY_ORDER[a.ticket.priority] ?? 0) - (PRIORITY_ORDER[b.ticket.priority] ?? 0); break
      default:
        cmp = new Date(a.ticket.createdAt).getTime() - new Date(b.ticket.createdAt).getTime()
    }
    return dir === "desc" ? -cmp : cmp
  })
}

function isValidEmail(value: string | null | undefined): boolean {
  if (!value?.trim()) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TicketsPage() {
  // ── Filter / search / sort ──
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>("All")
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("All")
  const [q, setQ]                         = useState("")
  const [sortCol, setSortCol]             = useState<SortCol>("createdAt")
  const [sortDir, setSortDir]             = useState<"asc" | "desc">("desc")

  // ── Pagination (grows as user scrolls) ──
  const [loadedCount, setLoadedCount]     = useState(PAGE_SIZE)

  // ── Selection / bulk mode ──
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set())

  // ── Optimistic state ──
  // id → partial ticket overrides applied immediately on mutation
  const [optimisticOverrides, setOptimisticOverrides] = useState<
    Map<string, Partial<TicketRow["ticket"]>>
  >(new Map())
  // rows created optimistically before server confirms
  const [optimisticTickets, setOptimisticTickets] = useState<TicketRow[]>([])
  // ids currently awaiting status mutation
  const [pendingStatusIds, setPendingStatusIds]   = useState<Set<string>>(new Set())

  // ── Row-level errors (per ticket id) ──
  const [rowErrors, setRowErrors]   = useState<Map<string, string>>(new Map())
  // last retried variables per row
  const lastStatusVars = useRef<Map<string, { id: string; status: TicketStatus }>>(new Map())

  // ── Global toast ──
  const [globalError, setGlobalError] = useState<string | null>(null)

  // ── Keyboard navigation ──
  const [focusedIdx, setFocusedIdx]   = useState(-1)
  const rowRefs   = useRef<Map<number, HTMLTableRowElement>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Modal ──
  const [showNewTicket, setShowNewTicket] = useState(false)

  // ── Sentinel for infinite scroll ──
  const sentinelRef = useRef<HTMLDivElement>(null)

  const utils = api.useUtils()

  // ── URL pre-fill from deep-links (overview → /dashboard/tickets?status=open) ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const qParam      = params.get("q")
    const statusParam = params.get("status") as StatusFilter | null
    if (qParam) setQ(qParam)
    if (statusParam && STATUS_FILTERS.includes(statusParam)) setStatusFilter(statusParam)
  }, [])

  // Reset pagination whenever server-side filters change
  useEffect(() => {
    setLoadedCount(PAGE_SIZE)
  }, [statusFilter, priorityFilter])

  // ── Data query ──
  const { data, isLoading, isFetching, isError, refetch } = api.tickets.list.useQuery(
    {
      status:   statusFilter   === "All" ? undefined : statusFilter,
      priority: priorityFilter === "All" ? undefined : priorityFilter,
      limit:    loadedCount,
      offset:   0,
    },
    { staleTime: 20_000 }
  )

  // ── Intersection observer — trigger next page load ──
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !isFetching &&
          data &&
          loadedCount < data.total
        ) {
          setLoadedCount((prev) => prev + PAGE_SIZE)
        }
      },
      { threshold: 0.1, rootMargin: "120px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [isFetching, data, loadedCount])

  // ── Status update mutation (with optimistic override + rollback) ──
  const updateStatus = api.tickets.updateStatus.useMutation({
    onMutate: async (vars) => {
      lastStatusVars.current.set(vars.id, vars)
      setPendingStatusIds((prev) => new Set([...prev, vars.id]))
      setOptimisticOverrides((prev) => {
        const next = new Map(prev)
        next.set(vars.id, { ...prev.get(vars.id), status: vars.status })
        return next
      })
      setRowErrors((prev) => {
        const next = new Map(prev)
        next.delete(vars.id)
        return next
      })
    },
    onError: (_err, vars) => {
      setOptimisticOverrides((prev) => {
        const next = new Map(prev)
        next.delete(vars.id)
        return next
      })
      setRowErrors((prev) => {
        const next = new Map(prev)
        next.set(vars.id, "Status update failed — click Retry")
        return next
      })
    },
    onSettled: (_data, _err, vars) => {
      setPendingStatusIds((prev) => {
        const next = new Set(prev)
        next.delete(vars.id)
        return next
      })
      utils.tickets.list.invalidate()
      utils.analytics.overview.invalidate()
    },
  })

  // ── Bulk status mutation (with full optimistic override + rollback) ──
  const bulkUpdateStatus = api.tickets.bulkUpdateStatus.useMutation({
    onMutate: async (vars) => {
      const snapshot = new Map(optimisticOverrides)
      setPendingStatusIds((prev) => new Set([...prev, ...vars.ids]))
      setOptimisticOverrides((prev) => {
        const next = new Map(prev)
        for (const id of vars.ids) {
          next.set(id, { ...prev.get(id), status: vars.status })
        }
        return next
      })
      setRowErrors((prev) => {
        const next = new Map(prev)
        for (const id of vars.ids) next.delete(id)
        return next
      })
      return { snapshot, ids: vars.ids }
    },
    onError: (_err, vars, ctx) => {
      if (ctx) {
        setOptimisticOverrides(ctx.snapshot)
      }
      setGlobalError(`Bulk update failed — ${vars.ids.length} ticket(s) unchanged`)
    },
    onSuccess: () => {
      setSelectedIds(new Set())
      setSelectionMode(false)
    },
    onSettled: (_data, _err, vars) => {
      setPendingStatusIds((prev) => {
        const next = new Set(prev)
        for (const id of vars.ids) next.delete(id)
        return next
      })
      utils.tickets.list.invalidate()
      utils.analytics.overview.invalidate()
    },
  })

  // ── Create mutation (with optimistic row injection) ──
  const createTicket = api.tickets.create.useMutation({
    onMutate: async (vars) => {
      const optimisticId = `optimistic-${Date.now()}`
      const optimistic: TicketRow = {
        ticket: {
          id: optimisticId,
          orgId: "",
          subject: vars.subject,
          status: "open",
          priority: vars.priority ?? "medium",
          channel: vars.channel ?? "email",
          assignedTo: null,
          aiResolved: false,
          confidenceScore: null,
          firstReplyMs: null,
          resolutionMs: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        customer: null,
      }
      setOptimisticTickets((prev) => [optimistic, ...prev])
      return { optimisticId }
    },
    onError: (err, _vars, ctx) => {
      if (ctx) {
        setOptimisticTickets((prev) =>
          prev.filter((t) => t.ticket.id !== ctx.optimisticId)
        )
      }
      setGlobalError(err.message || "Failed to create ticket — please try again")
    },
    onSuccess: () => {
      setShowNewTicket(false)
    },
    onSettled: () => {
      setOptimisticTickets([])
      utils.tickets.list.invalidate()
      utils.analytics.overview.invalidate()
    },
  })

  // ── Derived display rows (merge optimistic + filter + sort) ──
  const displayRows = useMemo<TicketRow[]>(() => {
    const base: TicketRow[] = data?.tickets ?? []

    // Merge optimistic overrides into fetched rows
    const merged: TicketRow[] = [...optimisticTickets, ...base].map((r) => {
      const override = optimisticOverrides.get(r.ticket.id)
      if (!override) return r
      return { ...r, ticket: { ...r.ticket, ...override } }
    })

    // Client-side text search
    const lq = q.trim().toLowerCase()
    const filtered = lq
      ? merged.filter(
          (r) =>
            r.ticket.subject.toLowerCase().includes(lq) ||
            (r.customer?.name ?? "").toLowerCase().includes(lq) ||
            (r.customer?.email ?? "").toLowerCase().includes(lq) ||
            r.ticket.id.toLowerCase().startsWith(lq)
        )
      : merged

    return sortRows(filtered, sortCol, sortDir)
  }, [data, optimisticTickets, optimisticOverrides, q, sortCol, sortDir])

  const hasMore = data ? loadedCount < data.total : false

  // ── Selection helpers ──
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(displayRows.map((r) => r.ticket.id)))
  }, [displayRows])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  // ── Sort toggle ──
  const handleSort = useCallback(
    (col: SortCol) => {
      if (sortCol === col) {
        setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
      } else {
        setSortCol(col)
        setSortDir("desc")
      }
    },
    [sortCol]
  )

  // ── Keyboard navigation (Arrow, Space, Enter, Escape, ⌘A, ⌘⌫) ──
  const handleContainerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setFocusedIdx((prev) => {
            const next = Math.min(prev + 1, displayRows.length - 1)
            rowRefs.current.get(next)?.scrollIntoView({ block: "nearest" })
            return next
          })
          break
        case "ArrowUp":
          e.preventDefault()
          setFocusedIdx((prev) => {
            const next = Math.max(prev - 1, 0)
            rowRefs.current.get(next)?.scrollIntoView({ block: "nearest" })
            return next
          })
          break
        case "Escape":
          e.preventDefault()
          if (selectionMode) {
            setSelectionMode(false)
            setSelectedIds(new Set())
          } else if (q) {
            setQ("")
          } else {
            setFocusedIdx(-1)
          }
          break
        case " ":
          if (selectionMode && focusedIdx >= 0 && displayRows[focusedIdx]) {
            e.preventDefault()
            toggleSelection(displayRows[focusedIdx].ticket.id)
          }
          break
        case "a":
          if ((e.metaKey || e.ctrlKey) && selectionMode) {
            e.preventDefault()
            selectAll()
          }
          break
        case "Delete":
          if (selectionMode && selectedIds.size > 0 && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            bulkUpdateStatus.mutate({ ids: Array.from(selectedIds), status: "closed" })
          }
          break
      }
    },
    [focusedIdx, displayRows, selectionMode, selectedIds, q, toggleSelection, selectAll, bulkUpdateStatus]
  )

  const colCount = selectionMode ? 8 : 7

  return (
    <div>
      <DashPageHeader
        eyebrow="Queue"
        title="Tickets"
        subtitle="Every channel, every customer, one queue. Filter, triage, and route in seconds."
        actions={
          <>
            <button
              onClick={() => {
                setSelectionMode((v) => !v)
                if (selectionMode) setSelectedIds(new Set())
              }}
              className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border text-[13px] font-semibold transition ${
                selectionMode
                  ? "border-[var(--dash-accent)] bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]"
                  : "dash-border bg-[var(--dash-card)] text-[var(--dash-ink-soft)] hover:bg-[var(--dash-bg-deep)]"
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              {selectionMode ? "Exit Select" : "Select"}
            </button>
            <button
              onClick={() => setShowNewTicket(true)}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] hover:-translate-y-px transition"
            >
              <Plus className="w-4 h-4" /> New ticket
            </button>
          </>
        }
      />

      {/* Global error toast */}
      <AnimatePresence>
        {globalError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2.5 mb-4 px-4 py-2.5 rounded-xl bg-[var(--dash-rose-wash)] border border-[#E8B4B4] text-[#7a2929] text-[12.5px] font-medium"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {globalError}
            <button
              onClick={() => setGlobalError(null)}
              className="ml-auto p-0.5 hover:opacity-70 transition"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <DashCard
        title="Ticket Queue"
        icon={<Ticket className="w-[18px] h-[18px]" />}
        right={
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Search */}
            <div className="flex items-center gap-1.5 bg-[var(--dash-bg-deep)] border dash-border rounded-lg px-2.5 py-1.5 w-full min-w-0 sm:w-[200px]">
              <Search className="w-3.5 h-3.5 text-[var(--dash-ink-faint)] shrink-0" />
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setFocusedIdx(-1) }}
                placeholder="Search…"
                aria-label="Search tickets"
                className="bg-transparent outline-none text-[12px] text-[var(--dash-ink)] placeholder:text-[var(--dash-ink-faint)] w-full"
              />
              {q && (
                <button
                  onClick={() => setQ("")}
                  className="text-[var(--dash-ink-faint)] hover:text-[var(--dash-ink-soft)] transition"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Priority filter */}
            <PriorityPicker value={priorityFilter} onChange={setPriorityFilter} />

            {/* Refresh */}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh"
              aria-label="Refresh tickets"
              className={`p-1.5 rounded-md text-[var(--dash-ink-faint)] hover:text-[var(--dash-ink-soft)] hover:bg-[var(--dash-bg-deep)] transition ${
                isFetching ? "animate-spin pointer-events-none" : ""
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        }
        padded={false}
      >
        {/* Status filter chips */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b dash-border-soft overflow-x-auto">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-[11.5px] font-semibold rounded-md px-2.5 py-1 transition capitalize whitespace-nowrap ${
                statusFilter === s
                  ? "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]"
                  : "text-[var(--dash-ink-faint)] hover:text-[var(--dash-ink-soft)]"
              }`}
            >
              {s}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-[var(--dash-ink-faint)] shrink-0">
            {displayRows.length}
            {data?.total ? ` of ${data.total}` : ""}
          </span>
        </div>

        {/* Table */}
        <div
          ref={containerRef}
          tabIndex={0}
          onKeyDown={handleContainerKeyDown}
          className="overflow-x-auto outline-none focus-visible:ring-1 focus-visible:ring-[var(--dash-accent)] focus-visible:ring-inset"
          aria-label="Tickets list"
          role="grid"
          aria-rowcount={displayRows.length}
        >
          <table className="w-full text-[12.5px]">
            <thead className="text-left text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)] bg-[var(--dash-bg-deep)]/50">
              <tr>
                {selectionMode && (
                  <th className="w-10 px-4 py-2.5">
                    <button
                      onClick={
                        selectedIds.size === displayRows.length && displayRows.length > 0
                          ? clearSelection
                          : selectAll
                      }
                      aria-label="Toggle select all"
                      className="text-[var(--dash-ink-faint)] hover:text-[var(--dash-accent)] transition"
                    >
                      {selectedIds.size === displayRows.length && displayRows.length > 0 ? (
                        <CheckSquare className="w-3.5 h-3.5" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </th>
                )}
                <ColumnHeader col="subject"   sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Ticket</ColumnHeader>
                <ColumnHeader col="customer"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Customer</ColumnHeader>
                <th className="px-4 py-2.5 font-bold">Channel</th>
                <ColumnHeader col="status"    sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Status</ColumnHeader>
                <ColumnHeader col="priority"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Priority</ColumnHeader>
                <ColumnHeader col="createdAt" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Age</ColumnHeader>
                <th className="px-4 py-2.5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <TicketSkeleton key={i} selectionMode={selectionMode} />
                  ))
                : isError
                ? (
                  <tr>
                    <td colSpan={colCount} className="px-4 py-14 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <AlertCircle className="w-8 h-8 text-[var(--dash-rose)] opacity-50" />
                        <p className="text-[13px] font-semibold text-[var(--dash-ink)]">
                          Failed to load tickets
                        </p>
                        <button
                          onClick={() => refetch()}
                          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--dash-accent)] hover:underline"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                )
                : displayRows.length === 0
                ? (
                  <tr>
                    <td colSpan={colCount}>
                      <EmptyState
                        hasSearch={!!q}
                        hasFilter={statusFilter !== "All" || priorityFilter !== "All"}
                        onClear={() => {
                          setQ("")
                          setStatusFilter("All")
                          setPriorityFilter("All")
                        }}
                      />
                    </td>
                  </tr>
                )
                : displayRows.map((r, i) => (
                  <TableRow
                    key={r.ticket.id}
                    row={r}
                    index={i}
                    rowRef={(el) => {
                      if (el) rowRefs.current.set(i, el)
                      else rowRefs.current.delete(i)
                    }}
                    isFocused={focusedIdx === i}
                    isSelected={selectedIds.has(r.ticket.id)}
                    isSelectionMode={selectionMode}
                    onSelect={() => toggleSelection(r.ticket.id)}
                    onFocus={() => setFocusedIdx(i)}
                    onStatusChange={(status) => updateStatus.mutate({ id: r.ticket.id, status })}
                    isStatusPending={pendingStatusIds.has(r.ticket.id)}
                    error={rowErrors.get(r.ticket.id) ?? null}
                    onClearError={() =>
                      setRowErrors((prev) => {
                        const next = new Map(prev)
                        next.delete(r.ticket.id)
                        return next
                      })
                    }
                    onRetryStatus={() => {
                      const vars = lastStatusVars.current.get(r.ticket.id)
                      if (vars) updateStatus.mutate(vars)
                    }}
                    searchQuery={q}
                    isOptimistic={r.ticket.id.startsWith("optimistic-")}
                  />
                ))}
            </tbody>
          </table>

          {/* Sentinel for intersection-observer infinite scroll */}
          <div ref={sentinelRef} className="h-px" aria-hidden="true" />

          {/* Pagination feedback */}
          {isFetching && !isLoading && (
            <div className="flex items-center justify-center gap-2 py-4 text-[11.5px] text-[var(--dash-ink-faint)]">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Loading more…
            </div>
          )}
          {!hasMore && !isLoading && displayRows.length > 0 && (
            <p className="py-3 text-center text-[11px] text-[var(--dash-ink-faint)]">
              All {data?.total ?? displayRows.length} tickets loaded
            </p>
          )}
        </div>
      </DashCard>

      {/* Bulk action bar — floats above content */}
      <AnimatePresence>
        {selectionMode && selectedIds.size > 0 && (
          <BulkActionBar
            count={selectedIds.size}
            isPending={bulkUpdateStatus.isPending}
            onCancel={() => {
              setSelectionMode(false)
              setSelectedIds(new Set())
            }}
            onBulkStatus={(status) =>
              bulkUpdateStatus.mutate({ ids: Array.from(selectedIds), status })
            }
          />
        )}
      </AnimatePresence>

      {/* New ticket slide-in sheet */}
      <NewTicketModal
        open={showNewTicket}
        onClose={() => setShowNewTicket(false)}
        onCreate={(vals) => createTicket.mutate(vals)}
        isPending={createTicket.isPending}
      />
    </div>
  )
}

// ─── ColumnHeader ─────────────────────────────────────────────────────────────

function ColumnHeader({
  col,
  sortCol,
  sortDir,
  onSort,
  children,
}: {
  col: SortCol
  sortCol: SortCol
  sortDir: "asc" | "desc"
  onSort: (col: SortCol) => void
  children: React.ReactNode
}) {
  const active = col === sortCol
  return (
    <th className="px-4 py-2.5">
      <button
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider transition ${
          active
            ? "text-[var(--dash-accent-deep)]"
            : "text-[var(--dash-ink-faint)] hover:text-[var(--dash-ink-soft)]"
        }`}
      >
        {children}
        {active ? (
          sortDir === "desc"
            ? <ArrowDown className="w-2.5 h-2.5" />
            : <ArrowUp   className="w-2.5 h-2.5" />
        ) : (
          <ArrowUpDown className="w-2.5 h-2.5 opacity-30" />
        )}
      </button>
    </th>
  )
}

// ─── TableRow ─────────────────────────────────────────────────────────────────

type TableRowProps = {
  row: TicketRow
  index: number
  rowRef: (el: HTMLTableRowElement | null) => void
  isFocused: boolean
  isSelected: boolean
  isSelectionMode: boolean
  onSelect: () => void
  onFocus: () => void
  onStatusChange: (s: TicketStatus) => void
  isStatusPending: boolean
  error: string | null
  onClearError: () => void
  onRetryStatus: () => void
  searchQuery: string
  isOptimistic: boolean
}

function TableRow({
  row,
  index,
  rowRef,
  isFocused,
  isSelected,
  isSelectionMode,
  onSelect,
  onFocus,
  onStatusChange,
  isStatusPending,
  error,
  onClearError,
  onRetryStatus,
  searchQuery,
  isOptimistic,
}: TableRowProps) {
  const { ticket, customer } = row
  const colCount = isSelectionMode ? 8 : 7

  return (
    <>
      <tr
        ref={rowRef}
        onClick={isSelectionMode ? onSelect : onFocus}
        role="row"
        aria-selected={isSelected}
        aria-rowindex={index + 1}
        tabIndex={isFocused ? 0 : -1}
        className={`border-t dash-border-soft transition-colors cursor-pointer group ${
          isSelected
            ? "bg-[var(--dash-accent-wash)]"
            : isFocused
            ? "bg-[rgba(107,92,214,0.07)] outline outline-1 outline-[var(--dash-accent)]/30 outline-offset-[-1px]"
            : "hover:bg-[rgba(107,92,214,0.04)]"
        } ${isOptimistic ? "opacity-60" : ""}`}
      >
        {/* Checkbox (selection mode) */}
        {isSelectionMode && (
          <td className="w-10 px-4 py-3">
            {isSelected
              ? <CheckSquare className="w-3.5 h-3.5 text-[var(--dash-accent)]" />
              : <Square      className="w-3.5 h-3.5 text-[var(--dash-ink-faint)] group-hover:text-[var(--dash-ink-soft)]" />
            }
          </td>
        )}

        {/* Ticket ID + Subject */}
        <td className="px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10.5px] text-[var(--dash-ink-faint)]">
              #{ticket.id.slice(0, 8).toUpperCase()}
              {isOptimistic && (
                <span className="ml-1.5 font-sans text-[9.5px] font-bold text-[var(--dash-accent)]">
                  Creating…
                </span>
              )}
            </span>
            <span className="font-semibold text-[var(--dash-ink)] max-w-[280px] truncate leading-snug">
              <HighlightMatch text={ticket.subject} query={searchQuery} />
            </span>
            {ticket.aiResolved && (
              <span className="inline-flex items-center gap-1 w-fit text-[9.5px] font-bold text-[var(--dash-accent-deep)] bg-[var(--dash-accent-wash)] rounded px-1.5 py-0.5">
                <Zap className="w-2.5 h-2.5" /> AI Resolved
              </span>
            )}
          </div>
        </td>

        {/* Customer */}
        <td className="px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[var(--dash-ink-soft)]">
              <HighlightMatch text={customer?.name ?? "—"} query={searchQuery} />
            </span>
            {customer?.tier && customer.tier !== "free" && (
              <span
                className={`w-fit text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                  customer.tier === "enterprise"
                    ? "bg-[#EDE9FE] text-[#5B21B6]"
                    : "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]"
                }`}
              >
                {customer.tier}
              </span>
            )}
          </div>
        </td>

        {/* Channel */}
        <td className="px-4 py-3">
          <span className="inline-flex items-center gap-1.5 text-[var(--dash-ink-soft)] capitalize">
            <span className="text-[var(--dash-ink-faint)]">{CHANNEL_ICONS[ticket.channel]}</span>
            {ticket.channel}
          </span>
        </td>

        {/* Status (interactive dropdown) */}
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <StatusDropdown
            currentStatus={ticket.status}
            onUpdate={onStatusChange}
            isPending={isStatusPending}
          />
        </td>

        {/* Priority */}
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center text-[11px] font-bold rounded-md px-2 py-0.5 capitalize ${PRIORITY_TONE[ticket.priority]}`}
          >
            {ticket.priority}
          </span>
        </td>

        {/* Age */}
        <td className="px-4 py-3 text-[11.5px] text-[var(--dash-ink-faint)]">
          {relativeTime(ticket.createdAt)}
        </td>

        {/* Actions */}
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Link
              href={`/dashboard/conversations?ticketId=${ticket.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[11.5px] font-semibold text-[var(--dash-accent)] hover:underline"
            >
              View
            </Link>
          </div>
        </td>
      </tr>

      {/* Inline row error with retry */}
      {error && (
        <tr className="bg-[var(--dash-rose-wash)] border-t border-[#E8B4B4]">
          <td colSpan={colCount} className="px-4 py-2">
            <div className="flex items-center gap-2 text-[11.5px] text-[#7a2929]">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
              <button
                onClick={onRetryStatus}
                className="font-bold underline hover:no-underline"
              >
                Retry
              </button>
              <button
                onClick={onClearError}
                className="ml-auto hover:opacity-70 transition"
                aria-label="Dismiss error"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── StatusDropdown ───────────────────────────────────────────────────────────

function StatusDropdown({
  currentStatus,
  onUpdate,
  isPending,
}: {
  currentStatus: TicketStatus
  onUpdate: (s: TicketStatus) => void
  isPending: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open])

  const DOT_COLORS: Record<TicketStatus, string> = {
    open:     "bg-[var(--dash-sage)]",
    pending:  "bg-[var(--dash-amber)]",
    resolved: "bg-[var(--dash-blue)]",
    closed:   "bg-[var(--dash-line)]",
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); if (!isPending) setOpen((v) => !v) }}
        disabled={isPending}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center gap-1 text-[11px] font-bold rounded-md px-2 py-1 capitalize transition ${
          STATUS_TONE[currentStatus]
        } ${isPending ? "opacity-50 cursor-not-allowed" : "hover:opacity-80 cursor-pointer"}`}
      >
        {isPending
          ? <span className="animate-pulse">…</span>
          : <>{currentStatus}<ChevronDown className="w-2.5 h-2.5 opacity-60" /></>
        }
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{   opacity: 0, scale: 0.95, y: -4  }}
            transition={{ duration: 0.11 }}
            className="absolute left-0 top-full mt-1 z-50 min-w-[140px] rounded-xl bg-[var(--dash-card)] border dash-border shadow-lg overflow-hidden"
            role="listbox"
            aria-label="Select status"
          >
            {TICKET_STATUSES.map((s) => (
              <button
                key={s}
                role="option"
                aria-selected={s === currentStatus}
                onClick={(e) => { e.stopPropagation(); if (s !== currentStatus) onUpdate(s); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-[11.5px] font-semibold capitalize transition flex items-center gap-2 hover:bg-[var(--dash-bg-deep)] ${
                  s === currentStatus
                    ? "text-[var(--dash-accent-deep)] bg-[var(--dash-accent-wash)]"
                    : "text-[var(--dash-ink-soft)]"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_COLORS[s]}`} />
                {s}
                {s === currentStatus && (
                  <span className="ml-auto text-[var(--dash-accent)] text-[10px] font-bold">✓</span>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── PriorityPicker ───────────────────────────────────────────────────────────

function PriorityPicker({
  value,
  onChange,
}: {
  value: PriorityFilter
  onChange: (v: PriorityFilter) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Filter by priority"
        className={`inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-lg border text-[12px] font-semibold transition ${
          value !== "All"
            ? "border-[var(--dash-accent)] bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]"
            : "dash-border bg-[var(--dash-card)] text-[var(--dash-ink-soft)] hover:bg-[var(--dash-bg-deep)]"
        }`}
      >
        <Filter className="w-3.5 h-3.5" />
        <span className="capitalize">{value !== "All" ? value : "Priority"}</span>
        <ChevronDown className="w-3 h-3 opacity-50" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{   opacity: 0, scale: 0.95, y: -4  }}
            transition={{ duration: 0.11 }}
            className="absolute right-0 top-full mt-1 z-50 min-w-[150px] rounded-xl bg-[var(--dash-card)] border dash-border shadow-lg overflow-hidden"
          >
            {PRIORITY_FILTERS.map((p) => (
              <button
                key={p}
                onClick={() => { onChange(p); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-[11.5px] font-semibold capitalize transition flex items-center gap-2 hover:bg-[var(--dash-bg-deep)] ${
                  p === value
                    ? "text-[var(--dash-accent-deep)] bg-[var(--dash-accent-wash)]"
                    : "text-[var(--dash-ink-soft)]"
                }`}
              >
                {p !== "All" && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded capitalize ${PRIORITY_TONE[p as TicketPriority]}`}>
                    {p}
                  </span>
                )}
                {p === "All" ? "All priorities" : ""}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── HighlightMatch ───────────────────────────────────────────────────────────

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim() || !text) return <>{text}</>
  const lower = text.toLowerCase()
  const lowerQ = query.toLowerCase()
  const idx = lower.indexOf(lowerQ)
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[var(--dash-amber-wash)] text-[#6b4f1a] rounded-sm px-0.5 not-italic font-semibold">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

// ─── TicketSkeleton ───────────────────────────────────────────────────────────

function TicketSkeleton({ selectionMode }: { selectionMode: boolean }) {
  return (
    <tr className="border-t dash-border-soft">
      {selectionMode && (
        <td className="w-10 px-4 py-3">
          <div className="skeleton w-3.5 h-3.5 rounded" />
        </td>
      )}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1.5">
          <div className="skeleton h-2.5 w-16 rounded" />
          <div className="skeleton h-4 w-52 rounded" />
        </div>
      </td>
      <td className="px-4 py-3"><div className="skeleton h-4 w-24 rounded" /></td>
      <td className="px-4 py-3"><div className="skeleton h-4 w-16 rounded" /></td>
      <td className="px-4 py-3"><div className="skeleton h-5 w-20 rounded-md" /></td>
      <td className="px-4 py-3"><div className="skeleton h-5 w-16 rounded-md" /></td>
      <td className="px-4 py-3"><div className="skeleton h-3 w-14 rounded" /></td>
      <td className="px-4 py-3"><div className="skeleton h-3 w-8 rounded ml-auto" /></td>
    </tr>
  )
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({
  hasSearch,
  hasFilter,
  onClear,
}: {
  hasSearch: boolean
  hasFilter: boolean
  onClear: () => void
}) {
  const filtered = hasSearch || hasFilter
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[var(--dash-bg-deep)] flex items-center justify-center mb-4">
        <Inbox className="w-6 h-6 text-[var(--dash-ink-faint)] opacity-70" />
      </div>
      <p className="text-[14px] font-bold text-[var(--dash-ink)] mb-1">
        {filtered ? "No matching tickets" : "No tickets yet"}
      </p>
      <p className="text-[12.5px] text-[var(--dash-ink-soft)] max-w-[260px] mb-4 leading-relaxed">
        {filtered
          ? "Try a different search term or clear active filters."
          : "Tickets appear here when customers reach out across any channel."}
      </p>
      {filtered && (
        <button
          onClick={onClear}
          className="text-[12px] font-semibold text-[var(--dash-accent)] hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}

// ─── BulkActionBar ────────────────────────────────────────────────────────────

function BulkActionBar({
  count,
  isPending,
  onCancel,
  onBulkStatus,
}: {
  count: number
  isPending: boolean
  onCancel: () => void
  onBulkStatus: (s: TicketStatus) => void
}) {
  return (
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1  }}
      exit={{   y: 24, opacity: 0  }}
      transition={{ type: "spring", damping: 26, stiffness: 300 }}
      className="fixed inset-x-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:bottom-6 z-50 flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 rounded-2xl bg-[var(--dash-ink)] text-white shadow-[0_8px_40px_-8px_rgba(42,37,32,0.7)] border border-white/10 max-w-[calc(100vw-2rem)]"
      role="toolbar"
      aria-label="Bulk actions"
    >
      <span className="text-[12.5px] font-bold whitespace-nowrap">
        <Tag className="w-3.5 h-3.5 inline mr-1.5 opacity-60" />
        {count} selected
      </span>

      <div className="w-px h-4 bg-white/20 shrink-0" />

      {isPending ? (
        <span className="text-[12px] text-white/50 animate-pulse">Updating…</span>
      ) : (
        <>
          <BulkBtn onClick={() => onBulkStatus("resolved")} label="✓ Resolve"  />
          <BulkBtn onClick={() => onBulkStatus("pending")}  label="↻ Pending"  />
          <BulkBtn onClick={() => onBulkStatus("closed")}   label="✕ Close" dim />
        </>
      )}

      <div className="w-px h-4 bg-white/20 shrink-0" />
      <button
        onClick={onCancel}
        className="text-[12px] font-semibold text-white/50 hover:text-white transition"
      >
        Cancel
      </button>
    </motion.div>
  )
}

function BulkBtn({
  onClick,
  label,
  dim = false,
}: {
  onClick: () => void
  label: string
  dim?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[12px] font-semibold px-2.5 py-1 rounded-lg transition bg-white/10 hover:bg-white/20 ${
        dim ? "text-white/60 hover:text-white" : "text-white"
      }`}
    >
      {label}
    </button>
  )
}

// ─── NewTicketModal ───────────────────────────────────────────────────────────

function NewTicketModal({
  open,
  onClose,
  onCreate,
  isPending,
}: {
  open: boolean
  onClose: () => void
  onCreate: (data: CreateTicketInput) => void
  isPending: boolean
}) {
  const [subject, setSubject]     = useState("")
  const [priority, setPriority]   = useState<TicketPriority>("medium")
  const [channel, setChannel]     = useState<TicketChannel>("email")
  const [customerId, setCustomerId] = useState("")
  const [validErr, setValidErr]   = useState("")
  const subjectRef = useRef<HTMLInputElement>(null)

  const { data: customers = [], isLoading: customersLoading } = api.customers.list.useQuery(
    { limit: 100, offset: 0 },
    { enabled: open && channel === "email", staleTime: 30_000 }
  )

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === customerId) ?? null,
    [customers, customerId]
  )
  const subjectError = validErr.startsWith("Subject") ? validErr : ""
  const customerError = validErr && !subjectError ? validErr : ""

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => subjectRef.current?.focus(), 80)
      return () => clearTimeout(t)
    } else {
      setSubject("")
      setPriority("medium")
      setChannel("email")
      setCustomerId("")
      setValidErr("")
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onClose])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = subject.trim()
      if (!trimmed) {
        setValidErr("Subject is required")
        subjectRef.current?.focus()
        return
      }
      if (trimmed.length < 4) {
        setValidErr("Subject must be at least 4 characters")
        subjectRef.current?.focus()
        return
      }
      if (channel === "email") {
        if (!selectedCustomer) {
          setValidErr("Choose a customer with a valid email address for email tickets")
          return
        }
        if (!isValidEmail(selectedCustomer.email)) {
          setValidErr("Selected customer needs a valid email address before creating an email ticket")
          return
        }
      }
      setValidErr("")
      onCreate({
        subject: trimmed,
        priority,
        channel,
        customerId: channel === "email" ? customerId : undefined,
      })
    },
    [subject, priority, channel, customerId, selectedCustomer, onCreate]
  )

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-[var(--dash-ink)]/20 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sheet */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed inset-x-0 sm:inset-x-auto sm:right-0 top-0 h-full z-50 w-full sm:w-[min(100%,400px)] bg-[var(--dash-card)] flex flex-col border-l dash-border shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-ticket-title"
          >
            {/* Header */}
            <div className="flex items-start justify-between px-5 py-4 border-b dash-border">
              <div>
                <h2 id="new-ticket-title" className="text-[15px] font-bold text-[var(--dash-ink)]">
                  New Ticket
                </h2>
                <p className="text-[11.5px] text-[var(--dash-ink-faint)] mt-0.5">
                  Opens immediately in the queue
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close panel"
                className="p-1.5 rounded-lg text-[var(--dash-ink-faint)] hover:text-[var(--dash-ink)] hover:bg-[var(--dash-bg-deep)] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="flex flex-col h-full overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Subject */}
                <div>
                  <label
                    htmlFor="ticket-subject"
                    className="block text-[11.5px] font-bold text-[var(--dash-ink-soft)] uppercase tracking-wide mb-1.5"
                  >
                    Subject <span className="text-[var(--dash-rose)] font-bold">*</span>
                  </label>
                  <input
                    id="ticket-subject"
                    ref={subjectRef}
                    value={subject}
                    onChange={(e) => {
                      setSubject(e.target.value)
                      if (validErr) setValidErr("")
                    }}
                    placeholder="e.g. Unable to log in to account"
                    maxLength={255}
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-[var(--dash-bg-deep)] border text-[13px] text-[var(--dash-ink)] placeholder:text-[var(--dash-ink-faint)] outline-none transition focus:ring-2 focus:ring-[var(--dash-accent)]/40 focus:border-[var(--dash-accent)] ${
                      subjectError ? "border-[var(--dash-rose)]" : "dash-border"
                    }`}
                  />
                  {subjectError && (
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] text-[#7a2929]">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {subjectError}
                    </p>
                  )}
                </div>

                {/* Priority */}
                <div>
                  <p className="text-[11.5px] font-bold text-[var(--dash-ink-soft)] uppercase tracking-wide mb-1.5">
                    Priority
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {TICKET_PRIORITIES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`py-2 rounded-lg text-[11.5px] font-semibold capitalize transition ${
                          priority === p
                            ? `${PRIORITY_TONE[p]} ring-2 ring-[var(--dash-accent)]/50 ring-offset-1`
                            : "bg-[var(--dash-bg-deep)] text-[var(--dash-ink-faint)] hover:bg-[var(--dash-line-soft)]"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Channel */}
                <div>
                  <p className="text-[11.5px] font-bold text-[var(--dash-ink-soft)] uppercase tracking-wide mb-1.5">
                    Channel
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {TICKET_CHANNELS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setChannel(c)
                          if (validErr) setValidErr("")
                        }}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11.5px] font-semibold capitalize transition ${
                          channel === c
                            ? "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)] ring-2 ring-[var(--dash-accent)]/50 ring-offset-1"
                            : "bg-[var(--dash-bg-deep)] text-[var(--dash-ink-faint)] hover:bg-[var(--dash-line-soft)]"
                        }`}
                      >
                        {CHANNEL_ICONS[c]}
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {channel === "email" && (
                  <div>
                    <label
                      htmlFor="ticket-customer"
                      className="block text-[11.5px] font-bold text-[var(--dash-ink-soft)] uppercase tracking-wide mb-1.5"
                    >
                      Customer <span className="text-[var(--dash-rose)] font-bold">*</span>
                    </label>
                    <select
                      id="ticket-customer"
                      value={customerId}
                      onChange={(e) => {
                        setCustomerId(e.target.value)
                        if (validErr) setValidErr("")
                      }}
                      disabled={customersLoading}
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-[var(--dash-bg-deep)] border text-[13px] text-[var(--dash-ink)] outline-none transition focus:ring-2 focus:ring-[var(--dash-accent)]/40 focus:border-[var(--dash-accent)] ${
                        customerError ? "border-[var(--dash-rose)]" : "dash-border"
                      }`}
                    >
                      <option value="">
                        {customersLoading ? "Loading customers..." : "Select a customer"}
                      </option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name || customer.email || "Unnamed customer"}
                          {customer.email ? ` — ${customer.email}` : " — no email"}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-[11px] text-[var(--dash-ink-faint)]">
                      Email tickets can only be opened for customers with a valid email address.
                    </p>
                    {customerError && (
                      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-[#7a2929]">
                        <AlertCircle className="w-3 h-3 shrink-0" /> {customerError}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-2.5 px-5 py-4 border-t dash-border">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 rounded-xl border dash-border text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:bg-[var(--dash-bg-deep)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition ${
                    !isPending
                      ? "bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] text-white shadow-[0_4px_14px_-4px_rgba(107,92,214,0.5)] hover:opacity-90"
                      : "bg-[var(--dash-bg-deep)] text-[var(--dash-ink-faint)] cursor-not-allowed"
                  }`}
                >
                  {isPending ? (
                    <span className="animate-pulse">Creating…</span>
                  ) : (
                    "Create Ticket"
                  )}
                </button>
              </div>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
