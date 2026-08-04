"use client"

import { type ReactNode, useMemo, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  Clock,
  Download,
  Gauge,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Ticket,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { DashCard, DashPageHeader } from "@/components/dashboard/page-header"
import { api } from "@/lib/api/trpc-client"
import { formatDuration, formatRelativeTime } from "@/lib/dashboard/format"
import { cn } from "@/lib/utils"

type RangeDays = 7 | 30 | 90

type TrendPoint = {
  date: string
  tickets: number
  resolved: number
  aiResolved: number
  avgFirstReplyMs: number | null
  avgConfidence: number | null
  aiDecisions: number
  auditConfidence: number | null
  avgSources: number | null
  avgLatencyMs: number | null
  flags: number
}

const RANGE_OPTIONS: Array<{ value: RangeDays; label: string; short: string }> = [
  { value: 7, label: "7 days", short: "7d" },
  { value: 30, label: "30 days", short: "30d" },
  { value: 90, label: "90 days", short: "90d" },
]

const STATUS_COLORS: Record<string, string> = {
  open: "#C5883C",
  pending: "#4D7CAD",
  resolved: "#5C9A70",
  closed: "#9C9488",
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "#A7A093",
  medium: "#4D7CAD",
  high: "#C5883C",
  urgent: "#B65C5C",
}

const CHANNEL_COLORS = ["#6B5CD6", "#197869", "#C5883C", "#4D7CAD", "#B65C5C"]

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

export default function AnalyticsPage() {
  const utils = api.useUtils()
  const [days, setDays] = useState<RangeDays>(30)
  const isSmUp = useMediaQuery("(min-width: 640px)")
  const isLgUp = useMediaQuery("(min-width: 1024px)")

  const reportQuery = api.analytics.report.useQuery(
    { days },
    { staleTime: 20_000, refetchInterval: 30_000, refetchIntervalInBackground: false },
  )

  const triageQuery = api.analytics.triageBreakdown.useQuery(
    undefined,
    { staleTime: 20_000, refetchInterval: 30_000, refetchIntervalInBackground: false },
  )

  const report = reportQuery.data
  const overview = report?.overview
  const trend = (report?.trend ?? []) as TrendPoint[]

  const chartMargin = useMemo(
    () => ({
      top: 8,
      right: isSmUp ? 10 : 4,
      left: isLgUp ? -12 : -22,
      bottom: 0,
    }),
    [isSmUp, isLgUp],
  )

  const pieRadii = useMemo(
    () => ({
      inner: isSmUp ? 54 : 42,
      outer: isSmUp ? 84 : 68,
    }),
    [isSmUp],
  )

  const totals = useMemo(() => {
    const tickets = trend.reduce((sum, point) => sum + point.tickets, 0)
    const resolved = trend.reduce((sum, point) => sum + point.resolved, 0)
    const aiResolved = trend.reduce((sum, point) => sum + point.aiResolved, 0)
    const aiDecisions = trend.reduce((sum, point) => sum + point.aiDecisions, 0)
    const flags = trend.reduce((sum, point) => sum + point.flags, 0)
    const avgLatency = average(trend.map((point) => point.avgLatencyMs))
    const avgSources = average(trend.map((point) => point.avgSources))
    return { tickets, resolved, aiResolved, aiDecisions, flags, avgLatency, avgSources }
  }, [trend])

  const latest = trend[trend.length - 1]
  const prior = trend.length > 1 ? trend[trend.length - 2] : null

  async function refresh() {
    await utils.analytics.report.invalidate()
    toast.success("Analytics refreshed")
  }

  function exportCsv() {
    if (!report) return
    const header = [
      "date",
      "tickets",
      "resolved",
      "aiResolved",
      "avgFirstReplyMs",
      "ticketConfidence",
      "aiDecisions",
      "auditConfidence",
      "avgSources",
      "avgLatencyMs",
      "flags",
    ]
    const rows = trend.map((point) =>
      [
        point.date,
        point.tickets,
        point.resolved,
        point.aiResolved,
        point.avgFirstReplyMs ?? "",
        point.avgConfidence ?? "",
        point.aiDecisions,
        point.auditConfidence ?? "",
        point.avgSources ?? "",
        point.avgLatencyMs ?? "",
        point.flags,
      ].join(","),
    )
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `advan-analytics-${days}d.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    toast.success("Analytics CSV exported")
  }

  const kpis = [
    {
      label: "AI resolution rate",
      value: overview ? `${overview.metrics.aiResolutionRate}%` : "—",
      icon: <Bot className="h-4 w-4" />,
      tone: overview && overview.metrics.aiResolutionRate >= 50 ? "sage" : "amber",
      delta: `${totals.aiResolved}/${Math.max(totals.tickets, 0)} in range`,
    },
    {
      label: "Avg first reply",
      value: formatDuration(overview?.metrics.avgFirstReplyMs),
      icon: <Clock className="h-4 w-4" />,
      tone: "blue",
      delta: latest?.avgFirstReplyMs ? `Latest ${formatDuration(latest.avgFirstReplyMs)}` : "No reply data",
    },
    {
      label: "Avg confidence",
      value: overview?.copilot.avgConfidence == null ? "—" : `${overview.copilot.avgConfidence}%`,
      icon: <Gauge className="h-4 w-4" />,
      tone: (overview?.copilot.avgConfidence ?? 0) >= 85 ? "sage" : "amber",
      delta: `${totals.aiDecisions} AI decisions`,
    },
    {
      label: "CSAT",
      value: overview?.metrics.csat == null ? "—" : overview.metrics.csat.toFixed(2),
      icon: <Users className="h-4 w-4" />,
      tone: (overview?.metrics.csat ?? 0) >= 4.5 ? "sage" : "amber",
      delta: "Customer average",
    },
    {
      label: "Pending HITL",
      value: overview?.metrics.hitlPending ?? "—",
      icon: <ShieldCheck className="h-4 w-4" />,
      tone: overview?.metrics.hitlPending ? "rose" : "sage",
      delta: "Human review queue",
    },
  ] satisfies Array<{ label: string; value: ReactNode; icon: ReactNode; tone: Tone; delta: string }>

  return (
    <div className="analytics-page min-w-0 w-full max-w-full">
      <DashPageHeader
        eyebrow="Reports"
        title="Analytics"
        subtitle="Operational reporting for tickets, AI decisions, source coverage, response velocity, and human review pressure."
        actions={
          <>
            <div
              role="group"
              aria-label="Reporting range"
              className="inline-flex h-10 sm:h-9 w-full sm:w-auto items-center rounded-lg border dash-border bg-[var(--dash-card)] p-0.5"
            >
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDays(option.value)}
                  aria-pressed={days === option.value}
                  className={cn(
                    "flex-1 sm:flex-none min-h-9 sm:min-h-0 h-full px-3 rounded-md text-[12.5px] sm:text-[13px] font-semibold transition",
                    days === option.value
                      ? "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]"
                      : "text-[var(--dash-ink-soft)] hover:text-[var(--dash-ink)]",
                  )}
                >
                  <span className="sm:hidden">{option.short}</span>
                  <span className="hidden sm:inline">{option.label}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={refresh}
              disabled={reportQuery.isFetching}
              className="inline-flex min-h-10 h-10 sm:h-9 flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg border dash-border bg-[var(--dash-card)] px-3 sm:px-3.5 text-[13px] font-semibold text-[var(--dash-ink-soft)] transition hover:dash-shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={cn("h-4 w-4 shrink-0", reportQuery.isFetching && "animate-spin")} />
              <span className="truncate">Refresh</span>
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!report}
              className="inline-flex min-h-10 h-10 sm:h-9 flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] px-3.5 sm:px-4 text-[13px] font-semibold text-white shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4 shrink-0" />
              <span className="truncate">Export</span>
            </button>
          </>
        }
      />

      {reportQuery.isError && (
        <div className="mb-4 rounded-xl border border-[#F0CBCB] bg-[var(--dash-rose-wash)] px-3.5 sm:px-4 py-3 text-[13px] font-semibold text-[var(--dash-rose)] break-words">
          {reportQuery.error.message}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 xl:grid-cols-5 3xl:gap-4">
        {kpis.map((card) => (
          <StatCard key={card.label} {...card} loading={reportQuery.isLoading} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(17rem,0.75fr)] 3xl:grid-cols-[minmax(0,1.5fr)_minmax(19rem,0.7fr)] 4xl:grid-cols-[minmax(0,1.55fr)_minmax(21rem,0.65fr)]">
        <DashCard
          title="Ticket volume and AI resolution"
          icon={<BarChart3 className="h-[18px] w-[18px]" />}
          right={<RangeNote days={days} generatedAt={report?.generatedAt} />}
        >
          <div className="h-[min(56vw,220px)] sm:h-[260px] xl:h-[290px] 3xl:h-[320px] 4xl:h-[360px] min-w-0">
            {reportQuery.isLoading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={chartMargin}>
                  <defs>
                    <linearGradient id="tickets-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6B5CD6" stopOpacity={0.32} />
                      <stop offset="95%" stopColor="#6B5CD6" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="resolved-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5C9A70" stopOpacity={0.26} />
                      <stop offset="95%" stopColor="#5C9A70" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(38,35,28,0.08)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: "var(--dash-ink-faint)" }} tickLine={false} axisLine={false} minTickGap={isSmUp ? 20 : 28} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--dash-ink-faint)" }} tickLine={false} axisLine={false} allowDecimals={false} width={isSmUp ? 36 : 28} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="tickets" name="Tickets" stroke="#6B5CD6" strokeWidth={2.4} fill="url(#tickets-fill)" />
                  <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#5C9A70" strokeWidth={2.4} fill="url(#resolved-fill)" />
                  <Line type="monotone" dataKey="aiResolved" name="AI resolved" stroke="#171A17" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MiniMetric label="Tickets" value={totals.tickets} />
            <MiniMetric label="Resolved" value={totals.resolved} tone="sage" />
            <MiniMetric label="AI resolved" value={totals.aiResolved} tone="accent" />
          </div>
        </DashCard>

        <DashCard title="Queue distribution" icon={<Ticket className="h-[18px] w-[18px]" />}>
          <div className="h-[min(48vw,200px)] sm:h-[220px] xl:h-[240px] 3xl:h-[260px] min-w-0">
            {reportQuery.isLoading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={report?.distributions.status ?? []} dataKey="value" nameKey="name" innerRadius={pieRadii.inner} outerRadius={pieRadii.outer} paddingAngle={3}>
                    {(report?.distributions.status ?? []).map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "#9C9488"} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <LegendList data={report?.distributions.status ?? []} colors={STATUS_COLORS} />
        </DashCard>
      </div>

      <div className="mt-3 sm:mt-4 grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2">
        <DashCard title="AI confidence and source coverage" icon={<Sparkles className="h-[18px] w-[18px]" />}>
          <div className="h-[min(52vw,210px)] sm:h-[240px] xl:h-[260px] 3xl:h-[300px] 4xl:h-[340px] min-w-0">
            {reportQuery.isLoading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={chartMargin}>
                  <CartesianGrid stroke="rgba(38,35,28,0.08)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: "var(--dash-ink-faint)" }} tickLine={false} axisLine={false} minTickGap={isSmUp ? 20 : 28} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "var(--dash-ink-faint)" }} tickLine={false} axisLine={false} domain={[0, 100]} width={isSmUp ? 36 : 28} />
                  {isSmUp && (
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "var(--dash-ink-faint)" }} tickLine={false} axisLine={false} width={36} />
                  )}
                  <Tooltip content={<ChartTooltip />} />
                  <Line yAxisId="left" type="monotone" dataKey="auditConfidence" name="Audit confidence" stroke="#6B5CD6" strokeWidth={2.4} dot={false} connectNulls />
                  <Line yAxisId={isSmUp ? "right" : "left"} type="monotone" dataKey="avgSources" name="Avg sources" stroke="#197869" strokeWidth={2.4} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MiniMetric label="AI decisions" value={totals.aiDecisions} tone="accent" />
            <MiniMetric label="Avg sources" value={totals.avgSources == null ? "—" : totals.avgSources.toFixed(1)} tone="sage" />
            <MiniMetric label="Flags" value={totals.flags} tone={totals.flags ? "rose" : "sage"} />
          </div>
        </DashCard>

        <DashCard title="Response latency" icon={<Clock className="h-[18px] w-[18px]" />}>
          <div className="h-[min(52vw,210px)] sm:h-[240px] xl:h-[260px] 3xl:h-[300px] 4xl:h-[340px] min-w-0">
            {reportQuery.isLoading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={chartMargin}>
                  <CartesianGrid stroke="rgba(38,35,28,0.08)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: "var(--dash-ink-faint)" }} tickLine={false} axisLine={false} minTickGap={isSmUp ? 20 : 28} />
                  <YAxis tickFormatter={(value) => formatDuration(Number(value))} tick={{ fontSize: 11, fill: "var(--dash-ink-faint)" }} tickLine={false} axisLine={false} width={isSmUp ? 44 : 32} />
                  <Tooltip content={<ChartTooltip formatter={(value: unknown) => formatDuration(Number(value))} />} />
                  <Bar dataKey="avgLatencyMs" name="AI latency" fill="#6B5CD6" radius={[5, 5, 0, 0]} />
                  <Bar dataKey="avgFirstReplyMs" name="First reply" fill="#C5883C" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MiniMetric label="Avg AI latency" value={totals.avgLatency == null ? "—" : formatDuration(totals.avgLatency)} />
            <MiniMetric label="Latest velocity" value={compareValue(latest?.tickets, prior?.tickets)} tone={(latest?.tickets ?? 0) >= (prior?.tickets ?? 0) ? "accent" : "sage"} />
          </div>
        </DashCard>
      </div>

      <div className="mt-3 sm:mt-4 grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)] 3xl:grid-cols-[minmax(0,1fr)_minmax(19rem,24rem)] 4xl:grid-cols-[minmax(0,1fr)_minmax(21rem,26rem)]">
        <DashCard title="Priority and channel mix" icon={<TrendingUp className="h-[18px] w-[18px]" />}>
          <div className="grid gap-4 sm:grid-cols-2">
            <DistributionBars title="Priority" data={report?.distributions.priority ?? []} colors={PRIORITY_COLORS} loading={reportQuery.isLoading} />
            <DistributionBars title="Channel" data={report?.distributions.channel ?? []} colorList={CHANNEL_COLORS} loading={reportQuery.isLoading} />
          </div>
        </DashCard>

        <DashCard title="Executive signals" icon={<ShieldCheck className="h-[18px] w-[18px]" />}>
          <div className="space-y-2">
            <Insight
              ok={(overview?.copilot.avgConfidence ?? 0) >= 85}
              label="Confidence gate"
              detail={(overview?.copilot.avgConfidence ?? 0) >= 85 ? "Average confidence is above the 85% production gate." : "Average confidence is below the 85% production gate."}
            />
            <Insight
              ok={(overview?.copilot.avgSourcesPerAnswer ?? 0) >= 1}
              label="Source coverage"
              detail={(overview?.copilot.avgSourcesPerAnswer ?? 0) >= 1 ? "Answers are generally source-cited." : "Average citations are low; enrich the Knowledge Base."}
            />
            <Insight
              ok={(overview?.metrics.hitlPending ?? 0) === 0}
              label="Human review load"
              detail={(overview?.metrics.hitlPending ?? 0) === 0 ? "No pending human review items." : `${overview?.metrics.hitlPending} items need review.`}
            />
            <Insight
              ok={totals.flags === 0}
              label="Policy and grounding"
              detail={totals.flags === 0 ? "No flags in the selected range." : `${totals.flags} flags detected in this range.`}
            />
          </div>
        </DashCard>
      </div>

      <div className="mt-3 sm:mt-4">
        <DashCard
          title="Auto-triage resolution rate"
          icon={<Zap className="h-[18px] w-[18px]" />}
          right={
            triageQuery.data && triageQuery.data.total > 0 ? (
              <span className="rounded-md bg-[var(--dash-bg)] px-2 py-1 text-[10.5px] font-bold text-[var(--dash-ink-faint)] whitespace-nowrap">
                {triageQuery.data.total} triaged
              </span>
            ) : undefined
          }
        >
          {triageQuery.isLoading ? (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(11rem,14rem)_1fr_1fr]">
              <div className="skeleton h-32 rounded-xl" />
              <div className="skeleton h-32 rounded-xl" />
              <div className="skeleton h-32 rounded-xl md:col-span-2 xl:col-span-1" />
            </div>
          ) : !triageQuery.data || triageQuery.data.total === 0 ? (
            <EmptyState
              icon={<Zap className="h-5 w-5" />}
              title="No triage data yet"
              body="Auto-triage resolution metrics appear once inbound messages have been processed by the AI pipeline."
            />
          ) : (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(11rem,15rem)_1fr_1fr] 3xl:grid-cols-[minmax(13rem,17rem)_1fr_1fr]">
              <div className="flex flex-col items-center justify-center rounded-xl border dash-border-soft bg-white px-4 sm:px-6 py-4 text-center md:col-span-2 xl:col-span-1">
                <div className="text-[12px] sm:text-[13px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">Auto-resolved</div>
                <div className={cn(
                  "mt-1 text-[clamp(2rem,6vw,2.625rem)] font-extrabold leading-none tracking-tight",
                  triageQuery.data.autoRate >= 60 ? "text-[var(--dash-sage)]" : triageQuery.data.autoRate >= 30 ? "text-[var(--dash-amber)]" : "text-[var(--dash-rose)]"
                )}>
                  {triageQuery.data.autoRate}%
                </div>
                <div className="mt-2 text-[11.5px] text-[var(--dash-ink-soft)]">
                  {triageQuery.data.autoResolved}/{triageQuery.data.total} messages
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 w-full max-w-xs mx-auto">
                  <div className="rounded-lg bg-[var(--dash-sage-wash)] px-2 py-1.5 text-center">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">Auto</div>
                    <div className="text-[14px] font-bold text-[var(--dash-sage)] tabular-nums">{triageQuery.data.autoResolved}</div>
                  </div>
                  <div className="rounded-lg bg-[var(--dash-amber-wash)] px-2 py-1.5 text-center">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">Escalated</div>
                    <div className="text-[14px] font-bold text-[var(--dash-amber)] tabular-nums">{triageQuery.data.escalated}</div>
                  </div>
                </div>
              </div>

              <div className="min-w-0">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">By channel</div>
                {triageQuery.data.byChannel.length === 0 ? (
                  <EmptyState icon={<BarChart3 className="h-4 w-4" />} title="No channel data" body="" />
                ) : (
                  <div className="space-y-2">
                    {triageQuery.data.byChannel.map((ch) => (
                      <div key={ch.channel} className="rounded-lg border dash-border-soft bg-white p-3">
                        <div className="mb-1.5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-[12px]">
                          <span className="font-semibold capitalize text-[var(--dash-ink-soft)]">{ch.channel}</span>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px]">
                            <span className="text-[var(--dash-sage)] font-bold tabular-nums">{ch.autoResolved} auto</span>
                            <span className="text-[var(--dash-ink-faint)]">·</span>
                            <span className="text-[var(--dash-amber)] font-bold tabular-nums">{ch.escalated} escalated</span>
                            <span className="text-[var(--dash-ink-faint)]">·</span>
                            <span className="font-extrabold text-[var(--dash-ink)] tabular-nums">{ch.autoRate}%</span>
                          </div>
                        </div>
                        <div className="flex h-2 overflow-hidden rounded-full bg-black/[0.06]">
                          <div
                            className="h-full rounded-l-full bg-[var(--dash-sage)] transition-all"
                            style={{ width: `${ch.autoRate}%` }}
                          />
                          <div
                            className="h-full rounded-r-full bg-[var(--dash-amber)] transition-all"
                            style={{ width: `${100 - ch.autoRate}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">By message type</div>
                <div className="space-y-2">
                  <div className="rounded-lg border dash-border-soft bg-white p-3">
                    <div className="mb-1 flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[var(--dash-sage)] shrink-0" />
                      <span className="text-[12px] font-bold text-[var(--dash-ink)] truncate">Non-complaint</span>
                      <span className="ml-auto text-[11px] font-extrabold text-[var(--dash-ink-faint)] tabular-nums shrink-0">{triageQuery.data.byType.nonComplaint.total} msgs</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      <div className="rounded-md bg-[var(--dash-sage-wash)] px-2 py-1 text-center">
                        <div className="font-bold text-[var(--dash-sage)] tabular-nums">{triageQuery.data.byType.nonComplaint.autoResolved}</div>
                        <div className="text-[9px] text-[var(--dash-ink-faint)]">auto-sent</div>
                      </div>
                      <div className="rounded-md bg-[var(--dash-amber-wash)] px-2 py-1 text-center">
                        <div className="font-bold text-[var(--dash-amber)] tabular-nums">{triageQuery.data.byType.nonComplaint.escalated}</div>
                        <div className="text-[9px] text-[var(--dash-ink-faint)]">escalated</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#F0CBCB] bg-[var(--dash-rose-wash)] p-3">
                    <div className="mb-1 flex items-center gap-2 min-w-0">
                      <AlertTriangle className="h-3.5 w-3.5 text-[var(--dash-rose)] shrink-0" />
                      <span className="text-[12px] font-bold text-[var(--dash-ink)] truncate">Complaint</span>
                      <span className="ml-auto text-[11px] font-extrabold text-[var(--dash-ink-faint)] tabular-nums shrink-0">{triageQuery.data.byType.complaint.total} msgs</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      <div className="rounded-md bg-white/70 px-2 py-1 text-center">
                        <div className={cn("font-bold tabular-nums", triageQuery.data.byType.complaint.autoResolved > 0 ? "text-[var(--dash-rose)]" : "text-[var(--dash-ink-faint)]")}>
                          {triageQuery.data.byType.complaint.autoResolved}
                        </div>
                        <div className="text-[9px] text-[var(--dash-ink-faint)]">auto-sent</div>
                      </div>
                      <div className="rounded-md bg-[var(--dash-rose)] px-2 py-1 text-center">
                        <div className="font-bold text-white tabular-nums">{triageQuery.data.byType.complaint.escalated}</div>
                        <div className="text-[9px] text-white/70">escalated</div>
                      </div>
                    </div>
                    <p className="mt-2 text-[10.5px] text-[#8a3e3e] leading-snug">
                      Complaints always require human review — never auto-sent.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DashCard>
      </div>

      <div className="mt-3 sm:mt-4 grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)] 3xl:grid-cols-[minmax(0,1fr)_minmax(19rem,24rem)] 4xl:grid-cols-[minmax(0,1fr)_minmax(21rem,26rem)]">
        <DashCard title="Recent ticket activity" icon={<MessageSquare className="h-[18px] w-[18px]" />}>
          <div className="space-y-2">
            {reportQuery.isLoading ? (
              Array.from({ length: 5 }).map((_, index) => <div key={index} className="skeleton h-16 rounded-lg" />)
            ) : overview?.recentActivity.length ? (
              overview.recentActivity.map((row) => (
                <Link
                  key={row.ticket.id}
                  href={`/dashboard/tickets?q=${encodeURIComponent(row.ticket.subject)}`}
                  className="flex items-center gap-3 rounded-lg border dash-border-soft bg-white px-3 py-2.5 min-h-[3.25rem] transition hover:dash-shadow-sm active:bg-[rgba(107,92,214,0.04)]"
                >
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", row.ticket.aiResolved ? "bg-[#ECE9FB] text-[var(--dash-accent)]" : "bg-[var(--dash-bg)] text-[var(--dash-ink-faint)]")}>
                    {row.ticket.aiResolved ? <Sparkles className="h-4 w-4" /> : <Ticket className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-bold text-[var(--dash-ink)]">{row.ticket.subject}</span>
                    <span className="block truncate text-[10.5px] text-[var(--dash-ink-faint)]">
                      {row.customer?.name ?? row.customer?.email ?? "Unknown customer"} · {formatRelativeTime(row.ticket.updatedAt)}
                    </span>
                  </span>
                  <span className="rounded-md bg-[var(--dash-bg)] px-1.5 py-0.5 text-[10px] font-bold capitalize text-[var(--dash-ink-soft)] shrink-0">{row.ticket.status}</span>
                </Link>
              ))
            ) : (
              <EmptyState icon={<Ticket className="h-5 w-5" />} title="No ticket activity" body="Ticket activity appears here once support work starts." />
            )}
          </div>
        </DashCard>

        <DashCard title="Copilot health" icon={<Bot className="h-[18px] w-[18px]" />}>
          <div className="space-y-3 text-[12.5px]">
            <MetaRow k="Status" v={overview?.copilot.status ?? "—"} tone={overview?.copilot.status === "active" ? "sage" : "amber"} />
            <MetaRow k="Model" v={overview?.copilot.model ?? "—"} />
            <MetaRow k="Avg sources" v={overview?.copilot.avgSourcesPerAnswer ?? "—"} />
            <MetaRow k="Avg latency" v={overview?.copilot.avgLatencyMs == null ? "—" : formatDuration(overview.copilot.avgLatencyMs)} />
            <MetaRow k="Last activity" v={overview?.copilot.lastActivityAt ? formatRelativeTime(overview.copilot.lastActivityAt) : "No activity"} />
            <MetaRow k="Audit flags" v={report?.audit.flagged ?? "—"} tone={report?.audit.flagged ? "rose" : "sage"} />
          </div>
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <Link href="/dashboard/tap-box" className="inline-flex min-h-10 h-10 sm:h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border dash-border bg-white text-[12.5px] font-semibold text-[var(--dash-accent-deep)] transition hover:dash-shadow-sm">
              <ShieldCheck className="h-4 w-4" />
              Tap Box
            </Link>
            <Link href="/dashboard/copilot" className="inline-flex min-h-10 h-10 sm:h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border dash-border bg-white text-[12.5px] font-semibold text-[var(--dash-accent-deep)] transition hover:dash-shadow-sm">
              <Sparkles className="h-4 w-4" />
              Copilot
            </Link>
          </div>
        </DashCard>
      </div>
    </div>
  )
}

type Tone = "default" | "sage" | "amber" | "rose" | "blue" | "accent"

function average(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  if (!valid.length) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

function shortDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function compareValue(current?: number, previous?: number) {
  if (current == null || previous == null) return "—"
  const diff = current - previous
  if (diff === 0) return "Flat"
  return `${diff > 0 ? "+" : ""}${diff}`
}

function StatCard({ label, value, icon, tone, delta, loading }: { label: string; value: ReactNode; icon: ReactNode; tone: Tone; delta: string; loading: boolean }) {
  return (
    <div className="dash-card p-3 sm:p-3.5 3xl:p-4 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)] truncate">{label}</div>
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", toneClass(tone))}>{icon}</span>
      </div>
      {loading ? (
        <div className="skeleton mt-2 h-7 w-20 rounded" />
      ) : (
        <div className="mt-1 text-[clamp(1.15rem,2vw+0.5rem,1.5rem)] font-bold tracking-tight text-[var(--dash-ink)] tabular-nums truncate">{value}</div>
      )}
      <div className="mt-1 truncate text-[10.5px] sm:text-[11px] font-semibold text-[var(--dash-ink-faint)]">{delta}</div>
    </div>
  )
}

function toneClass(tone: Tone) {
  return {
    default: "bg-[var(--dash-bg)] text-[var(--dash-ink-faint)]",
    sage: "bg-[var(--dash-sage-wash)] text-[var(--dash-sage)]",
    amber: "bg-[var(--dash-amber-wash)] text-[var(--dash-amber)]",
    rose: "bg-[var(--dash-rose-wash)] text-[var(--dash-rose)]",
    blue: "bg-[var(--dash-blue-wash)] text-[var(--dash-blue)]",
    accent: "bg-[#ECE9FB] text-[var(--dash-accent)]",
  }[tone]
}

function MiniMetric({ label, value, tone = "default" }: { label: string; value: ReactNode; tone?: Tone }) {
  return (
    <div className="rounded-xl border dash-border-soft bg-white p-2.5 sm:p-3 min-w-0">
      <div className="text-[9.5px] sm:text-[10px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)] truncate">{label}</div>
      <div className={cn("mt-1 truncate text-[14px] sm:text-[16px] font-bold text-[var(--dash-ink)] tabular-nums", tone === "sage" && "text-[var(--dash-sage)]", tone === "rose" && "text-[var(--dash-rose)]", tone === "accent" && "text-[var(--dash-accent)]")}>{value}</div>
    </div>
  )
}

function ChartSkeleton() {
  return <div className="skeleton h-full min-h-[160px] rounded-xl" />
}

function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="max-w-[min(16rem,calc(100vw-2rem))] rounded-lg border dash-border bg-white px-3 py-2 shadow-[0_12px_30px_-22px_rgba(38,35,28,.7)]">
      <div className="mb-1 text-[11px] font-bold text-[var(--dash-ink)]">{label ? shortDate(String(label)) : ""}</div>
      <div className="space-y-1">
        {payload.map((item: any) => (
          <div key={item.dataKey ?? item.name} className="flex items-center justify-between gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-[var(--dash-ink-soft)] min-w-0">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: item.color }} />
              <span className="truncate">{item.name}</span>
            </span>
            <span className="font-bold text-[var(--dash-ink)] tabular-nums shrink-0">{formatter ? formatter(item.value) : item.value ?? "—"}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RangeNote({ days, generatedAt }: { days: number; generatedAt?: string }) {
  return (
    <span className="rounded-md bg-[var(--dash-bg)] px-2 py-1 text-[10.5px] font-bold text-[var(--dash-ink-faint)] whitespace-nowrap">
      {days}d · {generatedAt ? formatRelativeTime(generatedAt) : "loading"}
    </span>
  )
}

function LegendList({ data, colors }: { data: Array<{ name: string; value: number }>; colors: Record<string, string> }) {
  if (!data.length) return <EmptyState icon={<BarChart3 className="h-5 w-5" />} title="No distribution data" body="Ticket distribution appears once tickets exist." />
  return (
    <div className="grid grid-cols-2 gap-2">
      {data.map((item) => (
        <div key={item.name} className="flex items-center gap-2 rounded-lg bg-[var(--dash-bg)] px-2.5 py-2 text-[12px] min-w-0">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: colors[item.name] ?? "#9C9488" }} />
          <span className="capitalize text-[var(--dash-ink-soft)] truncate">{item.name}</span>
          <span className="ml-auto font-bold text-[var(--dash-ink)] tabular-nums shrink-0">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

function DistributionBars({ title, data, colors, colorList, loading }: { title: string; data: Array<{ name: string; value: number }>; colors?: Record<string, string>; colorList?: string[]; loading: boolean }) {
  const max = Math.max(...data.map((item) => item.value), 1)
  return (
    <div className="min-w-0">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">{title}</div>
      {loading ? (
        <div className="skeleton h-36 rounded-xl" />
      ) : data.length ? (
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={item.name} className="rounded-lg bg-[var(--dash-bg)] px-3 py-2">
              <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
                <span className="font-semibold capitalize text-[var(--dash-ink-soft)] truncate">{item.name}</span>
                <span className="font-bold text-[var(--dash-ink)] tabular-nums shrink-0">{item.value}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
                <div className="h-full rounded-full" style={{ width: `${(item.value / max) * 100}%`, background: colors?.[item.name] ?? colorList?.[index % (colorList.length || 1)] ?? "#6B5CD6" }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<BarChart3 className="h-5 w-5" />} title="No data" body="Distribution appears once tickets exist." />
      )}
    </div>
  )
}

function Insight({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border px-3 py-2.5", ok ? "border-[#CBE0CF] bg-[var(--dash-sage-wash)]" : "border-[#E7C988] bg-[var(--dash-amber-wash)]")}>
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dash-sage)]" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dash-amber)]" />}
      <div className="min-w-0">
        <div className="text-[12.5px] font-bold text-[var(--dash-ink)]">{label}</div>
        <div className="text-[11.5px] leading-5 text-[var(--dash-ink-soft)]">{detail}</div>
      </div>
    </div>
  )
}

function MetaRow({ k, v, tone }: { k: string; v: ReactNode; tone?: "sage" | "amber" | "rose" }) {
  return (
    <div className="flex items-center justify-between gap-3 min-w-0">
      <span className="text-[var(--dash-ink-faint)] shrink-0">{k}</span>
      <span className={cn("truncate text-right font-semibold capitalize text-[var(--dash-ink)]", tone === "sage" && "text-[var(--dash-sage)]", tone === "amber" && "text-[var(--dash-amber)]", tone === "rose" && "text-[var(--dash-rose)]")}>{v}</span>
    </div>
  )
}

function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex min-h-[110px] sm:min-h-[120px] flex-col items-center justify-center rounded-xl border dash-border-soft bg-white px-4 sm:px-5 py-6 sm:py-7 text-center">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--dash-bg)] text-[var(--dash-ink-faint)]">{icon}</div>
      <div className="text-[13px] font-bold text-[var(--dash-ink)]">{title}</div>
      {body ? <p className="mt-1 max-w-sm text-[12px] leading-5 text-[var(--dash-ink-soft)]">{body}</p> : null}
    </div>
  )
}
