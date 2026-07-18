"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { useCallback, useMemo } from "react"
import {
  ArrowUpRight,
  Sparkles,
  MessageSquare,
  Clock,
  Smile,
  CheckCircle2,
  Activity,
  Ticket,
  AlertCircle,
  RefreshCw,
  Bot,
  Inbox,
  PackageOpen,
  Zap,
  BookOpen,
  TriangleAlert,
  Timer,
  CalendarClock,
  ExternalLink,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"
import { api } from "@/lib/api/trpc-client"
import { useSession } from "next-auth/react"
import {
  CHANNEL_LABEL,
  PRIORITY_TONE,
  STATUS_TONE,
} from "@/lib/dashboard/constants"
import {
  formatCount,
  formatCsat,
  formatDuration,
  formatPercent,
  formatRelativeTime,
  getGreeting,
  getInitials,
} from "@/lib/dashboard/format"
import type { OrgOverview } from "@/lib/analytics/org-overview"

// ─── Shared helpers ────────────────────────────────────────────────────────

type StatCard = {
  label: string
  value: string
  icon: LucideIcon
  hint?: string
  loading: boolean
}

// ─── Error + skeleton sub-components ──────────────────────────────────────

function OverviewError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="dash-card p-4 mb-5 flex flex-col sm:flex-row sm:items-center gap-3 border border-[#E8C4C4] bg-[#FDF5F5]"
    >
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        <AlertCircle className="w-5 h-5 text-[var(--dash-rose)] shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="text-[13px] font-bold text-[var(--dash-ink)]">
            Could not load workspace overview
          </p>
          <p className="text-[12.5px] text-[var(--dash-ink-soft)] mt-0.5">{message}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:dash-shadow-sm transition shrink-0"
      >
        <RefreshCw className="w-4 h-4" aria-hidden />
        Retry
      </button>
    </div>
  )
}

function StatSkeleton() {
  return <div className="skeleton h-7 w-16 rounded mt-1" aria-hidden />
}

function ActivitySkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} aria-hidden className="flex items-center gap-3 px-4 py-3 border-b dash-border-soft">
          <div className="skeleton w-8 h-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-3.5 w-32 rounded" />
            <div className="skeleton h-3 w-48 rounded" />
          </div>
          <div className="skeleton h-5 w-14 rounded" />
        </li>
      ))}
    </>
  )
}

function CopilotStatusBadge({ status }: { status: "active" | "idle" | "no_data" }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold rounded-md px-1.5 py-0.5 text-[#2f5d3f] bg-[var(--dash-sage-wash)]">
        <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-[var(--dash-sage)] dash-pulse-dot" />
        Active
      </span>
    )
  }
  if (status === "idle") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-bold rounded-md px-1.5 py-0.5 text-[var(--dash-ink-soft)] bg-[var(--dash-line)]">
        Standby
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-bold rounded-md px-1.5 py-0.5 text-[var(--dash-ink-faint)] bg-[var(--dash-line)]">
      Setup needed
    </span>
  )
}

// ─── Queue Breakdown Card ──────────────────────────────────────────────────

type QueueRow = {
  status: "open" | "pending" | "resolved" | "closed"
  label: string
  color: string
  wash: string
}

const QUEUE_ROWS: QueueRow[] = [
  { status: "open",     label: "Open",     color: "var(--dash-amber)",      wash: "var(--dash-amber-wash)" },
  { status: "pending",  label: "Pending",  color: "var(--dash-blue)",       wash: "var(--dash-blue-wash)" },
  { status: "resolved", label: "Resolved", color: "var(--dash-sage)",       wash: "var(--dash-sage-wash)" },
  { status: "closed",   label: "Closed",   color: "var(--dash-ink-faint)",  wash: "var(--dash-line)" },
]

function QueueBreakdownCard({
  data,
  isLoading,
}: {
  data: OrgOverview | undefined
  isLoading: boolean
}) {
  const total = data?.queue.total ?? 0

  return (
    <DashCard
      title="Queue breakdown"
      icon={<Ticket className="w-[18px] h-[18px]" aria-hidden />}
      right={
        data ? (
          <span className="text-[11px] font-bold text-[var(--dash-ink-faint)]">
            {formatCount(total)} total
          </span>
        ) : undefined
      }
    >
      <div className="space-y-1" aria-busy={isLoading}>
        {isLoading ? (
          /* ── Skeleton ── */
          <div className="space-y-3 pt-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} aria-hidden className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="skeleton w-2 h-2 rounded-full" />
                  <div className="skeleton h-3.5 w-16 rounded" />
                  <div className="skeleton h-3.5 w-8 rounded ml-auto" />
                </div>
                <div className="skeleton h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        ) : !data ? (
          /* ── Error / no-data state ── */
          <div className="py-6 flex flex-col items-center gap-2 text-center">
            <PackageOpen className="w-8 h-8 text-[var(--dash-ink-faint)]" aria-hidden />
            <p className="text-[12.5px] text-[var(--dash-ink-soft)]">No queue data available</p>
          </div>
        ) : (
          /* ── Data rows ── */
          <>
            {QUEUE_ROWS.map((row) => {
              const count = data.queue[row.status]
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              // Max bar is relative to the largest single status count (not total)
              // so small counts still show a visible bar
              const maxCount = Math.max(
                data.queue.open,
                data.queue.pending,
                data.queue.resolved,
                data.queue.closed,
                1
              )
              const barWidth = Math.round((count / maxCount) * 100)
              const isActionable = row.status === "open" || row.status === "pending"

              return (
                <Link
                  key={row.status}
                  href={`/dashboard/tickets?status=${row.status}`}
                  className="block group rounded-lg px-2 py-2 -mx-2 hover:bg-[rgba(107,92,214,0.04)] transition"
                  aria-label={`View ${row.label} tickets (${count})`}
                >
                  {/* Label row */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      aria-hidden
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: row.color }}
                    />
                    <span
                      className={`text-[12.5px] flex-1 ${
                        isActionable
                          ? "font-semibold text-[var(--dash-ink)]"
                          : "font-medium text-[var(--dash-ink-soft)]"
                      }`}
                    >
                      {row.label}
                    </span>
                    <span className="text-[11px] text-[var(--dash-ink-faint)] tabular-nums">
                      {pct}%
                    </span>
                    <span
                      className="text-[12px] font-bold rounded-md px-2 py-0.5 tabular-nums min-w-[32px] text-center"
                      style={{ background: row.wash, color: row.color }}
                    >
                      {formatCount(count)}
                    </span>
                    <ArrowUpRight
                      aria-hidden
                      className="w-3 h-3 text-[var(--dash-ink-faint)] opacity-0 group-hover:opacity-100 transition shrink-0"
                    />
                  </div>

                  {/* Proportion bar */}
                  <div
                    aria-hidden
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: "var(--dash-line)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${barWidth}%`,
                        background: row.color,
                        opacity: count === 0 ? 0.25 : 1,
                      }}
                    />
                  </div>
                </Link>
              )
            })}

            {/* AI resolution separator — only when meaningful */}
            {data.metrics.aiResolutionRate > 0 && (
              <div className="pt-3 mt-2 border-t dash-border-soft flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[var(--dash-accent)] shrink-0" aria-hidden />
                <span className="text-[12.5px] text-[var(--dash-ink-soft)] flex-1">
                  AI resolution rate
                </span>
                <span className="text-[12px] font-bold rounded-md px-2 py-0.5 bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)] tabular-nums">
                  {formatPercent(data.metrics.aiResolutionRate)}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </DashCard>
  )
}

// ─── AI Copilot Status Card ────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value))
  // Colour shifts green → amber → rose based on confidence level
  const color =
    clamped >= 80
      ? "var(--dash-sage)"
      : clamped >= 60
        ? "var(--dash-amber)"
        : "var(--dash-rose)"

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
      <span className="font-bold tabular-nums" style={{ color }}>
        {formatPercent(clamped)}
      </span>
      <div
        aria-hidden
        className="w-[60px] h-1.5 rounded-full overflow-hidden shrink-0"
        style={{ background: "var(--dash-line)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${clamped}%`, background: color }}
        />
      </div>
    </div>
  )
}

function CopilotRow({
  label,
  icon: Icon,
  children,
}: {
  label: string
  icon?: LucideIcon
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 min-h-[22px]">
      {Icon && <Icon className="w-3.5 h-3.5 text-[var(--dash-ink-faint)] shrink-0" aria-hidden />}
      <span className="text-[12.5px] text-[var(--dash-ink-soft)] flex-1">{label}</span>
      <div className="flex items-center gap-1.5 shrink-0 text-[12.5px] font-semibold text-[var(--dash-ink)]">
        {children}
      </div>
    </div>
  )
}

function CopilotStatusCard({
  data,
  isLoading,
}: {
  data: OrgOverview | undefined
  isLoading: boolean
}) {
  const copilot = data?.copilot
  const noData = copilot?.status === "no_data"
  const uncitedWarning =
    !noData &&
    copilot?.avgSourcesPerAnswer != null &&
    copilot.avgSourcesPerAnswer < 1

  return (
    <DashCard
      title="AI Copilot status"
      icon={<Sparkles className="w-[18px] h-[18px]" aria-hidden />}
      right={
        copilot?.status && !isLoading ? (
          <CopilotStatusBadge status={copilot.status} />
        ) : isLoading ? (
          <div aria-hidden className="skeleton h-5 w-16 rounded" />
        ) : undefined
      }
    >
      <div className="space-y-2.5" aria-busy={isLoading}>
        {isLoading ? (
          /* ── Skeleton ── */
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} aria-hidden className="flex items-center justify-between gap-3">
                <div className="skeleton h-3.5 w-20 rounded" />
                <div className="skeleton h-3.5 w-16 rounded" />
              </div>
            ))}
          </>
        ) : noData ? (
          /* ── Onboarding / no-data state ── */
          <div className="py-2 space-y-3">
            <div className="flex items-start gap-2.5 rounded-lg bg-[var(--dash-accent-wash)] p-3">
              <Sparkles className="w-4 h-4 text-[var(--dash-accent-deep)] shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-[12.5px] font-bold text-[var(--dash-accent-deep)]">
                  Copilot hasn&rsquo;t run yet
                </p>
                <p className="text-[12px] text-[var(--dash-ink-soft)] mt-0.5 leading-relaxed">
                  Open a ticket, ask Copilot to draft a reply, and confidence &amp; latency metrics will appear here.
                </p>
              </div>
            </div>
            {/* Still show configured model even without activity */}
            <CopilotRow label="Model" icon={Zap}>
              <span className="font-mono text-[11.5px] text-[var(--dash-ink)]" title={copilot?.model}>
                {copilot?.model ?? "—"}
              </span>
            </CopilotRow>
          </div>
        ) : (
          /* ── Live data ── */
          <>
            <CopilotRow label="Model" icon={Zap}>
              <span
                className="font-mono text-[11.5px] text-[var(--dash-ink)] truncate max-w-[140px]"
                title={copilot?.model}
              >
                {copilot?.model ?? "—"}
              </span>
            </CopilotRow>

            <CopilotRow label="Avg confidence" icon={CheckCircle2}>
              {copilot?.avgConfidence != null ? (
                <ConfidenceBar value={copilot.avgConfidence} />
              ) : (
                <span className="text-[var(--dash-ink-faint)]">—</span>
              )}
            </CopilotRow>

            <CopilotRow label="Sources / answer" icon={BookOpen}>
              {copilot?.avgSourcesPerAnswer != null ? (
                <span
                  className={
                    uncitedWarning
                      ? "text-[var(--dash-amber)] font-bold"
                      : "text-[var(--dash-ink)]"
                  }
                >
                  {copilot.avgSourcesPerAnswer.toFixed(1)}
                </span>
              ) : (
                <span className="text-[var(--dash-ink-faint)]">—</span>
              )}
            </CopilotRow>

            <CopilotRow label="Avg latency" icon={Timer}>
              <span className="text-[var(--dash-ink)]">
                {formatDuration(copilot?.avgLatencyMs)}
              </span>
            </CopilotRow>

            <CopilotRow label="Last active" icon={CalendarClock}>
              <span className="text-[var(--dash-ink-soft)]">
                {formatRelativeTime(copilot?.lastActivityAt)}
              </span>
            </CopilotRow>

            {/* Warning: uncited answers */}
            {uncitedWarning && (
              <div className="flex items-start gap-2 rounded-lg bg-[var(--dash-amber-wash)] p-2.5 mt-1">
                <TriangleAlert
                  className="w-3.5 h-3.5 text-[var(--dash-amber)] shrink-0 mt-0.5"
                  aria-hidden
                />
                <p className="text-[11.5px] text-[#5a3e1c] leading-relaxed">
                  Avg sources below 1 — answers may not be citing knowledge base
                  articles. Check your KB in{" "}
                  <Link
                    href="/dashboard/knowledge-base"
                    className="font-bold underline hover:no-underline"
                  >
                    Knowledge Base
                  </Link>
                  .
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Tap Box footer — always visible */}
      <div className="mt-3.5 pt-3 border-t dash-border-soft">
        <Link
          href="/dashboard/tap-box"
          className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--dash-accent-deep)] hover:underline"
        >
          <ExternalLink className="w-3.5 h-3.5" aria-hidden />
          Inspect with Tap Box
        </Link>
      </div>
    </DashCard>
  )
}

// ─── Main Overview component ───────────────────────────────────────────────

export function DashboardOverview() {
  const { data: session } = useSession()
  const firstName = session?.user?.name?.split(" ")[0] ?? "there"

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = api.analytics.overview.useQuery(undefined, {
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  const handleRetry = useCallback(() => { void refetch() }, [refetch])

  const stats = useMemo<StatCard[]>(() => {
    const hasData = !isError && data != null
    return [
      {
        label: "Tickets resolved",
        value: formatCount(data?.metrics.resolved),
        icon: CheckCircle2,
        hint: hasData ? `${formatCount(data.queue.total)} total in queue` : undefined,
        loading: isLoading,
      },
      {
        label: "AI resolution rate",
        value: formatPercent(data?.metrics.aiResolutionRate),
        icon: Sparkles,
        hint: hasData ? `${formatCount(data.metrics.aiResolved)} AI-resolved` : undefined,
        loading: isLoading,
      },
      {
        label: "Avg first response",
        value: formatDuration(data?.metrics.avgFirstReplyMs),
        icon: Clock,
        hint: hasData
          ? data.metrics.avgFirstReplyMs != null
            ? "Across all replied tickets"
            : "No reply data yet"
          : undefined,
        loading: isLoading,
      },
      {
        label: "CSAT",
        value: formatCsat(data?.metrics.csat),
        icon: Smile,
        hint: hasData
          ? data.metrics.csat != null
            ? "Customer satisfaction avg"
            : "No ratings yet"
          : undefined,
        loading: isLoading,
      },
    ]
  }, [data, isLoading, isError])

  const recentActivity = data?.recentActivity ?? []
  const openConversations = data?.metrics.openConversations ?? 0
  const hitlPending = data?.metrics.hitlPending ?? 0

  return (
    <div>
      <DashPageHeader
        eyebrow="Workspace"
        title={getGreeting(firstName)}
        subtitle={
          isLoading
            ? "Loading your support performance…"
            : data
              ? `${formatCount(data.queue.open)} open · ${formatCount(openConversations)} conversations · ${formatPercent(data.metrics.aiResolutionRate)} AI-led`
              : "Here's how your support team and Advan AI are performing today."
        }
        actions={
          <>
            <Link
              href="/dashboard/conversations"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:dash-shadow-sm transition"
            >
              <MessageSquare className="w-4 h-4" aria-hidden />
              Conversations
              {openConversations > 0 && (
                <span className="text-[10.5px] font-bold rounded-md px-1.5 py-0.5 bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]">
                  {openConversations}
                </span>
              )}
            </Link>
            <Link
              href="/dashboard/copilot"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] hover:-translate-y-px transition"
            >
              <Sparkles className="w-4 h-4" aria-hidden />
              Launch Copilot
            </Link>
          </>
        }
      />

      {/* Error banner */}
      {isError && (
        <OverviewError
          message={error?.message ?? "An unexpected error occurred."}
          onRetry={handleRetry}
        />
      )}

      {/* HITL pending alert */}
      {hitlPending > 0 && !isLoading && (
        <div
          role="status"
          aria-live="polite"
          className="dash-card p-3.5 mb-5 flex flex-col sm:flex-row sm:items-center gap-3 border border-[#E5D2A8] bg-[var(--dash-amber-wash)]"
        >
          <div className="flex items-center gap-2.5 flex-1">
            <Inbox className="w-4 h-4 text-[#8a5a1e] shrink-0" aria-hidden />
            <p className="text-[13px] text-[#5a3e1c]">
              <span className="font-bold">{hitlPending}</span>{" "}
              AI draft{hitlPending === 1 ? "" : "s"} waiting for human review.
            </p>
          </div>
          <Link
            href="/dashboard/copilot"
            className="inline-flex items-center gap-1 text-[12px] font-bold text-[#8a5a1e] hover:underline shrink-0"
          >
            Review in Copilot <ArrowUpRight className="w-3 h-3" aria-hidden />
          </Link>
        </div>
      )}

      {/* ── KPI stat cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {stats.map((s, i) => {
          const Icon = s.icon
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="dash-card p-4 lift cursor-default"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg dash-bg-accent-wash flex items-center justify-center">
                  <Icon className="w-4 h-4 text-[var(--dash-accent-deep)]" aria-hidden />
                </div>
                {!isLoading && data && (
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-bold rounded-md px-1.5 py-0.5 text-[#2f5d3f] bg-[var(--dash-sage-wash)]">
                    <ArrowUpRight className="w-3 h-3" aria-hidden /> Live
                  </span>
                )}
              </div>
              <div className="text-[11.5px] font-semibold uppercase tracking-wider text-[var(--dash-ink-faint)]">
                {s.label}
              </div>
              {s.loading ? (
                <StatSkeleton />
              ) : (
                <div className="mt-0.5 text-[24px] font-bold tracking-tight text-[var(--dash-ink)]">
                  {s.value}
                </div>
              )}
              {s.hint && !s.loading && (
                <p className="mt-1 text-[11px] text-[var(--dash-ink-faint)] truncate">{s.hint}</p>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* ── Activity + sidebar ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">

        {/* Recent activity */}
        <DashCard
          title="Recent activity"
          icon={<Activity className="w-[18px] h-[18px]" aria-hidden />}
          right={
            <div className="flex items-center gap-2">
              {isFetching && !isLoading && (
                <RefreshCw
                  className="w-3.5 h-3.5 text-[var(--dash-ink-faint)] animate-spin"
                  aria-label="Refreshing"
                />
              )}
              <Link
                href="/dashboard/tickets"
                className="text-[12px] font-semibold text-[var(--dash-accent-deep)] hover:underline"
              >
                View all
              </Link>
            </div>
          }
          padded={false}
        >
          <ul aria-label="Recent ticket activity" aria-busy={isLoading}>
            {isLoading ? (
              <ActivitySkeleton />
            ) : recentActivity.length === 0 ? (
              <li className="px-4 py-10 text-center">
                <div className="w-10 h-10 rounded-xl dash-bg-accent-wash flex items-center justify-center mx-auto mb-3">
                  <Ticket className="w-5 h-5 text-[var(--dash-accent-deep)]" aria-hidden />
                </div>
                <p className="text-[13px] font-semibold text-[var(--dash-ink)]">
                  No ticket activity yet
                </p>
                <p className="text-[12.5px] text-[var(--dash-ink-soft)] mt-1 max-w-xs mx-auto">
                  When customers reach out their tickets will appear here.
                </p>
                <Link
                  href="/dashboard/tickets"
                  className="inline-flex items-center gap-1 mt-3 text-[12px] font-bold text-[var(--dash-accent-deep)] hover:underline"
                >
                  Go to tickets <ArrowUpRight className="w-3 h-3" aria-hidden />
                </Link>
              </li>
            ) : (
              recentActivity.map((row) => {
                const ticketHref = `/dashboard/tickets?q=${encodeURIComponent(row.ticket.subject)}`
                const priorityDotClass = PRIORITY_TONE[row.ticket.priority] ?? PRIORITY_TONE.medium

                return (
                  <li
                    key={row.ticket.id}
                    className="border-b dash-border-soft last:border-b-0"
                  >
                    <Link
                      href={ticketHref}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-[rgba(107,92,214,0.04)] transition group"
                    >
                      <div className="relative shrink-0">
                        <div className="w-8 h-8 rounded-full dash-bg-deep flex items-center justify-center text-[11px] font-bold text-[var(--dash-ink-soft)]">
                          {getInitials(row.customer?.name)}
                        </div>
                        <span
                          aria-hidden
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--dash-card)] ${priorityDotClass}`}
                          title={`${row.ticket.priority} priority`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[13px] font-bold text-[var(--dash-ink)] truncate group-hover:text-[var(--dash-accent-deep)] transition">
                            {row.customer?.name ?? "Unknown customer"}
                          </span>
                          {row.ticket.aiResolved && (
                            <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)] shrink-0">
                              <Bot className="w-2.5 h-2.5" aria-hidden />
                              AI
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[12px] text-[var(--dash-ink-soft)] min-w-0">
                          <span className="truncate">{row.ticket.subject}</span>
                          <span aria-hidden className="shrink-0 text-[var(--dash-ink-faint)]">·</span>
                          <span className="shrink-0 capitalize">
                            {CHANNEL_LABEL[row.ticket.channel] ?? row.ticket.channel}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`text-[11px] font-bold rounded-md px-2 py-1 capitalize ${STATUS_TONE[row.ticket.status] ?? ""}`}>
                          {row.ticket.status}
                        </span>
                        <span className="text-[10.5px] text-[var(--dash-ink-faint)] tabular-nums">
                          {formatRelativeTime(row.ticket.updatedAt)}
                        </span>
                      </div>
                    </Link>
                  </li>
                )
              })
            )}
          </ul>
        </DashCard>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <QueueBreakdownCard data={data} isLoading={isLoading} />
          <CopilotStatusCard data={data} isLoading={isLoading} />
        </div>
      </div>
    </div>
  )
}
