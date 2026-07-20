"use client"

import { type ReactNode, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import {
  AlertTriangle,
  BookOpen,
  Box,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  Clock,
  Download,
  ExternalLink,
  FileJson,
  Filter,
  History,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  Ticket,
  XCircle,
} from "lucide-react"
import { DashCard, DashPageHeader } from "@/components/dashboard/page-header"
import { api } from "@/lib/api/trpc-client"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"
import * as SocketIO from "socket.io-client"

const DASH_SOCKET_URL =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_SOCKET_URL
    ? (process.env.NEXT_PUBLIC_SOCKET_URL as string)
    : typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:3002`
      : "http://localhost:3002"

// ─── Review-queue types ────────────────────────────────────────────────────────

type HitlPriority = "complaint" | "low_confidence" | "policy_fail" | "normal"
type HitlSource = "auto_triage" | "manual" | "workflow"
type HitlStatus = "pending" | "approved" | "rejected"
type HitlItem = {
  id: string
  orgId: string
  ticketId: string | null
  conversationId: string | null
  draftOutput: string
  reason: string
  status: HitlStatus
  priority: HitlPriority
  source: HitlSource
  classificationMetadata: {
    isComplaint?: boolean
    severity?: "low" | "medium" | "high"
    sentiment?: "positive" | "neutral" | "negative"
    reasoning?: string
    draftConfidence?: number
    auditLogId?: string
  } | null
  createdAt: string | Date
}

type Citation = { source: string; content?: string; score?: number; url?: string }
type PolicyCheck = { rule: string; passed: boolean; reason?: string }
type DecisionAction = "accept" | "reject" | "modify"
type AuditMetadata = {
  confidence?: number
  citations?: Citation[]
  policyChecks?: PolicyCheck[]
  latencyMs?: number
  model?: string
  hallucinationFlags?: string[]
  decision?: { action: DecisionAction; finalText?: string; by: string; at: string }
  /** Set by the triage worker for background auto-triage decisions; absent for manual copilot drafts. */
  source?: "manual" | "auto_triage"
  complaintClassification?: {
    isComplaint: boolean
    severity?: "low" | "medium" | "high"
    sentiment?: "positive" | "neutral" | "negative"
    reasoning?: string
  }
}
type AuditLog = {
  id: string
  ticketId: string | null
  workflowId: string | null
  input: string
  output: string
  metadata: AuditMetadata
  createdAt: string | Date
  /** Ticket channel joined from tickets table; null when no ticket is linked. */
  channel?: string | null
}
type RiskFilter = "all" | "autopass" | "review" | "blocked"
type SourceFilter = "all" | "sourced" | "unsourced"
type OriginFilter = "all" | "auto_triage" | "manual"

const CONFIDENCE_GATE = 85

export default function TapBoxPage() {
  const utils = api.useUtils()
  const { data: session } = useSession()
  const orgId = session?.user?.orgId

  useEffect(() => {
    if (!orgId) return

    const sock = SocketIO.connect(DASH_SOCKET_URL, {
      auth: { orgId },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 8,
    })

    sock.on("hitl:new", async () => {
      await utils.governance.pendingHitl.invalidate()
    })

    sock.on("hitl:resolved", async () => {
      await utils.governance.pendingHitl.invalidate()
      await utils.analytics.auditLogs.invalidate()
    })

    return () => {
      sock.disconnect()
    }
  }, [orgId, utils])

  const [open, setOpen] = useState(true)
  const [query, setQuery] = useState("")
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all")
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all")
  const [originFilter, setOriginFilter] = useState<OriginFilter>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [ringValue, setRingValue] = useState(0)
  const [editingHitl, setEditingHitl] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<"pending" | "audits">("pending")

  const logsQuery = api.analytics.auditLogs.useQuery(
    { limit: 50, offset: 0 },
    { refetchInterval: 30_000, refetchIntervalInBackground: false },
  )

  const hitlQuery = api.governance.pendingHitl.useQuery(
    { status: "pending", limit: 40 },
    { refetchInterval: 15_000, refetchIntervalInBackground: false },
  )
  const hitlItems = (hitlQuery.data ?? []) as HitlItem[]
  const complaintCount = hitlItems.filter((h) => h.priority === "complaint").length

  const approveHitl = api.governance.approveHitl.useMutation({
    onSuccess: async (_, variables) => {
      toast.success("Draft approved and reply sent")
      setEditingHitl((prev) => { const next = { ...prev }; delete next[variables.hitlId]; return next })
      await utils.governance.pendingHitl.invalidate()
      await utils.analytics.auditLogs.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  const rejectHitl = api.governance.rejectHitl.useMutation({
    onSuccess: async () => {
      toast.success("Draft rejected")
      await utils.governance.pendingHitl.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  const logs = useMemo(() => ((logsQuery.data ?? []) as AuditLog[]), [logsQuery.data])

  const filteredLogs = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return logs.filter((log) => {
      const metadata = normalizeMetadata(log.metadata)
      const confidence = metadata.confidence ?? 0
      const citations = metadata.citations ?? []
      const policyChecks = metadata.policyChecks ?? []
      const flags = metadata.hallucinationFlags ?? []
      const failedPolicies = policyChecks.filter((p) => !p.passed).length
      const needsReview = confidence < CONFIDENCE_GATE || failedPolicies > 0 || flags.length > 0
      const blocked = failedPolicies > 0 || flags.length > 0 || metadata.decision?.action === "reject"

      if (riskFilter === "autopass" && (needsReview || blocked)) return false
      if (riskFilter === "review" && (!needsReview || blocked)) return false
      if (riskFilter === "blocked" && !blocked) return false
      if (sourceFilter === "sourced" && citations.length === 0) return false
      if (sourceFilter === "unsourced" && citations.length > 0) return false
      if (originFilter === "auto_triage" && metadata.source !== "auto_triage") return false
      if (originFilter === "manual" && metadata.source === "auto_triage") return false

      if (!normalized) return true
      const haystack = [
        log.id,
        log.ticketId,
        log.workflowId,
        log.input,
        log.output,
        metadata.model,
        metadata.decision?.by,
        ...citations.map((c) => `${c.source} ${c.content ?? ""} ${c.url ?? ""}`),
        ...policyChecks.map((p) => `${p.rule} ${p.reason ?? ""}`),
        ...flags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(normalized)
    })
  }, [logs, query, riskFilter, sourceFilter, originFilter])

  const selectedLog = useMemo(() => {
    return filteredLogs.find((log) => log.id === selectedId) ?? filteredLogs[0] ?? null
  }, [filteredLogs, selectedId])

  const selectedMetadata = normalizeMetadata(selectedLog?.metadata)
  const confidence = selectedMetadata.confidence ?? 0
  const citations = selectedMetadata.citations ?? []
  const policyChecks = selectedMetadata.policyChecks ?? []
  const hallucinationFlags = selectedMetadata.hallucinationFlags ?? []
  const failedPolicies = policyChecks.filter((p) => !p.passed)
  const needsHumanReview = confidence < CONFIDENCE_GATE || failedPolicies.length > 0 || hallucinationFlags.length > 0
  const blocked = failedPolicies.length > 0 || hallucinationFlags.length > 0 || selectedMetadata.decision?.action === "reject"

  const stats = useMemo(() => {
    const total = logs.length
    const decisions = logs.map((log) => normalizeMetadata(log.metadata))
    const avgConfidence = Math.round(
      decisions.reduce((sum, metadata) => sum + (metadata.confidence ?? 0), 0) / Math.max(total, 1),
    )
    const sourced = decisions.filter((metadata) => (metadata.citations ?? []).length > 0).length
    const review = decisions.filter((metadata) => {
      const failed = (metadata.policyChecks ?? []).some((p) => !p.passed)
      const flagged = (metadata.hallucinationFlags ?? []).length > 0
      return (metadata.confidence ?? 0) < CONFIDENCE_GATE || failed || flagged
    }).length
    const blockedCount = decisions.filter((metadata) => {
      return (metadata.policyChecks ?? []).some((p) => !p.passed) || (metadata.hallucinationFlags ?? []).length > 0
    }).length
    return { total, avgConfidence, sourced, review, blocked: blockedCount }
  }, [logs])

  useEffect(() => {
    if (!filteredLogs.some((log) => log.id === selectedId)) {
      setSelectedId(filteredLogs[0]?.id ?? null)
    }
  }, [filteredLogs, selectedId])

  useEffect(() => {
    setRingValue(0)
    if (!open || !selectedLog) return
    const id = window.setTimeout(() => setRingValue(confidence), 100)
    return () => window.clearTimeout(id)
  }, [open, selectedLog, confidence])

  async function refresh() {
    await utils.analytics.auditLogs.invalidate()
    toast.success("Tap Box audit trail refreshed")
  }

  async function copyDecision() {
    if (!selectedLog) return
    await navigator.clipboard.writeText(JSON.stringify(formatForExport(selectedLog), null, 2))
    toast.success("Decision trace copied")
  }

  function exportDecision() {
    if (!selectedLog) return
    const blob = new Blob([JSON.stringify(formatForExport(selectedLog), null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `tap-box-${selectedLog.id.slice(0, 8)}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    toast.success("Decision trace exported")
  }

  return (
    <div>
      <DashPageHeader
        eyebrow="AI Transparency"
        title="Tap Box"
        subtitle="Inspect every AI decision by confidence, source grounding, policy validation, hallucination checks, and final human action."
        actions={
          <>
            <button
              type="button"
              onClick={refresh}
              disabled={logsQuery.isFetching}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border dash-border bg-[var(--dash-card)] px-3.5 text-[13px] font-semibold text-[var(--dash-ink-soft)] transition hover:dash-shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={cn("h-4 w-4", logsQuery.isFetching && "animate-spin")} />
              Refresh
            </button>
            <Link
              href="/dashboard/copilot"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] px-4 text-[13px] font-semibold text-white shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] transition hover:-translate-y-px"
            >
              <Sparkles className="h-4 w-4" />
              Open Copilot
            </Link>
          </>
        }
      />

      {/* ── Tabs Selector ── */}
      <div className="mb-5 flex border-b border-[var(--dash-bg-deep)]">
        <button
          onClick={() => setActiveTab("pending")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-[13px] font-bold transition-all duration-200 outline-none",
            activeTab === "pending"
              ? "border-[var(--dash-accent)] text-[var(--dash-accent-deep)]"
              : "border-transparent text-[var(--dash-ink-faint)] hover:text-[var(--dash-ink-soft)]"
          )}
        >
          <Inbox className="h-4 w-4" />
          Pending Reviews
          {hitlItems.length > 0 && (
            <span className={cn(
              "ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold leading-none",
              complaintCount > 0 
                ? "bg-[var(--dash-rose-wash)] text-[var(--dash-rose)]" 
                : "bg-[var(--dash-amber-wash)] text-[var(--dash-amber)]"
            )}>
              {hitlItems.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("audits")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-[13px] font-bold transition-all duration-200 outline-none",
            activeTab === "audits"
              ? "border-[var(--dash-accent)] text-[var(--dash-accent-deep)]"
              : "border-transparent text-[var(--dash-ink-faint)] hover:text-[var(--dash-ink-soft)]"
          )}
        >
          <History className="h-4 w-4" />
          Audit Trail &amp; Telemetry
          <span className="ml-1.5 rounded-full bg-[var(--dash-bg)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--dash-ink-faint)] leading-none">
            {stats.total}
          </span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "pending" ? (
          <motion.div
            key="pending"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            {/* Explanatory Context Card */}
            <div className="mb-4 rounded-xl border border-[var(--dash-line)] bg-gradient-to-br from-[#FEFDFB] to-[#F8F5ED] p-4.5 shadow-sm">
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-[13.5px] font-bold text-[var(--dash-ink)]">Human-in-the-Loop (HITL) Governance Center</h4>
                  <p className="mt-1 text-[12px] leading-relaxed text-[var(--dash-ink-soft)]">
                    Advan's AI triage backend routes customer tickets here when automated drafts trigger safety risks. This includes messages classified as high-severity <span className="font-semibold text-[var(--dash-rose)]">customer complaints</span>, violation of guardrail policy rules, or text confidence scores falling below the minimum <span className="font-semibold text-[var(--dash-accent-deep)]">{CONFIDENCE_GATE}% production gate</span>. Review, adjust, and authorize these replies before they send.
                  </p>
                </div>
              </div>
            </div>

            {/* ── Review Queue ── */}
            <DashCard
              title="Review queue"
              icon={<Inbox className="h-[18px] w-[18px]" />}
              className="mb-4"
              right={
                complaintCount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--dash-rose-wash)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--dash-rose)]">
                    <AlertTriangle className="h-3 w-3" />
                    {complaintCount} complaint{complaintCount !== 1 ? "s" : ""}
                  </span>
                ) : hitlItems.length > 0 ? (
                  <span className="rounded-full bg-[var(--dash-amber-wash)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--dash-amber)]">
                    {hitlItems.length} pending
                  </span>
                ) : undefined
              }
              padded={false}
            >
              {hitlQuery.isLoading ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
                </div>
              ) : hitlItems.length === 0 ? (
                <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 p-8 text-center">
                  <CheckCircle2 className="h-9 w-9 text-[var(--dash-sage)] opacity-80" />
                  <div className="text-[13.5px] font-bold text-[var(--dash-ink)]">All pending reviews resolved</div>
                  <p className="max-w-md text-[12px] leading-relaxed text-[var(--dash-ink-faint)]">
                    The Human-in-the-Loop queue is completely empty. Outstanding automated triage suggestions have been cleared or approved.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--dash-line)]">
                  {hitlItems.map((item) => {
                    const isComplaint = item.priority === "complaint"
                    const editedText = editingHitl[item.id] ?? item.draftOutput
                    const isPending = approveHitl.isPending || rejectHitl.isPending
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "p-4 transition",
                          isComplaint
                            ? "bg-[var(--dash-rose-wash)] border-l-4 border-[var(--dash-rose)]"
                            : item.priority === "low_confidence"
                            ? "bg-[var(--dash-amber-wash)] border-l-4 border-[var(--dash-amber)]"
                            : "bg-white",
                        )}
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          {isComplaint ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--dash-rose)] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                              <AlertTriangle className="h-3 w-3" /> Complaint
                            </span>
                          ) : item.priority === "low_confidence" ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--dash-amber)] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                              <ShieldAlert className="h-3 w-3" /> Low confidence
                            </span>
                          ) : null}
                          {item.source === "auto_triage" && (
                            <span className="rounded-md bg-[var(--dash-accent-wash)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--dash-accent-deep)]">
                              AI triage
                            </span>
                          )}
                          {item.classificationMetadata?.draftConfidence != null && (
                            <span className={cn(
                              "ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-bold",
                              (item.classificationMetadata.draftConfidence ?? 0) >= 85
                                ? "bg-[var(--dash-sage-wash)] text-[var(--dash-sage)]"
                                : "bg-[var(--dash-amber-wash)] text-[var(--dash-amber)]"
                            )}>
                              {item.classificationMetadata.draftConfidence}% conf
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-[10.5px] text-[var(--dash-ink-faint)]">
                            <Clock className="h-3 w-3" />
                            {new Date(item.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </span>
                        </div>

                        {item.reason && (
                          <p className="mb-2 text-[12px] italic text-[var(--dash-ink-soft)]">{item.reason}</p>
                        )}

                        {item.classificationMetadata?.reasoning && isComplaint && (
                          <div className="mb-2 rounded-lg border border-[#F0CBCB] bg-white/60 px-3 py-2 text-[11.5px] leading-5 text-[#7a3535]">
                            <span className="font-bold">Classifier reasoning:</span> {item.classificationMetadata.reasoning}
                          </div>
                        )}

                        <div className="mb-3">
                          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">Draft reply</div>
                          <textarea
                            value={editedText}
                            onChange={(e) => setEditingHitl((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            rows={4}
                            className="w-full resize-none rounded-lg border dash-border bg-white px-3 py-2 text-[12.5px] leading-5 text-[var(--dash-ink)] outline-none transition focus:border-[var(--dash-accent)] focus:ring-2 focus:ring-[var(--dash-accent-wash)]"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => rejectHitl.mutate({ hitlId: item.id })}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border dash-border bg-white px-3 text-[12px] font-semibold text-[var(--dash-rose)] transition hover:dash-shadow-sm disabled:opacity-50"
                          >
                            <ThumbsDown className="h-3.5 w-3.5" /> Reject
                          </button>
                          <button
                            type="button"
                            disabled={isPending || !editedText.trim()}
                            onClick={() => approveHitl.mutate({ hitlId: item.id, finalText: editedText })}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] px-3 text-[12px] font-semibold text-white shadow-[0_8px_20px_-10px_rgba(107,92,214,0.6)] transition hover:-translate-y-px disabled:translate-y-0 disabled:opacity-50"
                          >
                            {approveHitl.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            Approve &amp; Send
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </DashCard>
          </motion.div>
        ) : (
          <motion.div
            key="audits"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            {/* Stat Cards Grid */}
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <StatCard label="Decisions" value={stats.total} icon={<History className="h-4 w-4" />} />
              <StatCard label="Avg confidence" value={`${stats.avgConfidence}%`} icon={<ShieldCheck className="h-4 w-4" />} tone={stats.avgConfidence >= CONFIDENCE_GATE ? "sage" : "amber"} />
              <StatCard label="Source cited" value={`${stats.sourced}/${stats.total}`} icon={<BookOpen className="h-4 w-4" />} />
              <StatCard label="Needs review" value={stats.review} icon={<AlertTriangle className="h-4 w-4" />} tone={stats.review ? "amber" : "sage"} />
              <StatCard label="Blocked" value={stats.blocked} icon={<ShieldAlert className="h-4 w-4" />} tone={stats.blocked ? "rose" : "sage"} />
            </div>

            {/* Decision Queue and Inspector Grid */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[390px_minmax(0,1fr)_320px]">
              <DashCard
                title="Decision queue"
                icon={<Filter className="h-[18px] w-[18px]" />}
                right={
                  <span className="rounded-md bg-[var(--dash-bg)] px-2 py-1 text-[10.5px] font-bold text-[var(--dash-ink-faint)]">
                    {filteredLogs.length} shown
                  </span>
                }
                className="xl:sticky xl:top-5 xl:max-h-[calc(100vh-112px)]"
                padded={false}
              >
                <div className="border-b dash-border-soft p-3">
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dash-ink-faint)]" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search inputs, outputs, sources..."
                      className="h-10 w-full rounded-lg border dash-border bg-white pl-9 pr-3 text-[13px] text-[var(--dash-ink)] outline-none transition placeholder:text-[var(--dash-ink-faint)] focus:border-[#9D91EA] focus:ring-2 focus:ring-[#6B5CD6]/15"
                    />
                  </label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <FilterSelect label="Risk" value={riskFilter} onChange={(value) => setRiskFilter(value as RiskFilter)} options={[
                      ["all", "All risk"],
                      ["autopass", "Auto-pass"],
                      ["review", "Review"],
                      ["blocked", "Blocked"],
                    ]} />
                    <FilterSelect label="Sources" value={sourceFilter} onChange={(value) => setSourceFilter(value as SourceFilter)} options={[
                      ["all", "All sources"],
                      ["sourced", "Sourced"],
                      ["unsourced", "Unsourced"],
                    ]} />
                    <FilterSelect label="Origin" value={originFilter} onChange={(value) => setOriginFilter(value as OriginFilter)} options={[
                      ["all", "All origins"],
                      ["auto_triage", "Auto-triage"],
                      ["manual", "Manual"],
                    ]} />
                  </div>
                </div>

                <div className="max-h-[620px] overflow-y-auto p-2">
                  {logsQuery.isLoading ? (
                    <DecisionSkeleton />
                  ) : logsQuery.isError ? (
                    <StateMessage
                      icon={<XCircle className="h-5 w-5" />}
                      title="Audit trail unavailable"
                      body={logsQuery.error.message}
                    />
                  ) : filteredLogs.length === 0 ? (
                    <StateMessage
                      icon={<Search className="h-5 w-5" />}
                      title="No matching decisions"
                      body="Clear the search or loosen the filters to inspect more audit records."
                    />
                  ) : (
                    <div className="space-y-2">
                      {filteredLogs.map((log) => (
                        <DecisionListItem
                          key={log.id}
                          log={log}
                          active={selectedLog?.id === log.id}
                          onSelect={() => setSelectedId(log.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </DashCard>

              <div className="min-w-0 rounded-2xl border dash-border bg-gradient-to-b from-white/95 to-[#F8F5ED]/95 shadow-[0_24px_80px_-50px_rgba(38,35,28,0.55)] backdrop-blur">
                <div className="flex items-center gap-2.5 border-b dash-border-soft px-4 py-3.5" style={{ background: "linear-gradient(135deg, rgba(236,233,251,.7), transparent)" }}>
                  <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6]">
                    <Box className="h-[16px] w-[16px] text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-bold text-[var(--dash-ink)]">Decision inspector</div>
                    <div className="truncate text-[10.5px] text-[var(--dash-ink-faint)]">
                      {selectedLog ? `Audit ${selectedLog.id.slice(0, 8)} · ${formatDate(selectedLog.createdAt)}` : "Select an audit log"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={copyDecision}
                    disabled={!selectedLog}
                    className="hidden h-8 items-center gap-1.5 rounded-md border dash-border bg-white px-2.5 text-[11.5px] font-bold text-[var(--dash-ink-soft)] transition hover:text-[var(--dash-ink)] disabled:opacity-50 sm:inline-flex"
                  >
                    <Clipboard className="h-3.5 w-3.5" />
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={exportDecision}
                    disabled={!selectedLog}
                    className="hidden h-8 items-center gap-1.5 rounded-md border dash-border bg-white px-2.5 text-[11.5px] font-bold text-[var(--dash-ink-soft)] transition hover:text-[var(--dash-ink)] disabled:opacity-50 sm:inline-flex"
                  >
                    <Download className="h-3.5 w-3.5" />
                    JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen((value) => !value)}
                    aria-expanded={open}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--dash-ink-faint)] transition hover:bg-[var(--dash-bg)] hover:text-[var(--dash-ink)]"
                  >
                    <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      key="body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 sm:p-5">
                        {logsQuery.isLoading ? (
                          <div className="space-y-3">
                            <div className="skeleton h-28 w-full rounded-xl" />
                            <div className="skeleton h-24 w-full rounded-xl" />
                            <div className="skeleton h-36 w-full rounded-xl" />
                          </div>
                        ) : !selectedLog ? (
                          <StateMessage
                            icon={<FileJson className="h-5 w-5" />}
                            title="No AI decisions recorded yet"
                            body="Generate a Copilot draft to create a sourced audit trail for Tap Box."
                            action={<Link href="/dashboard/copilot" className="font-bold text-[var(--dash-accent-deep)] hover:underline">Open Copilot</Link>}
                          />
                        ) : (
                          <div className="space-y-4">
                            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                              <div className="flex items-center gap-4 rounded-xl border dash-border-soft bg-white p-4">
                                <ConfidenceRing value={ringValue} />
                                <div className="min-w-0 flex-1">
                                  <StatusPill blocked={blocked} needsReview={needsHumanReview} />
                                  <p className="mt-2 text-[12.5px] leading-5 text-[var(--dash-ink-soft)]">
                                    {blocked
                                      ? "This decision has blocking policy or grounding issues and should not be sent without remediation."
                                      : needsHumanReview
                                        ? "This decision is below the production confidence gate or requires a human reviewer."
                                        : "This decision is source grounded and eligible for the approved support workflow."}
                                  </p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <MiniMetric label="Sources" value={citations.length} />
                                <MiniMetric label="Policies" value={`${policyChecks.filter((p) => p.passed).length}/${policyChecks.length}`} tone={failedPolicies.length ? "rose" : "sage"} />
                                <MiniMetric label="Flags" value={hallucinationFlags.length} tone={hallucinationFlags.length ? "rose" : "sage"} />
                                <MiniMetric label="Latency" value={selectedMetadata.latencyMs ? `${selectedMetadata.latencyMs}ms` : "n/a"} />
                              </div>
                            </div>

                            <Section icon={<BookOpen className="h-3.5 w-3.5" />} label="Knowledge sources" empty={citations.length === 0 ? "No citations were attached to this decision." : undefined}>
                              {citations.map((citation, index) => (
                                <SourceRow key={`${citation.source}-${index}`} citation={citation} />
                              ))}
                            </Section>

                            <Section icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Policy checks" empty={policyChecks.length === 0 ? "No policy checks were recorded." : undefined}>
                              {policyChecks.map((policy, index) => (
                                <PolicyRow key={`${policy.rule}-${index}`} policy={policy} />
                              ))}
                            </Section>

                            <Section icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Hallucination and grounding flags" empty={hallucinationFlags.length === 0 ? "No hallucination flags detected." : undefined}>
                              {hallucinationFlags.map((flag, index) => (
                                <div key={`${flag}-${index}`} className="flex items-start gap-2 rounded-lg border border-[#F0CBCB] bg-[var(--dash-rose-wash)] px-3 py-2 text-[12px] leading-5 text-[#8a3e3e]">
                                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                  <span>{flag}</span>
                                </div>
                              ))}
                            </Section>

                            <Section icon={<Sparkles className="h-3.5 w-3.5" />} label="AI input and output">
                              <div className="grid gap-3 lg:grid-cols-2">
                                <TraceBlock label="Input" text={selectedLog.input} />
                                <TraceBlock label="Output" text={selectedLog.output} />
                              </div>
                            </Section>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex flex-col gap-4">
                <DashCard title="Decision metadata" icon={<ShieldCheck className="h-[18px] w-[18px]" />}>
                  {logsQuery.isLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 7 }).map((_, index) => (
                        <div key={index} className="skeleton h-4 w-full rounded" />
                      ))}
                    </div>
                  ) : selectedLog ? (
                    <div className="space-y-3 text-[12.5px]">
                      <Row k="Confidence" v={`${confidence}%`} tone={confidence >= CONFIDENCE_GATE ? "sage" : "amber"} />
                      <Row k="Gate" v={`${CONFIDENCE_GATE}% minimum`} />
                      <Row k="Model" v={selectedMetadata.model ?? "Advan Trust Engine"} />
                      <Row k="Origin" v={selectedMetadata.source === "auto_triage" ? "Auto-triage" : "Manual"} />
                      <Row k="Channel" v={selectedLog.channel ? channelLabel(selectedLog.channel) : "—"} />
                      <Row k="Ticket" v={selectedLog.ticketId ? selectedLog.ticketId.slice(0, 8) : "none"} />
                      <Row k="Workflow" v={selectedLog.workflowId ? selectedLog.workflowId.slice(0, 8) : "none"} />
                      <Row k="Created" v={formatDate(selectedLog.createdAt)} />
                      <Row k="Decision" v={decisionLabel(selectedMetadata.decision?.action)} tone={selectedMetadata.decision?.action === "reject" ? "rose" : undefined} />
                    </div>
                  ) : (
                    <p className="text-[13px] text-[var(--dash-ink-faint)]">No audit log selected.</p>
                  )}
                </DashCard>

                <DashCard title="Production actions" icon={<Ticket className="h-[18px] w-[18px]" />}>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={copyDecision}
                      disabled={!selectedLog}
                      className="flex w-full items-center gap-2 rounded-lg border dash-border bg-white px-3 py-2 text-left text-[12.5px] font-semibold text-[var(--dash-ink-soft)] transition hover:text-[var(--dash-ink)] hover:dash-shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Clipboard className="h-4 w-4" />
                      Copy full trace
                    </button>
                    <button
                      type="button"
                      onClick={exportDecision}
                      disabled={!selectedLog}
                      className="flex w-full items-center gap-2 rounded-lg border dash-border bg-white px-3 py-2 text-left text-[12.5px] font-semibold text-[var(--dash-ink-soft)] transition hover:text-[var(--dash-ink)] hover:dash-shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" />
                      Export audit JSON
                    </button>
                    <Link href="/dashboard/analytics" className="flex w-full items-center gap-2 rounded-lg border dash-border bg-white px-3 py-2 text-[12.5px] font-semibold text-[var(--dash-accent-deep)] transition hover:dash-shadow-sm">
                      <ExternalLink className="h-4 w-4" />
                      Open analytics
                    </Link>
                    <Link href="/dashboard/knowledge-base" className="flex w-full items-center gap-2 rounded-lg border dash-border bg-white px-3 py-2 text-[12.5px] font-semibold text-[var(--dash-accent-deep)] transition hover:dash-shadow-sm">
                      <BookOpen className="h-4 w-4" />
                      Manage sources
                    </Link>
                  </div>
                </DashCard>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function normalizeMetadata(metadata: AuditMetadata | null | undefined): AuditMetadata {
  return metadata ?? {}
}

function decisionLabel(action: DecisionAction | undefined) {
  if (action === "accept") return "Accepted"
  if (action === "modify") return "Modified"
  if (action === "reject") return "Rejected"
  return "Pending"
}

function channelLabel(channel: string): string {
  if (channel === "email") return "Email"
  if (channel === "chat") return "Chat"
  return channel.charAt(0).toUpperCase() + channel.slice(1)
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatForExport(log: AuditLog) {
  return {
    id: log.id,
    ticketId: log.ticketId,
    workflowId: log.workflowId,
    createdAt: log.createdAt,
    input: log.input,
    output: log.output,
    metadata: normalizeMetadata(log.metadata),
  }
}

function classifyLog(log: AuditLog) {
  const metadata = normalizeMetadata(log.metadata)
  const confidence = metadata.confidence ?? 0
  const failed = (metadata.policyChecks ?? []).some((p) => !p.passed)
  const flagged = (metadata.hallucinationFlags ?? []).length > 0
  if (failed || flagged || metadata.decision?.action === "reject") return { label: "Blocked", tone: "rose" as const }
  if (confidence < CONFIDENCE_GATE) return { label: "Review", tone: "amber" as const }
  return { label: "Auto-pass", tone: "sage" as const }
}

function StatCard({ label, value, icon, tone = "default" }: { label: string; value: ReactNode; icon: ReactNode; tone?: "default" | "sage" | "amber" | "rose" }) {
  const toneClass = {
    default: "text-[var(--dash-accent)] bg-[#ECE9FB]",
    sage: "text-[var(--dash-sage)] bg-[var(--dash-sage-wash)]",
    amber: "text-[var(--dash-amber)] bg-[var(--dash-amber-wash)]",
    rose: "text-[var(--dash-rose)] bg-[var(--dash-rose-wash)]",
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

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-lg border dash-border bg-white px-2.5 text-[12px] font-semibold text-[var(--dash-ink-soft)] outline-none transition focus:border-[#9D91EA] focus:ring-2 focus:ring-[#6B5CD6]/15"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  )
}

function DecisionListItem({ log, active, onSelect }: { log: AuditLog; active: boolean; onSelect: () => void }) {
  const metadata = normalizeMetadata(log.metadata)
  const status = classifyLog(log)
  const citations = metadata.citations ?? []
  const isAutoTriage = metadata.source === "auto_triage"
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-xl border p-3 text-left transition",
        active
          ? "border-[#9D91EA] bg-[#F6F4FF] shadow-[0_14px_30px_-24px_rgba(78,63,182,.75)]"
          : "border-transparent bg-white hover:border-[var(--dash-line)] hover:shadow-[0_12px_26px_-24px_rgba(38,35,28,.65)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-bold text-[var(--dash-ink)]">
            {log.input.slice(0, 82) || "Untitled decision"}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] text-[var(--dash-ink-faint)]">
            <span>{formatDate(log.createdAt)}</span>
            <span>·</span>
            <span>{metadata.model ?? "Trust Engine"}</span>
            {isAutoTriage && (
              <span className="rounded-sm bg-[var(--dash-accent-wash)] px-1 py-0.5 text-[9px] font-bold text-[var(--dash-accent-deep)]">
                auto
              </span>
            )}
            {log.channel && (
              <span className={cn(
                "rounded-sm px-1 py-0.5 text-[9px] font-bold",
                log.channel === "chat"
                  ? "bg-blue-50 text-blue-700"
                  : log.channel === "email"
                  ? "bg-purple-50 text-purple-700"
                  : "bg-[var(--dash-bg)] text-[var(--dash-ink-faint)]",
              )}>
                {channelLabel(log.channel)}
              </span>
            )}
          </div>
        </div>
        <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold", status.tone === "sage" && "bg-[var(--dash-sage-wash)] text-[var(--dash-sage)]", status.tone === "amber" && "bg-[var(--dash-amber-wash)] text-[var(--dash-amber)]", status.tone === "rose" && "bg-[var(--dash-rose-wash)] text-[var(--dash-rose)]")}>
          {status.label}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <TinyFact label="Conf" value={`${metadata.confidence ?? 0}%`} />
        <TinyFact label="Sources" value={citations.length} />
        <TinyFact label="Policy" value={`${(metadata.policyChecks ?? []).filter((p) => p.passed).length}/${(metadata.policyChecks ?? []).length}`} />
      </div>
    </button>
  )
}

function ConfidenceRing({ value }: { value: number }) {
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  const color = value >= CONFIDENCE_GATE ? ["#76B98C", "#4A8A60"] : value >= 70 ? ["#E5A84F", "#B07A2A"] : ["#E58080", "#A04040"]
  return (
    <div className="relative h-[88px] w-[88px] shrink-0" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={`AI confidence ${value} percent`}>
      <svg width={88} height={88} viewBox="0 0 88 88" className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id="tapbox-ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={color[0]} />
            <stop offset="1" stopColor={color[1]} />
          </linearGradient>
        </defs>
        <circle cx="44" cy="44" r={radius} stroke="var(--dash-line)" strokeWidth="9" fill="none" />
        <motion.circle cx="44" cy="44" r={radius} stroke="url(#tapbox-ring-gradient)" strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }} transition={{ duration: 1.2, ease: [0.34, 1.2, 0.64, 1] }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[21px] font-extrabold text-[var(--dash-ink)]">{value}%</div>
    </div>
  )
}

function StatusPill({ blocked, needsReview }: { blocked: boolean; needsReview: boolean }) {
  if (blocked) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--dash-rose-wash)] px-2.5 py-1 text-[12px] font-bold text-[var(--dash-rose)]">
        <ShieldAlert className="h-3.5 w-3.5" />
        Blocked before send
      </div>
    )
  }
  if (needsReview) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--dash-amber-wash)] px-2.5 py-1 text-[12px] font-bold text-[var(--dash-amber)]">
        <AlertTriangle className="h-3.5 w-3.5" />
        Human review required
      </div>
    )
  }
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--dash-sage-wash)] px-2.5 py-1 text-[12px] font-bold text-[var(--dash-sage)]">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Production ready
    </div>
  )
}

function Section({ icon, label, empty, children }: { icon: ReactNode; label: string; empty?: string; children?: ReactNode }) {
  return (
    <section className="border-t dash-border-soft pt-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-soft)]">
        <span className="text-[var(--dash-accent)]">{icon}</span>
        {label}
      </div>
      {empty ? <div className="rounded-lg border dash-border-soft bg-[var(--dash-bg)] px-3 py-2 text-[12px] text-[var(--dash-ink-faint)]">{empty}</div> : <div className="space-y-2">{children}</div>}
    </section>
  )
}

function SourceRow({ citation }: { citation: Citation }) {
  const score = citation.score ?? 0
  return (
    <div className="flex items-start gap-2.5 rounded-lg border dash-border-soft bg-white px-3 py-2.5">
      <div className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-md dash-bg-blue-wash">
        <BookOpen className="h-3.5 w-3.5 text-[var(--dash-blue)]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-bold text-[var(--dash-ink)]">{citation.source}</div>
        {citation.content && <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-[var(--dash-ink-soft)]">{citation.content}</div>}
        {citation.url && <div className="mt-1 truncate font-mono text-[10px] text-[var(--dash-ink-faint)]">{citation.url}</div>}
      </div>
      <span className="rounded-md bg-[var(--dash-sage-wash)] px-1.5 py-0.5 text-[10.5px] font-extrabold text-[var(--dash-sage)]">{score}%</span>
    </div>
  )
}

function PolicyRow({ policy }: { policy: PolicyCheck }) {
  return (
    <div className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5", policy.passed ? "border-[#CBE0CF] bg-[var(--dash-sage-wash)]" : "border-[#F0CBCB] bg-[var(--dash-rose-wash)]")}>
      <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md bg-white">
        {policy.passed ? <ShieldCheck className="h-3.5 w-3.5 text-[var(--dash-sage)]" /> : <AlertTriangle className="h-3.5 w-3.5 text-[var(--dash-rose)]" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-bold text-[var(--dash-ink)]">{policy.rule}</div>
        {policy.reason && <div className="mt-0.5 text-[10.5px] leading-4 text-[var(--dash-ink-soft)]">{policy.reason}</div>}
      </div>
      <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold text-[var(--dash-ink-soft)]">{policy.passed ? "Passed" : "Flagged"}</span>
    </div>
  )
}

function TraceBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-[var(--dash-bg)] p-3">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">{label}</div>
      <pre className="max-h-[260px] whitespace-pre-wrap break-words font-mono text-[11.5px] leading-5 text-[var(--dash-ink-soft)]">{text}</pre>
    </div>
  )
}

function MiniMetric({ label, value, tone }: { label: string; value: ReactNode; tone?: "sage" | "rose" }) {
  return (
    <div className="rounded-xl border dash-border-soft bg-white p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">{label}</div>
      <div className={cn("mt-1 text-[16px] font-bold text-[var(--dash-ink)]", tone === "sage" && "text-[var(--dash-sage)]", tone === "rose" && "text-[var(--dash-rose)]")}>{value}</div>
    </div>
  )
}

function TinyFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-[var(--dash-bg)] px-2 py-1.5">
      <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">{label}</div>
      <div className="text-[11px] font-bold text-[var(--dash-ink)]">{value}</div>
    </div>
  )
}

function Row({ k, v, tone }: { k: string; v: ReactNode; tone?: "sage" | "amber" | "rose" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[var(--dash-ink-faint)]">{k}</span>
      <span className={cn("truncate text-right font-semibold text-[var(--dash-ink)]", tone === "sage" && "text-[var(--dash-sage)]", tone === "amber" && "text-[var(--dash-amber)]", tone === "rose" && "text-[var(--dash-rose)]")}>{v}</span>
    </div>
  )
}

function DecisionSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="skeleton h-[106px] rounded-xl" />
      ))}
    </div>
  )
}

function StateMessage({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border dash-border-soft bg-white px-5 py-8 text-center">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--dash-bg)] text-[var(--dash-ink-faint)]">{icon}</div>
      <div className="text-[13px] font-bold text-[var(--dash-ink)]">{title}</div>
      <p className="mt-1 max-w-sm text-[12px] leading-5 text-[var(--dash-ink-soft)]">{body}</p>
      {action && <div className="mt-3 text-[12.5px]">{action}</div>}
    </div>
  )
}
