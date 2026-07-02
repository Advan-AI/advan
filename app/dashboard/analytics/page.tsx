"use client"

import { type ReactNode, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Gauge,
  Loader2,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Ticket,
  TrendingUp,
  Users,
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

const RANGE_OPTIONS: Array<{ value: RangeDays; label: string }> = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
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

export default function AnalyticsPage() {
  const utils = api.useUtils()
  const [days, setDays] = useState<RangeDays>(30)

  const reportQuery = api.analytics.report.useQuery(
    { days },
    { staleTime: 20_000, refetchInterval: 30_000, refetchIntervalInBackground: false },
  )

  const report = reportQuery.data
  const overview = report?.overview
  const trend = (report?.trend ?? []) as TrendPoint[]

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
    <div>
      <DashPageHeader
        eyebrow="Reports"
        title="Analytics"
        subtitle="Operational reporting for tickets, AI decisions, source coverage, response velocity, and human review pressure."
        actions={
          <>
            <label className="relative inline-flex h-9 items-center gap-1.5 rounded-lg border dash-border bg-[var(--dash-card)] px-3 text-[13px] font-semibold text-[var(--dash-ink-soft)]">
              <Calendar className="h-4 w-4" />
              <span className="sr-only">Reporting range</span>
              <select
                value={days}
                onChange={(event) => setDays(Number(event.target.value) as RangeDays)}
                className="bg-transparent pr-1 outline-none"
              >
                {RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={refresh}
              disabled={reportQuery.isFetching}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border dash-border bg-[var(--dash-card)] px-3.5 text-[13px] font-semibold text-[var(--dash-ink-soft)] transition hover:dash-shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={cn("h-4 w-4", reportQuery.isFetching && "animate-spin")} />
              Refresh
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!report}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] px-4 text-[13px] font-semibold text-white shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </>
        }
      />

      {reportQuery.isError && (
        <div className="mb-4 rounded-xl border border-[#F0CBCB] bg-[var(--dash-rose-wash)] px-4 py-3 text-[13px] font-semibold text-[var(--dash-rose)]">
          {reportQuery.error.message}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {kpis.map((card) => (
          <StatCard key={card.label} {...card} loading={reportQuery.isLoading} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.75fr)]">
        <DashCard
          title="Ticket volume and AI resolution"
          icon={<BarChart3 className="h-[18px] w-[18px]" />}
          right={<RangeNote days={days} generatedAt={report?.generatedAt} />}
        >
          <div className="h-[290px]">
            {reportQuery.isLoading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
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
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: "var(--dash-ink-faint)" }} tickLine={false} axisLine={false} minTickGap={20} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--dash-ink-faint)" }} tickLine={false} axisLine={false} allowDecimals={false} />
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
          <div className="h-[220px]">
            {reportQuery.isLoading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={report?.distributions.status ?? []} dataKey="value" nameKey="name" innerRadius={54} outerRadius={84} paddingAngle={3}>
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

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <DashCard title="AI confidence and source coverage" icon={<Sparkles className="h-[18px] w-[18px]" />}>
          <div className="h-[260px]">
            {reportQuery.isLoading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(38,35,28,0.08)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: "var(--dash-ink-faint)" }} tickLine={false} axisLine={false} minTickGap={20} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "var(--dash-ink-faint)" }} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "var(--dash-ink-faint)" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line yAxisId="left" type="monotone" dataKey="auditConfidence" name="Audit confidence" stroke="#6B5CD6" strokeWidth={2.4} dot={false} connectNulls />
                  <Line yAxisId="right" type="monotone" dataKey="avgSources" name="Avg sources" stroke="#197869" strokeWidth={2.4} dot={false} connectNulls />
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
          <div className="h-[260px]">
            {reportQuery.isLoading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(38,35,28,0.08)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: "var(--dash-ink-faint)" }} tickLine={false} axisLine={false} minTickGap={20} />
                  <YAxis tickFormatter={(value) => formatDuration(Number(value))} tick={{ fontSize: 11, fill: "var(--dash-ink-faint)" }} tickLine={false} axisLine={false} />
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

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <DashCard title="Priority and channel mix" icon={<TrendingUp className="h-[18px] w-[18px]" />}>
          <div className="grid gap-4 lg:grid-cols-2">
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

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <DashCard title="Recent ticket activity" icon={<MessageSquare className="h-[18px] w-[18px]" />}>
          <div className="space-y-2">
            {reportQuery.isLoading ? (
              Array.from({ length: 5 }).map((_, index) => <div key={index} className="skeleton h-16 rounded-lg" />)
            ) : overview?.recentActivity.length ? (
              overview.recentActivity.map((row) => (
                <Link key={row.ticket.id} href={`/dashboard/tickets?q=${encodeURIComponent(row.ticket.subject)}`} className="flex items-center gap-3 rounded-lg border dash-border-soft bg-white px-3 py-2.5 transition hover:dash-shadow-sm">
                  <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", row.ticket.aiResolved ? "bg-[#ECE9FB] text-[var(--dash-accent)]" : "bg-[var(--dash-bg)] text-[var(--dash-ink-faint)]")}>
                    {row.ticket.aiResolved ? <Sparkles className="h-4 w-4" /> : <Ticket className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-bold text-[var(--dash-ink)]">{row.ticket.subject}</span>
                    <span className="block text-[10.5px] text-[var(--dash-ink-faint)]">
                      {row.customer?.name ?? row.customer?.email ?? "Unknown customer"} · {formatRelativeTime(row.ticket.updatedAt)}
                    </span>
                  </span>
                  <span className="rounded-md bg-[var(--dash-bg)] px-1.5 py-0.5 text-[10px] font-bold capitalize text-[var(--dash-ink-soft)]">{row.ticket.status}</span>
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
          <div className="mt-4 flex gap-2">
            <Link href="/dashboard/tap-box" className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border dash-border bg-white text-[12.5px] font-semibold text-[var(--dash-accent-deep)] transition hover:dash-shadow-sm">
              <ShieldCheck className="h-4 w-4" />
              Tap Box
            </Link>
            <Link href="/dashboard/copilot" className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border dash-border bg-white text-[12.5px] font-semibold text-[var(--dash-accent-deep)] transition hover:dash-shadow-sm">
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
    <div className="dash-card p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">{label}</div>
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", toneClass(tone))}>{icon}</span>
      </div>
      {loading ? <div className="skeleton mt-2 h-7 w-20 rounded" /> : <div className="mt-1 text-[22px] font-bold tracking-tight text-[var(--dash-ink)]">{value}</div>}
      <div className="mt-1 truncate text-[11px] font-semibold text-[var(--dash-ink-faint)]">{delta}</div>
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
    <div className="rounded-xl border dash-border-soft bg-white p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">{label}</div>
      <div className={cn("mt-1 truncate text-[16px] font-bold text-[var(--dash-ink)]", tone === "sage" && "text-[var(--dash-sage)]", tone === "rose" && "text-[var(--dash-rose)]", tone === "accent" && "text-[var(--dash-accent)]")}>{value}</div>
    </div>
  )
}

function ChartSkeleton() {
  return <div className="skeleton h-full min-h-[180px] rounded-xl" />
}

function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border dash-border bg-white px-3 py-2 shadow-[0_12px_30px_-22px_rgba(38,35,28,.7)]">
      <div className="mb-1 text-[11px] font-bold text-[var(--dash-ink)]">{label ? shortDate(String(label)) : ""}</div>
      <div className="space-y-1">
        {payload.map((item: any) => (
          <div key={item.dataKey ?? item.name} className="flex items-center justify-between gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 text-[var(--dash-ink-soft)]">
              <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
              {item.name}
            </span>
            <span className="font-bold text-[var(--dash-ink)]">{formatter ? formatter(item.value) : item.value ?? "—"}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RangeNote({ days, generatedAt }: { days: number; generatedAt?: string }) {
  return (
    <span className="rounded-md bg-[var(--dash-bg)] px-2 py-1 text-[10.5px] font-bold text-[var(--dash-ink-faint)]">
      {days}d · {generatedAt ? formatRelativeTime(generatedAt) : "loading"}
    </span>
  )
}

function LegendList({ data, colors }: { data: Array<{ name: string; value: number }>; colors: Record<string, string> }) {
  if (!data.length) return <EmptyState icon={<BarChart3 className="h-5 w-5" />} title="No distribution data" body="Ticket distribution appears once tickets exist." />
  return (
    <div className="grid grid-cols-2 gap-2">
      {data.map((item) => (
        <div key={item.name} className="flex items-center gap-2 rounded-lg bg-[var(--dash-bg)] px-2.5 py-2 text-[12px]">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[item.name] ?? "#9C9488" }} />
          <span className="capitalize text-[var(--dash-ink-soft)]">{item.name}</span>
          <span className="ml-auto font-bold text-[var(--dash-ink)]">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

function DistributionBars({ title, data, colors, colorList, loading }: { title: string; data: Array<{ name: string; value: number }>; colors?: Record<string, string>; colorList?: string[]; loading: boolean }) {
  const max = Math.max(...data.map((item) => item.value), 1)
  return (
    <div>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">{title}</div>
      {loading ? (
        <div className="skeleton h-36 rounded-xl" />
      ) : data.length ? (
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={item.name} className="rounded-lg bg-[var(--dash-bg)] px-3 py-2">
              <div className="mb-1 flex items-center justify-between text-[12px]">
                <span className="font-semibold capitalize text-[var(--dash-ink-soft)]">{item.name}</span>
                <span className="font-bold text-[var(--dash-ink)]">{item.value}</span>
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
      <div>
        <div className="text-[12.5px] font-bold text-[var(--dash-ink)]">{label}</div>
        <div className="text-[11.5px] leading-5 text-[var(--dash-ink-soft)]">{detail}</div>
      </div>
    </div>
  )
}

function MetaRow({ k, v, tone }: { k: string; v: ReactNode; tone?: "sage" | "amber" | "rose" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[var(--dash-ink-faint)]">{k}</span>
      <span className={cn("truncate text-right font-semibold capitalize text-[var(--dash-ink)]", tone === "sage" && "text-[var(--dash-sage)]", tone === "amber" && "text-[var(--dash-amber)]", tone === "rose" && "text-[var(--dash-rose)]")}>{v}</span>
    </div>
  )
}

function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex min-h-[120px] flex-col items-center justify-center rounded-xl border dash-border-soft bg-white px-5 py-7 text-center">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--dash-bg)] text-[var(--dash-ink-faint)]">{icon}</div>
      <div className="text-[13px] font-bold text-[var(--dash-ink)]">{title}</div>
      <p className="mt-1 max-w-sm text-[12px] leading-5 text-[var(--dash-ink-soft)]">{body}</p>
    </div>
  )
}
