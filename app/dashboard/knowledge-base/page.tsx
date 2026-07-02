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
  BookOpen,
  CheckCircle2,
  Clipboard,
  DatabaseZap,
  ExternalLink,
  FileText,
  Filter,
  FolderTree,
  Globe,
  Hash,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { DashCard, DashPageHeader } from "@/components/dashboard/page-header"
import { api } from "@/lib/api/trpc-client"
import { formatRelativeTime } from "@/lib/dashboard/format"
import { cn } from "@/lib/utils"

type SourceType = "document" | "website" | "ticket"
type EmbeddingStatus = "pending" | "processing" | "completed" | "failed"
type SourceTypeFilter = "all" | SourceType
type StatusFilter = "all" | EmbeddingStatus
type SortCol = "title" | "sourceType" | "embeddingStatus" | "createdAt"
type SortDir = "asc" | "desc"

type KnowledgeSource = {
  id: string
  title: string
  url: string | null
  s3Key: string | null
  sourceType: SourceType
  embeddingStatus: EmbeddingStatus
  createdAt: string | Date
}

type KnowledgeDetail = KnowledgeSource & {
  content: string
}

type Draft = {
  title: string
  content: string
  url: string
  sourceType: SourceType
}

const SOURCE_TYPES: SourceType[] = ["document", "website", "ticket"]
const STATUSES: EmbeddingStatus[] = ["completed", "processing", "pending", "failed"]
const PAGE_SIZE = 100
const FIELD_CLASS =
  "h-10 w-full rounded-lg border dash-border bg-white px-3 text-[13px] text-[var(--dash-ink)] outline-none transition placeholder:text-[var(--dash-ink-faint)] focus:border-[#9D91EA] focus:ring-2 focus:ring-[#6B5CD6]/15"

const STATUS_TONE: Record<EmbeddingStatus, string> = {
  completed: "bg-[var(--dash-sage-wash)] text-[#2f5d3f]",
  pending: "bg-[var(--dash-amber-wash)] text-[#8a5a1e]",
  processing: "bg-[var(--dash-blue-wash)] text-[#244e8a]",
  failed: "bg-[var(--dash-rose-wash)] text-[#8a3e3e]",
}

const SOURCE_ICON: Record<SourceType, ReactNode> = {
  document: <FileText className="h-4 w-4" />,
  website: <Globe className="h-4 w-4" />,
  ticket: <Hash className="h-4 w-4" />,
}

export default function KnowledgeBasePage() {
  const utils = api.useUtils()
  const [search, setSearch] = useState("")
  const [sourceType, setSourceType] = useState<SourceTypeFilter>("all")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [sortCol, setSortCol] = useState<SortCol>("createdAt")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [activeId, setActiveId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeSource | null>(null)
  const [draft, setDraft] = useState<Draft>({
    title: "",
    content: "",
    url: "",
    sourceType: "document",
  })

  const sourcesQuery = api.knowledge.list.useQuery(
    {
      search: search.trim() || undefined,
      sourceType: sourceType === "all" ? undefined : sourceType,
      embeddingStatus: status === "all" ? undefined : status,
      limit: PAGE_SIZE,
    },
    { staleTime: 20_000, refetchInterval: 30_000, refetchIntervalInBackground: false },
  )

  const sources = useMemo(() => ((sourcesQuery.data ?? []) as KnowledgeSource[]), [sourcesQuery.data])
  const sortedSources = useMemo(() => sortSources(sources, sortCol, sortDir), [sources, sortCol, sortDir])
  const activeSource = sortedSources.find((source) => source.id === activeId) ?? sortedSources[0] ?? null

  const detailQuery = api.knowledge.getById.useQuery(
    { id: activeSource?.id ?? "" },
    { enabled: Boolean(activeSource?.id), staleTime: 20_000 },
  )
  const detail = detailQuery.data as KnowledgeDetail | undefined

  const addMutation = api.knowledge.add.useMutation({
    onSuccess: async (source) => {
      toast.success("Knowledge source queued for indexing")
      setCreateOpen(false)
      setDraft({ title: "", content: "", url: "", sourceType: "document" })
      setActiveId(source.id)
      await utils.knowledge.list.invalidate()
    },
    onError: (error) => toast.error(error.message || "Could not add source"),
  })

  const deleteMutation = api.knowledge.delete.useMutation({
    onSuccess: async () => {
      toast.success("Knowledge source deleted")
      setDeleteTarget(null)
      await Promise.all([
        utils.knowledge.list.invalidate(),
        utils.knowledge.getById.invalidate(),
      ])
    },
    onError: (error) => toast.error(error.message || "Could not delete source"),
  })

  const stats = useMemo(() => {
    const total = sources.length
    const completed = sources.filter((source) => source.embeddingStatus === "completed").length
    const processing = sources.filter((source) => source.embeddingStatus === "processing").length
    const pending = sources.filter((source) => source.embeddingStatus === "pending").length
    const failed = sources.filter((source) => source.embeddingStatus === "failed").length
    const websites = sources.filter((source) => source.sourceType === "website").length
    return { total, completed, processing, pending, failed, websites }
  }, [sources])

  useEffect(() => {
    if (!sortedSources.some((source) => source.id === activeId)) {
      setActiveId(sortedSources[0]?.id ?? null)
    }
  }, [sortedSources, activeId])

  async function refresh() {
    await Promise.all([
      utils.knowledge.list.invalidate(),
      utils.knowledge.getById.invalidate(),
    ])
    toast.success("Knowledge base refreshed")
  }

  function toggleSort(column: SortCol) {
    if (sortCol === column) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"))
    } else {
      setSortCol(column)
      setSortDir(column === "title" ? "asc" : "desc")
    }
  }

  function submitSource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = draft.title.trim()
    const content = draft.content.trim()
    const url = draft.url.trim()

    if (!title || !content) {
      toast.error("Title and content are required")
      return
    }

    addMutation.mutate({
      title,
      content,
      sourceType: draft.sourceType,
      url: url || undefined,
    })
  }

  async function copyContent() {
    if (!detail) return
    await navigator.clipboard.writeText(detail.content)
    toast.success("Source content copied")
  }

  return (
    <div>
      <DashPageHeader
        eyebrow="Library"
        title="Knowledge Base"
        subtitle="Manage the approved source library that powers retrieval, citations, confidence scoring, and Copilot answers."
        actions={
          <>
            <button
              type="button"
              onClick={refresh}
              disabled={sourcesQuery.isFetching}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border dash-border bg-[var(--dash-card)] px-3.5 text-[13px] font-semibold text-[var(--dash-ink-soft)] transition hover:dash-shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={cn("h-4 w-4", sourcesQuery.isFetching && "animate-spin")} />
              Refresh
            </button>
            <Link
              href="/dashboard/copilot"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border dash-border bg-[var(--dash-card)] px-3.5 text-[13px] font-semibold text-[var(--dash-ink-soft)] transition hover:dash-shadow-sm"
            >
              <Sparkles className="h-4 w-4" />
              Test in Copilot
            </Link>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] px-4 text-[13px] font-semibold text-white shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] transition hover:-translate-y-px"
            >
              <Plus className="h-4 w-4" />
              New source
            </button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard label="Sources" value={sourcesQuery.isLoading ? "—" : stats.total} icon={<FolderTree className="h-4 w-4" />} />
        <StatCard label="Indexed" value={sourcesQuery.isLoading ? "—" : stats.completed} icon={<CheckCircle2 className="h-4 w-4" />} tone="sage" />
        <StatCard label="Processing" value={sourcesQuery.isLoading ? "—" : stats.processing} icon={<DatabaseZap className="h-4 w-4" />} tone="blue" />
        <StatCard label="Pending" value={sourcesQuery.isLoading ? "—" : stats.pending} icon={<Loader2 className="h-4 w-4" />} tone="amber" />
        <StatCard label="Failed" value={sourcesQuery.isLoading ? "—" : stats.failed} icon={<AlertTriangle className="h-4 w-4" />} tone={stats.failed ? "rose" : "sage"} />
        <StatCard label="Web sources" value={sourcesQuery.isLoading ? "—" : stats.websites} icon={<Globe className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <DashCard
          title="Sources"
          icon={<FolderTree className="h-[18px] w-[18px]" />}
          right={
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative block w-[250px] max-w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--dash-ink-faint)]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search title, content, URL..."
                  className="h-9 w-full rounded-lg border dash-border bg-white pl-8 pr-3 text-[12px] text-[var(--dash-ink)] outline-none transition placeholder:text-[var(--dash-ink-faint)] focus:border-[#9D91EA] focus:ring-2 focus:ring-[#6B5CD6]/15"
                />
              </label>
              <FilterSelect value={sourceType} onChange={(value) => setSourceType(value as SourceTypeFilter)} label="Source type" options={[["all", "All types"], ...SOURCE_TYPES.map((item) => [item, capitalize(item)] as [string, string])]} />
              <FilterSelect value={status} onChange={(value) => setStatus(value as StatusFilter)} label="Index status" options={[["all", "All statuses"], ...STATUSES.map((item) => [item, capitalize(item)] as [string, string])]} />
            </div>
          }
          padded={false}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="text-left text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">
                <tr>
                  <SortableTh label="Title" active={sortCol === "title"} dir={sortDir} onClick={() => toggleSort("title")} />
                  <SortableTh label="Type" active={sortCol === "sourceType"} dir={sortDir} onClick={() => toggleSort("sourceType")} />
                  <SortableTh label="Status" active={sortCol === "embeddingStatus"} dir={sortDir} onClick={() => toggleSort("embeddingStatus")} />
                  <SortableTh label="Updated" active={sortCol === "createdAt"} dir={sortDir} onClick={() => toggleSort("createdAt")} />
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {sourcesQuery.isLoading ? (
                  Array.from({ length: 7 }).map((_, index) => (
                    <tr key={index} className="border-t dash-border-soft">
                      <td className="px-4 py-3"><div className="skeleton h-9 w-64 rounded" /></td>
                      <td className="px-4 py-3"><div className="skeleton h-5 w-20 rounded" /></td>
                      <td className="px-4 py-3"><div className="skeleton h-5 w-24 rounded" /></td>
                      <td className="px-4 py-3"><div className="skeleton h-4 w-20 rounded" /></td>
                      <td />
                    </tr>
                  ))
                ) : sourcesQuery.isError ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10">
                      <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="Could not load sources" body={sourcesQuery.error.message} />
                    </td>
                  </tr>
                ) : sortedSources.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10">
                      <EmptyState
                        icon={<BookOpen className="h-5 w-5" />}
                        title="No knowledge sources found"
                        body={search || sourceType !== "all" || status !== "all" ? "Adjust search or filters to see more sources." : "Add your first approved source to ground Copilot answers."}
                        action={<button type="button" onClick={() => setCreateOpen(true)} className="font-bold text-[var(--dash-accent-deep)] hover:underline">Add source</button>}
                      />
                    </td>
                  </tr>
                ) : (
                  sortedSources.map((source) => (
                    <tr
                      key={source.id}
                      onClick={() => setActiveId(source.id)}
                      className={cn(
                        "cursor-pointer border-t dash-border-soft transition hover:bg-[rgba(107,92,214,0.04)]",
                        activeSource?.id === source.id && "bg-[#F6F4FF]",
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex min-w-[260px] items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#ECE9FB] text-[var(--dash-accent-deep)]">
                            {SOURCE_ICON[source.sourceType]}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-bold text-[13px] text-[var(--dash-ink)]">{source.title}</div>
                            {source.url && <div className="truncate font-mono text-[10.5px] text-[var(--dash-ink-faint)]">{source.url}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-[var(--dash-bg)] px-2 py-0.5 text-[11px] font-bold capitalize text-[var(--dash-ink-soft)]">{source.sourceType}</span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={source.embeddingStatus} /></td>
                      <td className="px-4 py-3 text-[var(--dash-ink-soft)]">{formatRelativeTime(source.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            setDeleteTarget(source)
                          }}
                          disabled={deleteMutation.isPending}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--dash-ink-faint)] transition hover:bg-white hover:text-[var(--dash-rose)] disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Delete ${source.title}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DashCard>

        <div className="flex flex-col gap-4">
          <SourceInspector
            source={activeSource}
            detail={detail}
            isLoading={detailQuery.isLoading}
            onCopy={copyContent}
            onDelete={() => activeSource && setDeleteTarget(activeSource)}
          />
          <DashCard title="Retrieval readiness" icon={<ShieldCheck className="h-[18px] w-[18px]" />}>
            <div className="space-y-2 text-[12.5px]">
              <ReadinessRow label="Indexed coverage" value={`${stats.completed}/${stats.total || 0}`} ok={stats.total > 0 && stats.completed === stats.total} />
              <ReadinessRow label="Failed embeddings" value={String(stats.failed)} ok={stats.failed === 0} />
              <ReadinessRow label="Mixed source types" value={String(new Set(sources.map((source) => source.sourceType)).size)} ok={new Set(sources.map((source) => source.sourceType)).size >= 2} />
              <ReadinessRow label="Copilot citations" value={stats.completed > 0 ? "Available" : "Waiting"} ok={stats.completed > 0} />
            </div>
          </DashCard>
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
              onSubmit={submitSource}
              onMouseDown={(event) => event.stopPropagation()}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.22 }}
              className="w-full max-w-[720px] overflow-hidden rounded-2xl border dash-border bg-[var(--dash-card)] shadow-[0_30px_90px_-45px_rgba(23,26,23,0.55)]"
            >
              <div className="flex items-center gap-3 border-b dash-border-soft px-5 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ECE9FB] text-[var(--dash-accent)]">
                  <BookOpen className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-bold text-[var(--dash-ink)]">New knowledge source</div>
                  <div className="text-[12px] text-[var(--dash-ink-faint)]">Add approved content and queue it for embedding.</div>
                </div>
                <button type="button" onClick={() => setCreateOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--dash-ink-faint)] transition hover:bg-[var(--dash-bg)] hover:text-[var(--dash-ink)]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 p-5">
                <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                  <Field label="Title" required>
                    <input value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} autoFocus placeholder="Refund policy v4" className={FIELD_CLASS} />
                  </Field>
                  <Field label="Type">
                    <select value={draft.sourceType} onChange={(event) => setDraft((value) => ({ ...value, sourceType: event.target.value as SourceType }))} className={FIELD_CLASS}>
                      {SOURCE_TYPES.map((item) => (
                        <option key={item} value={item}>{capitalize(item)}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="URL">
                  <input value={draft.url} onChange={(event) => setDraft((value) => ({ ...value, url: event.target.value }))} placeholder="https://docs.company.com/refunds" className={FIELD_CLASS} />
                </Field>
                <Field label="Content" required>
                  <textarea
                    value={draft.content}
                    onChange={(event) => setDraft((value) => ({ ...value, content: event.target.value }))}
                    placeholder="Paste the approved article, policy, runbook, or ticket resolution..."
                    className="min-h-[220px] w-full resize-y rounded-lg border dash-border bg-white px-3 py-2.5 text-[13px] leading-5 text-[var(--dash-ink)] outline-none transition placeholder:text-[var(--dash-ink-faint)] focus:border-[#9D91EA] focus:ring-2 focus:ring-[#6B5CD6]/15"
                  />
                </Field>
              </div>
              <div className="flex justify-end gap-2 border-t dash-border-soft px-5 py-4">
                <button type="button" onClick={() => setCreateOpen(false)} className="h-9 rounded-lg border dash-border bg-white px-3.5 text-[13px] font-semibold text-[var(--dash-ink-soft)] transition hover:text-[var(--dash-ink)]">Cancel</button>
                <button type="submit" disabled={addMutation.isPending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] px-4 text-[13px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60">
                  {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add and index
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => setDeleteTarget(null)}
          >
            <motion.div
              onMouseDown={(event) => event.stopPropagation()}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="w-full max-w-[420px] rounded-2xl border dash-border bg-[var(--dash-card)] p-5 shadow-[0_30px_90px_-45px_rgba(23,26,23,0.55)]"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--dash-rose-wash)] text-[var(--dash-rose)]">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[15px] font-bold text-[var(--dash-ink)]">Delete knowledge source?</div>
                  <p className="mt-1 text-[12.5px] leading-5 text-[var(--dash-ink-soft)]">
                    This removes "{deleteTarget.title}" from retrieval and citation results.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setDeleteTarget(null)} className="h-9 rounded-lg border dash-border bg-white px-3.5 text-[13px] font-semibold text-[var(--dash-ink-soft)] transition hover:text-[var(--dash-ink)]">Cancel</button>
                <button type="button" onClick={() => deleteMutation.mutate({ id: deleteTarget.id })} disabled={deleteMutation.isPending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--dash-rose)] px-4 text-[13px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60">
                  {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function sortSources(sources: KnowledgeSource[], col: SortCol, dir: SortDir) {
  return [...sources].sort((a, b) => {
    let cmp = 0
    if (col === "title") cmp = a.title.localeCompare(b.title)
    if (col === "sourceType") cmp = a.sourceType.localeCompare(b.sourceType)
    if (col === "embeddingStatus") cmp = statusRank(a.embeddingStatus) - statusRank(b.embeddingStatus)
    if (col === "createdAt") cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    return dir === "desc" ? -cmp : cmp
  })
}

function statusRank(status: EmbeddingStatus) {
  return status === "failed" ? 4 : status === "processing" ? 3 : status === "pending" ? 2 : 1
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function StatCard({ label, value, icon, tone = "default" }: { label: string; value: ReactNode; icon: ReactNode; tone?: "default" | "sage" | "amber" | "rose" | "blue" }) {
  const toneClass = {
    default: "bg-[var(--dash-bg)] text-[var(--dash-ink-faint)]",
    sage: "bg-[var(--dash-sage-wash)] text-[var(--dash-sage)]",
    amber: "bg-[var(--dash-amber-wash)] text-[var(--dash-amber)]",
    rose: "bg-[var(--dash-rose-wash)] text-[var(--dash-rose)]",
    blue: "bg-[var(--dash-blue-wash)] text-[var(--dash-blue)]",
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
    <label className="relative">
      <span className="sr-only">{label}</span>
      <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--dash-ink-faint)]" />
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 rounded-lg border dash-border bg-white pl-8 pr-7 text-[12px] font-semibold text-[var(--dash-ink-soft)] outline-none transition focus:border-[#9D91EA] focus:ring-2 focus:ring-[#6B5CD6]/15">
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
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

function StatusBadge({ status }: { status: EmbeddingStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold capitalize", STATUS_TONE[status])}>
      {status === "processing" && <Loader2 className="h-3 w-3 animate-spin" />}
      {status === "completed" && <CheckCircle2 className="h-3 w-3" />}
      {status === "failed" && <AlertTriangle className="h-3 w-3" />}
      {status}
    </span>
  )
}

function SourceInspector({ source, detail, isLoading, onCopy, onDelete }: { source: KnowledgeSource | null; detail?: KnowledgeDetail; isLoading: boolean; onCopy: () => void; onDelete: () => void }) {
  if (!source) {
    return (
      <DashCard title="Source inspector" icon={<BookOpen className="h-[18px] w-[18px]" />}>
        <EmptyState icon={<BookOpen className="h-5 w-5" />} title="No source selected" body="Select a source to inspect content, indexing status, and retrieval readiness." />
      </DashCard>
    )
  }

  return (
    <DashCard
      title="Source inspector"
      icon={<BookOpen className="h-[18px] w-[18px]" />}
      right={<StatusBadge status={source.embeddingStatus} />}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ECE9FB] text-[var(--dash-accent-deep)]">
          {SOURCE_ICON[source.sourceType]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold text-[var(--dash-ink)]">{source.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--dash-ink-faint)]">
            <span className="capitalize">{source.sourceType}</span>
            <span>·</span>
            <span>{formatRelativeTime(source.createdAt)}</span>
          </div>
        </div>
      </div>

      {source.url && (
        <a href={source.url} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--dash-bg)] px-3 py-2 font-mono text-[10.5px] text-[var(--dash-accent-deep)] transition hover:underline">
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{source.url}</span>
        </a>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniMetric label="Type" value={capitalize(source.sourceType)} />
        <MiniMetric label="Status" value={capitalize(source.embeddingStatus)} tone={source.embeddingStatus === "failed" ? "rose" : source.embeddingStatus === "completed" ? "sage" : undefined} />
        <MiniMetric label="Storage" value={source.s3Key ? "S3" : "Database"} />
        <MiniMetric label="Length" value={detail?.content ? `${detail.content.length.toLocaleString()} chars` : "—"} />
      </div>

      <div className="mt-4 border-t dash-border-soft pt-3">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">Content preview</div>
        {isLoading ? (
          <div className="skeleton h-40 rounded-lg" />
        ) : (
          <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--dash-bg)] p-3 font-mono text-[11.5px] leading-5 text-[var(--dash-ink-soft)]">
            {detail?.content || "No content available."}
          </pre>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onCopy} disabled={!detail?.content} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border dash-border bg-white text-[12.5px] font-semibold text-[var(--dash-ink-soft)] transition hover:text-[var(--dash-ink)] hover:dash-shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
          <Clipboard className="h-4 w-4" />
          Copy
        </button>
        <button type="button" onClick={onDelete} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border dash-border bg-white text-[12.5px] font-semibold text-[var(--dash-rose)] transition hover:dash-shadow-sm">
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>
    </DashCard>
  )
}

function MiniMetric({ label, value, tone }: { label: string; value: ReactNode; tone?: "sage" | "rose" }) {
  return (
    <div className="rounded-xl border dash-border-soft bg-white p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">{label}</div>
      <div className={cn("mt-1 truncate text-[14px] font-bold text-[var(--dash-ink)]", tone === "sage" && "text-[var(--dash-sage)]", tone === "rose" && "text-[var(--dash-rose)]")}>{value}</div>
    </div>
  )
}

function ReadinessRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-[var(--dash-bg)] px-3 py-2">
      {ok ? <CheckCircle2 className="h-4 w-4 text-[var(--dash-sage)]" /> : <AlertTriangle className="h-4 w-4 text-[var(--dash-amber)]" />}
      <span className="text-[var(--dash-ink-soft)]">{label}</span>
      <span className="ml-auto font-bold text-[var(--dash-ink)]">{value}</span>
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
