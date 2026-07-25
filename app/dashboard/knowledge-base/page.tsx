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
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  DatabaseZap,
  ExternalLink,
  FileText,
  Filter,
  FolderTree,
  Globe,
  Hash,
  Loader2,
  Lock,
  Pencil,
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
import { useBillingRestriction } from "@/hooks/use-billing-restriction"
import { formatRelativeTime } from "@/lib/dashboard/format"
import { cn } from "@/lib/utils"

type SourceType = "document" | "website" | "ticket"
type EmbeddingStatus = "pending" | "processing" | "completed" | "failed"
type SourceTypeFilter = "all" | SourceType
type StatusFilter = "all" | EmbeddingStatus
type SortCol = "title" | "sourceType" | "embeddingStatus" | "createdAt"
type SortDir = "asc" | "desc"
type MobilePane = "list" | "inspector"

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
const TABLE_LAYOUT_MQ = "(min-width: 1024px)"
const WORKBENCH_MQ = "(min-width: 1280px)"

const FIELD_CLASS =
  "h-11 sm:h-10 w-full rounded-lg border dash-border bg-white px-3 text-[13px] text-[var(--dash-ink)] outline-none transition placeholder:text-[var(--dash-ink-faint)] focus:border-[#9D91EA] focus:ring-2 focus:ring-[#6B5CD6]/15"

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

const SORT_LABELS: Record<SortCol, string> = {
  title: "Title",
  sourceType: "Type",
  embeddingStatus: "Status",
  createdAt: "Updated",
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

export default function KnowledgeBasePage() {
  const utils = api.useUtils()
  const { isRestricted: isBillingRestricted } = useBillingRestriction()
  const isTableLayout = useMediaQuery(TABLE_LAYOUT_MQ)
  const isWorkbench = useMediaQuery(WORKBENCH_MQ)

  const [search, setSearch] = useState("")
  const [sourceType, setSourceType] = useState<SourceTypeFilter>("all")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [sortCol, setSortCol] = useState<SortCol>("createdAt")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mobilePane, setMobilePane] = useState<MobilePane>("list")
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeSource | null>(null)
  const [draft, setDraft] = useState<Draft>({
    title: "",
    content: "",
    url: "",
    sourceType: "document",
  })
  const [editDraft, setEditDraft] = useState<Draft>({
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
      if (!isWorkbench) setMobilePane("inspector")
      await utils.knowledge.list.invalidate()
    },
    onError: (error) => toast.error(error.message || "Could not add source"),
  })

  const deleteMutation = api.knowledge.delete.useMutation({
    onSuccess: async () => {
      toast.success("Knowledge source deleted")
      setDeleteTarget(null)
      if (!isWorkbench) setMobilePane("list")
      await Promise.all([
        utils.knowledge.list.invalidate(),
        utils.knowledge.getById.invalidate(),
      ])
    },
    onError: (error) => toast.error(error.message || "Could not delete source"),
  })

  const updateMutation = api.knowledge.update.useMutation({
    onSuccess: async (source) => {
      toast.success("Knowledge source updated")
      setEditOpen(false)
      setActiveId(source.id)
      await Promise.all([
        utils.knowledge.list.invalidate(),
        utils.knowledge.getById.invalidate({ id: source.id }),
      ])
    },
    onError: (error) => toast.error(error.message || "Could not update source"),
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

  useEffect(() => {
    if (isWorkbench) setMobilePane("list")
  }, [isWorkbench])

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

  function selectSource(id: string) {
    setActiveId(id)
    if (!isWorkbench) setMobilePane("inspector")
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

  function openEdit() {
    if (!detail) return
    setEditDraft({
      title: detail.title,
      content: detail.content,
      url: detail.url ?? "",
      sourceType: detail.sourceType,
    })
    setEditOpen(true)
  }

  function submitEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeSource) return

    const title = editDraft.title.trim()
    const content = editDraft.content.trim()
    const url = editDraft.url.trim()

    if (!title || !content) {
      toast.error("Title and content are required")
      return
    }

    updateMutation.mutate({
      id: activeSource.id,
      title,
      content,
      sourceType: editDraft.sourceType,
      url: url || "",
    })
  }

  async function copyContent() {
    if (!detail) return
    await navigator.clipboard.writeText(detail.content)
    toast.success("Source content copied")
  }

  const showList = isWorkbench || mobilePane === "list"
  const showInspector = isWorkbench || mobilePane === "inspector"
  const hasFilters = Boolean(search || sourceType !== "all" || status !== "all")

  return (
    <div className="kb-page min-w-0 w-full max-w-full">
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
              className="inline-flex min-h-10 h-10 sm:h-9 flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg border dash-border bg-[var(--dash-card)] px-3 sm:px-3.5 text-[13px] font-semibold text-[var(--dash-ink-soft)] transition hover:dash-shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={cn("h-4 w-4 shrink-0", sourcesQuery.isFetching && "animate-spin")} />
              <span className="truncate">Refresh</span>
            </button>
            <Link
              href="/dashboard/copilot"
              className="inline-flex min-h-10 h-10 sm:h-9 flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg border dash-border bg-[var(--dash-card)] px-3 sm:px-3.5 text-[13px] font-semibold text-[var(--dash-ink-soft)] transition hover:dash-shadow-sm"
            >
              <Sparkles className="h-4 w-4 shrink-0" />
              <span className="truncate sm:hidden">Copilot</span>
              <span className="hidden sm:inline truncate">Test in Copilot</span>
            </Link>
            <button
              type="button"
              disabled={isBillingRestricted}
              onClick={() => {
                if (isBillingRestricted) {
                  toast.error("Actions are locked due to past due invoice. Please update billing under settings.")
                } else {
                  setCreateOpen(true)
                }
              }}
              className="inline-flex min-h-10 h-10 sm:h-9 w-full sm:w-auto sm:flex-none items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] px-3.5 sm:px-4 text-[13px] font-semibold text-white shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] transition hover:-translate-y-px disabled:from-gray-400 disabled:to-gray-500 disabled:shadow-none disabled:cursor-not-allowed disabled:opacity-70 basis-full sm:basis-auto"
            >
              {isBillingRestricted ? <Lock className="h-4 w-4 shrink-0" /> : <Plus className="h-4 w-4 shrink-0" />}
              <span className="truncate">New source</span>
            </button>
          </>
        }
      />

      {/* KPI strip: 2 → 3 → 6 */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 xl:grid-cols-6 3xl:gap-4">
        <StatCard label="Sources" value={sourcesQuery.isLoading ? "—" : stats.total} icon={<FolderTree className="h-4 w-4" />} />
        <StatCard label="Indexed" value={sourcesQuery.isLoading ? "—" : stats.completed} icon={<CheckCircle2 className="h-4 w-4" />} tone="sage" />
        <StatCard label="Processing" value={sourcesQuery.isLoading ? "—" : stats.processing} icon={<DatabaseZap className="h-4 w-4" />} tone="blue" />
        <StatCard label="Pending" value={sourcesQuery.isLoading ? "—" : stats.pending} icon={<Loader2 className="h-4 w-4" />} tone="amber" />
        <StatCard label="Failed" value={sourcesQuery.isLoading ? "—" : stats.failed} icon={<AlertTriangle className="h-4 w-4" />} tone={stats.failed ? "rose" : "sage"} />
        <StatCard label="Web sources" value={sourcesQuery.isLoading ? "—" : stats.websites} icon={<Globe className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] 3xl:grid-cols-[minmax(0,1fr)_minmax(20rem,25rem)] 4xl:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)] items-start">
        {/* ── Sources list ── */}
        <div className={cn(showList ? "min-w-0" : "hidden", "xl:block xl:min-w-0")}>
          <DashCard
            title="Sources"
            icon={<FolderTree className="h-[18px] w-[18px]" />}
            right={
              <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto">
                <label className="relative block w-full min-w-0 sm:flex-1 sm:min-w-[12rem] lg:flex-none lg:w-[14rem] xl:w-[16rem] 3xl:w-[18rem]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--dash-ink-faint)]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search title, content, URL…"
                    aria-label="Search knowledge sources"
                    className="h-10 sm:h-9 w-full rounded-lg border dash-border bg-white pl-8 pr-3 text-[13px] sm:text-[12px] text-[var(--dash-ink)] outline-none transition placeholder:text-[var(--dash-ink-faint)] focus:border-[#9D91EA] focus:ring-2 focus:ring-[#6B5CD6]/15"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <FilterSelect
                    value={sourceType}
                    onChange={(value) => setSourceType(value as SourceTypeFilter)}
                    label="Source type"
                    options={[["all", "All types"], ...SOURCE_TYPES.map((item) => [item, capitalize(item)] as [string, string])]}
                    className="min-w-0 flex-1 sm:flex-none"
                  />
                  <FilterSelect
                    value={status}
                    onChange={(value) => setStatus(value as StatusFilter)}
                    label="Index status"
                    options={[["all", "All statuses"], ...STATUSES.map((item) => [item, capitalize(item)] as [string, string])]}
                    className="min-w-0 flex-1 sm:flex-none"
                  />
                  {!isTableLayout && (
                    <MobileSortControl sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  )}
                </div>
              </div>
            }
            padded={false}
          >
            <div className="flex items-center justify-between gap-2 border-b dash-border-soft px-3 sm:px-4 py-2">
              <span className="text-[11px] text-[var(--dash-ink-faint)] tabular-nums">
                {sourcesQuery.isLoading ? "…" : `${sortedSources.length} source${sortedSources.length === 1 ? "" : "s"}`}
              </span>
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => { setSearch(""); setSourceType("all"); setStatus("all") }}
                  className="text-[11.5px] font-semibold text-[var(--dash-accent)] hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>

            {isTableLayout ? (
              <div className="overflow-x-auto overscroll-x-contain">
                <table className="w-full min-w-[40rem] xl:min-w-0 text-[12.5px] 3xl:text-[13px] table-fixed xl:table-auto">
                  <thead className="sticky top-0 z-10 text-left text-[11px] 3xl:text-[11.5px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)] bg-[var(--dash-bg-deep)]/60 backdrop-blur-sm">
                    <tr>
                      <SortableTh label="Title" active={sortCol === "title"} dir={sortDir} onClick={() => toggleSort("title")} className="w-[42%] xl:w-auto" />
                      <SortableTh label="Type" active={sortCol === "sourceType"} dir={sortDir} onClick={() => toggleSort("sourceType")} className="w-[14%] xl:w-auto" />
                      <SortableTh label="Status" active={sortCol === "embeddingStatus"} dir={sortDir} onClick={() => toggleSort("embeddingStatus")} className="w-[16%] xl:w-auto" />
                      <SortableTh label="Updated" active={sortCol === "createdAt"} dir={sortDir} onClick={() => toggleSort("createdAt")} className="w-[16%] xl:w-auto" />
                      <th className="px-3 xl:px-4 3xl:px-5 py-2.5 3xl:py-3 w-[12%] xl:w-auto" />
                    </tr>
                  </thead>
                  <tbody>
                    {sourcesQuery.isLoading ? (
                      Array.from({ length: 7 }).map((_, index) => (
                        <tr key={index} className="border-t dash-border-soft">
                          <td className="px-3 xl:px-4 3xl:px-5 py-3"><div className="skeleton h-9 w-48 xl:w-64 rounded" /></td>
                          <td className="px-3 xl:px-4 3xl:px-5 py-3"><div className="skeleton h-5 w-16 rounded" /></td>
                          <td className="px-3 xl:px-4 3xl:px-5 py-3"><div className="skeleton h-5 w-20 rounded" /></td>
                          <td className="px-3 xl:px-4 3xl:px-5 py-3"><div className="skeleton h-4 w-16 rounded" /></td>
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
                            body={hasFilters ? "Adjust search or filters to see more sources." : "Add your first approved source to ground Copilot answers."}
                            action={<button type="button" onClick={() => setCreateOpen(true)} className="font-bold text-[var(--dash-accent-deep)] hover:underline">Add source</button>}
                          />
                        </td>
                      </tr>
                    ) : (
                      sortedSources.map((source) => (
                        <tr
                          key={source.id}
                          onClick={() => selectSource(source.id)}
                          className={cn(
                            "group cursor-pointer border-t dash-border-soft transition hover:bg-[rgba(107,92,214,0.04)]",
                            activeSource?.id === source.id && "bg-[#F6F4FF]",
                          )}
                        >
                          <td className="px-3 xl:px-4 3xl:px-5 py-3 3xl:py-3.5">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#ECE9FB] text-[var(--dash-accent-deep)]">
                                {SOURCE_ICON[source.sourceType]}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate font-bold text-[13px] text-[var(--dash-ink)] max-w-[12rem] xl:max-w-[18rem] 2xl:max-w-[24rem] 3xl:max-w-[30rem] 4xl:max-w-[36rem]">
                                  {source.title}
                                </div>
                                {source.url && (
                                  <div className="truncate font-mono text-[10.5px] text-[var(--dash-ink-faint)] max-w-[12rem] xl:max-w-[18rem] 3xl:max-w-[28rem]">
                                    {source.url}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 xl:px-4 3xl:px-5 py-3 3xl:py-3.5">
                            <span className="rounded-md bg-[var(--dash-bg)] px-2 py-0.5 text-[11px] font-bold capitalize text-[var(--dash-ink-soft)]">
                              {source.sourceType}
                            </span>
                          </td>
                          <td className="px-3 xl:px-4 3xl:px-5 py-3 3xl:py-3.5">
                            <StatusBadge status={source.embeddingStatus} />
                          </td>
                          <td className="px-3 xl:px-4 3xl:px-5 py-3 3xl:py-3.5 text-[var(--dash-ink-soft)] whitespace-nowrap tabular-nums">
                            {formatRelativeTime(source.createdAt)}
                          </td>
                          <td className="px-3 xl:px-4 3xl:px-5 py-3 3xl:py-3.5 text-right">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                setDeleteTarget(source)
                              }}
                              disabled={deleteMutation.isPending}
                              className="inline-flex min-h-9 min-w-9 h-9 w-9 items-center justify-center rounded-md text-[var(--dash-ink-faint)] transition hover:bg-white hover:text-[var(--dash-rose)] disabled:cursor-not-allowed disabled:opacity-50 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
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
            ) : (
              <div className="divide-y divide-[var(--dash-line-soft)]" role="list">
                {sourcesQuery.isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <SourceCardSkeleton key={index} />
                  ))
                ) : sourcesQuery.isError ? (
                  <div className="px-4 py-10">
                    <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="Could not load sources" body={sourcesQuery.error.message} />
                  </div>
                ) : sortedSources.length === 0 ? (
                  <div className="px-4 py-10">
                    <EmptyState
                      icon={<BookOpen className="h-5 w-5" />}
                      title="No knowledge sources found"
                      body={hasFilters ? "Adjust search or filters to see more sources." : "Add your first approved source to ground Copilot answers."}
                      action={<button type="button" onClick={() => setCreateOpen(true)} className="font-bold text-[var(--dash-accent-deep)] hover:underline">Add source</button>}
                    />
                  </div>
                ) : (
                  sortedSources.map((source) => (
                    <SourceCard
                      key={source.id}
                      source={source}
                      isActive={activeSource?.id === source.id}
                      onSelect={() => selectSource(source.id)}
                      onDelete={() => setDeleteTarget(source)}
                      deletePending={deleteMutation.isPending}
                    />
                  ))
                )}
              </div>
            )}
          </DashCard>
        </div>

        {/* ── Inspector pane ── */}
        <div className={cn(
          showInspector ? "flex" : "hidden",
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
              Back to sources
            </button>
          )}
          <SourceInspector
            source={activeSource}
            detail={detail}
            isLoading={detailQuery.isLoading}
            onCopy={copyContent}
            onEdit={openEdit}
            onView={() => setViewOpen(true)}
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
          <SourceFormModal
            title="New knowledge source"
            subtitle="Add approved content and queue it for embedding."
            draft={draft}
            setDraft={setDraft}
            submitLabel="Add and index"
            submitIcon={<Plus className="h-4 w-4" />}
            isPending={addMutation.isPending}
            onClose={() => setCreateOpen(false)}
            onSubmit={submitSource}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editOpen && activeSource && (
          <SourceFormModal
            title="Edit knowledge source"
            subtitle="Update content and metadata. Title or content changes re-queue indexing."
            draft={editDraft}
            setDraft={setEditDraft}
            submitLabel="Save changes"
            submitIcon={<Pencil className="h-4 w-4" />}
            isPending={updateMutation.isPending}
            onClose={() => setEditOpen(false)}
            onSubmit={submitEdit}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewOpen && detail && activeSource && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-0 sm:p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => setViewOpen(false)}
          >
            <motion.div
              onMouseDown={(event) => event.stopPropagation()}
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.22 }}
              className="flex max-h-[min(100dvh,100%)] sm:max-h-[90vh] w-full max-w-[900px] 3xl:max-w-[1040px] flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border dash-border bg-[var(--dash-card)] shadow-[0_30px_90px_-45px_rgba(23,26,23,0.55)] pb-[env(safe-area-inset-bottom)]"
            >
              <div className="flex items-start sm:items-center gap-3 border-b dash-border-soft px-4 sm:px-5 py-4 sticky top-0 bg-[var(--dash-card)] z-10">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ECE9FB] text-[var(--dash-accent)]">
                  {SOURCE_ICON[activeSource.sourceType]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold text-[var(--dash-ink)]">{detail.title}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--dash-ink-faint)]">
                    <span className="capitalize">{detail.sourceType}</span>
                    <span>·</span>
                    <StatusBadge status={detail.embeddingStatus} />
                    <span>·</span>
                    <span>{formatRelativeTime(detail.createdAt)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewOpen(false)}
                  className="flex min-h-9 min-w-9 h-9 w-9 items-center justify-center rounded-md text-[var(--dash-ink-faint)] transition hover:bg-[var(--dash-bg)] hover:text-[var(--dash-ink)] shrink-0"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {detail.url && (
                <div className="border-b dash-border-soft px-4 sm:px-5 py-3">
                  <a href={detail.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-mono text-[11px] text-[var(--dash-accent-deep)] transition hover:underline min-w-0">
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{detail.url}</span>
                  </a>
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
                <pre className="whitespace-pre-wrap break-words font-mono text-[12.5px] sm:text-[13px] leading-6 text-[var(--dash-ink-soft)]">
                  {detail.content}
                </pre>
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t dash-border-soft px-4 sm:px-5 py-4">
                <button
                  type="button"
                  onClick={copyContent}
                  className="inline-flex min-h-11 sm:min-h-9 h-11 sm:h-9 items-center justify-center gap-1.5 rounded-lg border dash-border bg-white px-3.5 text-[13px] font-semibold text-[var(--dash-ink-soft)] transition hover:text-[var(--dash-ink)]"
                >
                  <Clipboard className="h-4 w-4" />
                  Copy content
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewOpen(false)
                    openEdit()
                  }}
                  className="inline-flex min-h-11 sm:min-h-9 h-11 sm:h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] px-4 text-[13px] font-semibold text-white transition"
                >
                  <Pencil className="h-4 w-4" />
                  Edit source
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-0 sm:p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => setDeleteTarget(null)}
          >
            <motion.div
              onMouseDown={(event) => event.stopPropagation()}
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              className="w-full max-w-[420px] rounded-t-2xl sm:rounded-2xl border dash-border bg-[var(--dash-card)] p-4 sm:p-5 shadow-[0_30px_90px_-45px_rgba(23,26,23,0.55)] pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--dash-rose-wash)] text-[var(--dash-rose)]">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[15px] font-bold text-[var(--dash-ink)]">Delete knowledge source?</div>
                  <p className="mt-1 text-[12.5px] leading-5 text-[var(--dash-ink-soft)] break-words">
                    This removes &ldquo;{deleteTarget.title}&rdquo; from retrieval and citation results.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="min-h-11 sm:min-h-9 h-11 sm:h-9 rounded-lg border dash-border bg-white px-3.5 text-[13px] font-semibold text-[var(--dash-ink-soft)] transition hover:text-[var(--dash-ink)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate({ id: deleteTarget.id })}
                  disabled={deleteMutation.isPending}
                  className="inline-flex min-h-11 sm:min-h-9 h-11 sm:h-9 items-center justify-center gap-1.5 rounded-lg bg-[var(--dash-rose)] px-4 text-[13px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                >
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

function StatCard({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string
  value: ReactNode
  icon: ReactNode
  tone?: "default" | "sage" | "amber" | "rose" | "blue"
}) {
  const toneClass = {
    default: "bg-[var(--dash-bg)] text-[var(--dash-ink-faint)]",
    sage: "bg-[var(--dash-sage-wash)] text-[var(--dash-sage)]",
    amber: "bg-[var(--dash-amber-wash)] text-[var(--dash-amber)]",
    rose: "bg-[var(--dash-rose-wash)] text-[var(--dash-rose)]",
    blue: "bg-[var(--dash-blue-wash)] text-[var(--dash-blue)]",
  }[tone]
  return (
    <div className="dash-card p-3 sm:p-3.5 3xl:p-4 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)] truncate">{label}</div>
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", toneClass)}>{icon}</span>
      </div>
      <div className="mt-1 text-[clamp(1.15rem,2vw+0.5rem,1.5rem)] font-bold tracking-tight text-[var(--dash-ink)] tabular-nums truncate">{value}</div>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<[string, string]>
  className?: string
}) {
  return (
    <label className={cn("relative", className)}>
      <span className="sr-only">{label}</span>
      <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--dash-ink-faint)]" />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 sm:h-9 w-full sm:w-auto appearance-none rounded-lg border dash-border bg-white pl-8 pr-8 text-[12px] font-semibold text-[var(--dash-ink-soft)] outline-none transition focus:border-[#9D91EA] focus:ring-2 focus:ring-[#6B5CD6]/15"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
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
        className={cn("inline-flex items-center gap-1 rounded-md transition hover:text-[var(--dash-ink)]", active && "text-[var(--dash-ink)]")}
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
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Sort sources"
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

function SourceCard({
  source,
  isActive,
  onSelect,
  onDelete,
  deletePending,
}: {
  source: KnowledgeSource
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
  deletePending: boolean
}) {
  return (
    <div
      role="listitem"
      className={cn("px-3.5 sm:px-4 py-3.5 transition", isActive && "bg-[#F6F4FF]")}
    >
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onSelect}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#ECE9FB] text-[var(--dash-accent-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-accent)]/40"
          aria-label={`Open ${source.title}`}
        >
          {SOURCE_ICON[source.sourceType]}
        </button>
        <div className="min-w-0 flex-1 flex flex-col gap-2">
          <button
            type="button"
            onClick={onSelect}
            className="w-full text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-accent)]/40"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold text-[14px] sm:text-[13.5px] text-[var(--dash-ink)] leading-snug break-words">
                  {source.title}
                </div>
                {source.url && (
                  <div className="mt-0.5 truncate font-mono text-[10.5px] text-[var(--dash-ink-faint)]">
                    {source.url}
                  </div>
                )}
              </div>
              <StatusBadge status={source.embeddingStatus} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--dash-ink-soft)]">
              <span className="capitalize rounded-md bg-[var(--dash-bg)] px-2 py-0.5 text-[11px] font-bold">
                {source.sourceType}
              </span>
              <span className="text-[11px] text-[var(--dash-ink-faint)] tabular-nums ml-auto">
                {formatRelativeTime(source.createdAt)}
              </span>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSelect}
              className="inline-flex items-center justify-center min-h-9 px-3 rounded-lg text-[12px] font-semibold text-[var(--dash-accent)] bg-[var(--dash-accent-wash)] hover:opacity-90 transition"
            >
              Inspect
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={deletePending}
              className="inline-flex items-center justify-center min-h-9 min-w-9 rounded-lg text-[var(--dash-ink-faint)] hover:text-[var(--dash-rose)] hover:bg-[var(--dash-rose-wash)] transition disabled:opacity-50 ml-auto"
              aria-label={`Delete ${source.title}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SourceCardSkeleton() {
  return (
    <div className="px-3.5 sm:px-4 py-3.5 flex gap-3">
      <div className="skeleton h-11 w-11 rounded-lg shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex justify-between gap-2">
          <div className="skeleton h-4 w-40 rounded" />
          <div className="skeleton h-5 w-16 rounded-md" />
        </div>
        <div className="skeleton h-3 w-28 rounded" />
        <div className="skeleton h-8 w-20 rounded-lg" />
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: EmbeddingStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold capitalize shrink-0", STATUS_TONE[status])}>
      {status === "processing" && <Loader2 className="h-3 w-3 animate-spin" />}
      {status === "completed" && <CheckCircle2 className="h-3 w-3" />}
      {status === "failed" && <AlertTriangle className="h-3 w-3" />}
      {status}
    </span>
  )
}

function SourceInspector({
  source,
  detail,
  isLoading,
  onCopy,
  onEdit,
  onView,
  onDelete,
}: {
  source: KnowledgeSource | null
  detail?: KnowledgeDetail
  isLoading: boolean
  onCopy: () => void
  onEdit: () => void
  onView: () => void
  onDelete: () => void
}) {
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
          <div className="text-[15px] 3xl:text-[16px] font-bold text-[var(--dash-ink)] break-words">{source.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--dash-ink-faint)]">
            <span className="capitalize">{source.sourceType}</span>
            <span>·</span>
            <span>{formatRelativeTime(source.createdAt)}</span>
          </div>
        </div>
      </div>

      {source.url && (
        <a href={source.url} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--dash-bg)] px-3 py-2 font-mono text-[10.5px] text-[var(--dash-accent-deep)] transition hover:underline min-w-0">
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
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">Content preview</div>
          {detail?.content && (
            <button type="button" onClick={onView} className="min-h-8 px-1 text-[11px] font-bold text-[var(--dash-accent-deep)] transition hover:underline">
              View full
            </button>
          )}
        </div>
        {isLoading ? (
          <div className="skeleton h-32 sm:h-40 rounded-lg" />
        ) : (
          <button
            type="button"
            onClick={onView}
            disabled={!detail?.content}
            className="block w-full text-left disabled:cursor-not-allowed"
          >
            <pre className="max-h-[min(40dvh,300px)] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--dash-bg)] p-3 font-mono text-[11.5px] leading-5 text-[var(--dash-ink-soft)] transition hover:ring-2 hover:ring-[#6B5CD6]/15 disabled:opacity-50">
              {detail?.content || "No content available."}
            </pre>
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onEdit}
          disabled={!detail?.content || isLoading}
          className="inline-flex min-h-10 h-10 sm:h-9 items-center justify-center gap-1.5 rounded-lg border dash-border bg-white text-[12.5px] font-semibold text-[var(--dash-ink-soft)] transition hover:text-[var(--dash-ink)] hover:dash-shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Pencil className="h-4 w-4" />
          Edit
        </button>
        <button
          type="button"
          onClick={onCopy}
          disabled={!detail?.content}
          className="inline-flex min-h-10 h-10 sm:h-9 items-center justify-center gap-1.5 rounded-lg border dash-border bg-white text-[12.5px] font-semibold text-[var(--dash-ink-soft)] transition hover:text-[var(--dash-ink)] hover:dash-shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Clipboard className="h-4 w-4" />
          Copy
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="col-span-2 inline-flex min-h-10 h-10 sm:h-9 items-center justify-center gap-1.5 rounded-lg border dash-border bg-white text-[12.5px] font-semibold text-[var(--dash-rose)] transition hover:dash-shadow-sm"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>
    </DashCard>
  )
}

function MiniMetric({ label, value, tone }: { label: string; value: ReactNode; tone?: "sage" | "rose" }) {
  return (
    <div className="rounded-xl border dash-border-soft bg-white p-2.5 sm:p-3 min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">{label}</div>
      <div className={cn("mt-1 truncate text-[14px] sm:text-[14px] font-bold text-[var(--dash-ink)]", tone === "sage" && "text-[var(--dash-sage)]", tone === "rose" && "text-[var(--dash-rose)]")}>{value}</div>
    </div>
  )
}

function ReadinessRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-[var(--dash-bg)] px-3 py-2 min-w-0">
      {ok ? <CheckCircle2 className="h-4 w-4 text-[var(--dash-sage)] shrink-0" /> : <AlertTriangle className="h-4 w-4 text-[var(--dash-amber)] shrink-0" />}
      <span className="text-[var(--dash-ink-soft)] min-w-0 truncate">{label}</span>
      <span className="ml-auto font-bold text-[var(--dash-ink)] tabular-nums shrink-0">{value}</span>
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

function SourceFormModal({
  title,
  subtitle,
  draft,
  setDraft,
  submitLabel,
  submitIcon,
  isPending,
  onClose,
  onSubmit,
}: {
  title: string
  subtitle: string
  draft: Draft
  setDraft: React.Dispatch<React.SetStateAction<Draft>>
  submitLabel: string
  submitIcon: ReactNode
  isPending: boolean
  onClose: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-0 sm:p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={onClose}
    >
      <motion.form
        onSubmit={onSubmit}
        onMouseDown={(event) => event.stopPropagation()}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.22 }}
        className="flex max-h-[min(100dvh,100%)] w-full max-w-[720px] 3xl:max-w-[800px] flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border dash-border bg-[var(--dash-card)] shadow-[0_30px_90px_-45px_rgba(23,26,23,0.55)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-start sm:items-center gap-3 border-b dash-border-soft px-4 sm:px-5 py-4 sticky top-0 bg-[var(--dash-card)] z-10 shrink-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ECE9FB] text-[var(--dash-accent)]">
            <BookOpen className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold text-[var(--dash-ink)]">{title}</div>
            <div className="text-[12px] text-[var(--dash-ink-faint)] leading-snug">{subtitle}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-9 min-w-9 h-9 w-9 items-center justify-center rounded-md text-[var(--dash-ink-faint)] transition hover:bg-[var(--dash-bg)] hover:text-[var(--dash-ink)] shrink-0"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3 p-4 sm:p-5 overflow-y-auto min-h-0 flex-1">
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
              className="min-h-[min(40dvh,220px)] w-full resize-y rounded-lg border dash-border bg-white px-3 py-2.5 text-[13px] leading-5 text-[var(--dash-ink)] outline-none transition placeholder:text-[var(--dash-ink-faint)] focus:border-[#9D91EA] focus:ring-2 focus:ring-[#6B5CD6]/15"
            />
          </Field>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t dash-border-soft px-4 sm:px-5 py-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 sm:min-h-9 h-11 sm:h-9 rounded-lg border dash-border bg-white px-3.5 text-[13px] font-semibold text-[var(--dash-ink-soft)] transition hover:text-[var(--dash-ink)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex min-h-11 sm:min-h-9 h-11 sm:h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] px-4 text-[13px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : submitIcon}
            {submitLabel}
          </button>
        </div>
      </motion.form>
    </motion.div>
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
