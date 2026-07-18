"use client"

import { type ReactNode, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Copy,
  GitBranch,
  Info,
  LayoutGrid,
  Loader2,
  Lock,
  Pause,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Workflow,
  X,
  FileCode,
} from "lucide-react"
import { DashCard, DashPageHeader } from "@/components/dashboard/page-header"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { api } from "@/lib/api/trpc-client"
import { useBillingRestriction } from "@/hooks/use-billing-restriction"
import { formatRelativeTime } from "@/lib/dashboard/format"
import { ADVAN_COPILOT_PIPELINE } from "@/lib/pipeline/presets"
import { EMPTY_PIPELINE, type Pipeline } from "@/lib/pipeline/schema"
import { type WorkflowAnalysis } from "@/lib/workflows/analyzer"
import { cn } from "@/lib/utils"

type WorkflowRow = {
  id: string
  orgId: string
  name: string
  description: string | null
  definition: Pipeline
  isActive: boolean
  version: number
  updatedAt: string | Date
  analysis: WorkflowAnalysis
}

type CreateDraft = {
  name: string
  description: string
  template: "copilot" | "blank"
  active: boolean
}

const FIELD_CLASS =
  "h-10 w-full rounded-lg border dash-border bg-white px-3 text-[13px] text-[var(--dash-ink)] outline-none transition placeholder:text-[var(--dash-ink-faint)] focus:border-[#9D91EA] focus:ring-2 focus:ring-[#6B5CD6]/15"

export default function WorkflowsPage() {
  const utils = api.useUtils()
  const { isRestricted: isBillingRestricted } = useBillingRestriction()

  const [activeTab, setActiveTab] = useState<"workflows" | "history">("workflows")
  const [search, setSearch] = useState("")
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<WorkflowRow | null>(null)
  const [runInput, setRunInput] = useState("Test run from workflows dashboard")
  const [draft, setDraft] = useState<CreateDraft>({
    name: "Customer support copilot",
    description: "Source-cited response flow with retrieval, approval, CRM update, and escalation.",
    template: "copilot",
    active: false,
  })

  const workflowsQuery = api.orchestration.getWorkflows.useQuery(undefined, {
    staleTime: 20_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })

  const runsQuery = api.orchestration.getPipelineRuns.useQuery(undefined, {
    staleTime: 5_000,
    refetchInterval: 10_000,
    enabled: activeTab === "history",
  })

  const runs = runsQuery.data ?? []

  const runDetailsQuery = api.orchestration.getPipelineRunDetails.useQuery(
    { runId: selectedRunId ?? "" },
    {
      enabled: !!selectedRunId && activeTab === "history",
      refetchInterval: (query) => (query.state.data?.run.status === "running" ? 3000 : false),
    }
  )

  const workflows = useMemo(() => ((workflowsQuery.data ?? []) as WorkflowRow[]), [workflowsQuery.data])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return workflows
    return workflows.filter((workflow) => {
      const haystack = [
        workflow.name,
        workflow.description,
        workflow.isActive ? "active" : "draft",
        ...workflow.analysis.issues.map((issue) => `${issue.code} ${issue.message}`),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [workflows, search])

  const selected = filtered.find((workflow) => workflow.id === activeId) ?? filtered[0] ?? null

  const stats = useMemo(() => {
    const active = workflows.filter((workflow) => workflow.isActive).length
    const deployable = workflows.filter((workflow) => workflow.analysis.deployable).length
    const invalid = workflows.filter((workflow) => workflow.analysis.errors > 0).length
    const warnings = workflows.reduce((sum, workflow) => sum + workflow.analysis.warnings, 0)
    const nodes = workflows.reduce((sum, workflow) => sum + workflow.analysis.nodeCount, 0)
    return { active, deployable, invalid, warnings, nodes, total: workflows.length }
  }, [workflows])

  useEffect(() => {
    if (!filtered.some((workflow) => workflow.id === activeId)) {
      setActiveId(filtered[0]?.id ?? null)
    }
  }, [filtered, activeId])

  useEffect(() => {
    if (activeTab === "history" && runs.length > 0 && !selectedRunId) {
      setSelectedRunId(runs[0].id)
    }
  }, [activeTab, runs, selectedRunId])

  const saveWorkflow = api.orchestration.saveWorkflow.useMutation({
    onSuccess: async (workflow) => {
      toast.success("Workflow created")
      setCreateOpen(false)
      setActiveId(workflow.id)
      setDraft({
        name: "Customer support copilot",
        description: "Source-cited response flow with retrieval, approval, CRM update, and escalation.",
        template: "copilot",
        active: false,
      })
      await utils.orchestration.getWorkflows.invalidate()
    },
    onError: (error) => toast.error(error.message || "Could not save workflow"),
  })

  const setActive = api.orchestration.setWorkflowActive.useMutation({
    onSuccess: async (_row, vars) => {
      toast.success(vars.isActive ? "Workflow activated" : "Workflow paused")
      await utils.orchestration.getWorkflows.invalidate()
    },
    onError: (error) => toast.error(error.message || "Could not update workflow"),
  })

  const duplicateWorkflow = api.orchestration.duplicateWorkflow.useMutation({
    onSuccess: async (workflow) => {
      toast.success("Workflow duplicated")
      setActiveId(workflow.id)
      await utils.orchestration.getWorkflows.invalidate()
    },
    onError: (error) => toast.error(error.message || "Could not duplicate workflow"),
  })

  const deleteWorkflow = api.orchestration.deleteWorkflow.useMutation({
    onSuccess: async () => {
      toast.success("Workflow deleted")
      setDeleteTarget(null)
      await utils.orchestration.getWorkflows.invalidate()
    },
    onError: (error) => toast.error(error.message || "Could not delete workflow"),
  })

  const preflightWorkflow = api.orchestration.preflightPipeline.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Preflight passed: ${result.planSummary.nodeCount} nodes across ${result.planSummary.waveCount} waves`,
      )
    },
    onError: (error) => toast.error(error.message || "Workflow preflight failed"),
  })

  async function refresh() {
    await utils.orchestration.getWorkflows.invalidate()
    toast.success("Workflows refreshed")
  }

  function createWorkflow(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const definition = draft.template === "copilot" ? ADVAN_COPILOT_PIPELINE : EMPTY_PIPELINE
    saveWorkflow.mutate({
      name: draft.name.trim() || "Untitled workflow",
      description: draft.description.trim() || undefined,
      definition,
      isActive: draft.active,
    })
  }

  async function copyDefinition(workflow: WorkflowRow | null) {
    if (!workflow) return
    await navigator.clipboard.writeText(JSON.stringify(workflow.definition, null, 2))
    toast.success("Workflow definition copied")
  }

  return (
    <div>
      <DashPageHeader
        eyebrow="Automation"
        title="Workflows"
        subtitle="Deploy, validate, duplicate, test, and monitor support automation flows before they reach live customers."
        actions={
          <>
            <button
              type="button"
              onClick={refresh}
              disabled={workflowsQuery.isFetching}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border dash-border bg-[var(--dash-card)] px-3.5 text-[13px] font-semibold text-[var(--dash-ink-soft)] transition hover:dash-shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={cn("h-4 w-4", workflowsQuery.isFetching && "animate-spin")} />
              Refresh
            </button>
            <Link href="/dashboard/orchestration" className="inline-flex h-9 items-center gap-1.5 rounded-lg border dash-border bg-[var(--dash-card)] px-3.5 text-[13px] font-semibold text-[var(--dash-ink-soft)] transition hover:dash-shadow-sm">
              <GitBranch className="h-4 w-4" />
              Open builder
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
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] px-4 text-[13px] font-semibold text-white shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] transition hover:-translate-y-px disabled:from-gray-400 disabled:to-gray-500 disabled:shadow-none disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isBillingRestricted ? <Lock className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              New workflow
            </button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard label="Workflows" value={workflowsQuery.isLoading ? "—" : stats.total} icon={<Workflow className="h-4 w-4" />} />
        <StatCard label="Active" value={workflowsQuery.isLoading ? "—" : stats.active} icon={<PlayCircle className="h-4 w-4" />} tone="sage" />
        <StatCard label="Deployable" value={workflowsQuery.isLoading ? "—" : stats.deployable} icon={<ShieldCheck className="h-4 w-4" />} tone="accent" />
        <StatCard label="Invalid" value={workflowsQuery.isLoading ? "—" : stats.invalid} icon={<AlertTriangle className="h-4 w-4" />} tone={stats.invalid ? "rose" : "sage"} />
        <StatCard label="Warnings" value={workflowsQuery.isLoading ? "—" : stats.warnings} icon={<AlertTriangle className="h-4 w-4" />} tone={stats.warnings ? "amber" : "sage"} />
        <StatCard label="Nodes" value={workflowsQuery.isLoading ? "—" : stats.nodes} icon={<LayoutGrid className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <DashCard
          title={
            <div className="flex items-center gap-1.5 -ml-1">
              <button
                type="button"
                onClick={() => setActiveTab("workflows")}
                className={cn(
                  "px-3 py-1.5 text-[13.5px] font-bold rounded-lg transition",
                  activeTab === "workflows"
                    ? "bg-[#ECE9FB] text-[var(--dash-accent-deep)]"
                    : "text-[var(--dash-ink-soft)] hover:text-[var(--dash-ink)]"
                )}
              >
                Workflow registry
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={cn(
                  "px-3 py-1.5 text-[13.5px] font-bold rounded-lg transition",
                  activeTab === "history"
                    ? "bg-[#ECE9FB] text-[var(--dash-accent-deep)]"
                    : "text-[var(--dash-ink-soft)] hover:text-[var(--dash-ink)]"
                )}
              >
                Execution logs
              </button>
            </div>
          }
          icon={<LayoutGrid className="h-[18px] w-[18px]" />}
          right={
            activeTab === "workflows" ? (
              <label className="relative block w-[260px] max-w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--dash-ink-faint)]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search workflows, issues..."
                  className="h-9 w-full rounded-lg border dash-border bg-white pl-8 pr-3 text-[12px] text-[var(--dash-ink)] outline-none transition placeholder:text-[var(--dash-ink-faint)] focus:border-[#9D91EA] focus:ring-2 focus:ring-[#6B5CD6]/15"
                />
              </label>
            ) : (
              <button
                type="button"
                onClick={() => runsQuery.refetch()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border dash-border bg-white px-3 text-[12px] font-semibold text-[var(--dash-ink-soft)] transition hover:text-[var(--dash-ink)] hover:dash-shadow-sm"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", runsQuery.isFetching && "animate-spin")} />
                Refresh logs
              </button>
            )
          }
          padded={false}
        >
          {activeTab === "workflows" ? (
            <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-2">
              {workflowsQuery.isLoading ? (
                Array.from({ length: 6 }).map((_, index) => <div key={index} className="skeleton h-[178px] rounded-xl" />)
              ) : workflowsQuery.isError ? (
                <div className="lg:col-span-2">
                  <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="Could not load workflows" body={workflowsQuery.error.message} />
                </div>
              ) : filtered.length === 0 ? (
                <div className="lg:col-span-2">
                  <EmptyState
                    icon={<Workflow className="h-5 w-5" />}
                    title="No workflows found"
                    body={search ? "Adjust the search to see more workflows." : "Create a workflow from a production-ready template or start blank."}
                    action={<button type="button" onClick={() => setCreateOpen(true)} className="font-bold text-[var(--dash-accent-deep)] hover:underline">Create workflow</button>}
                  />
                </div>
              ) : (
                filtered.map((workflow) => (
                  <WorkflowCard
                    key={workflow.id}
                    workflow={workflow}
                    active={selected?.id === workflow.id}
                    onSelect={() => setActiveId(workflow.id)}
                    onToggle={() => setActive.mutate({ id: workflow.id, isActive: !workflow.isActive })}
                    onDuplicate={() => duplicateWorkflow.mutate({ id: workflow.id })}
                    onDelete={() => setDeleteTarget(workflow)}
                    pending={setActive.isPending || duplicateWorkflow.isPending || deleteWorkflow.isPending}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="flex flex-col p-4 gap-3">
              {runsQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, index) => <div key={index} className="skeleton h-[72px] rounded-xl" />)
              ) : runsQuery.isError ? (
                <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="Could not load runs" body={runsQuery.error.message} />
              ) : runs.length === 0 ? (
                <EmptyState
                  icon={<Clock className="h-5 w-5" />}
                  title="No execution runs found"
                  body="Run a workflow using Temporal, and durable execution trace details will show up here."
                />
              ) : (
                runs.map((run) => (
                  <RunHistoryCard
                    key={run.id}
                    run={run as any}
                    active={selectedRunId === run.id}
                    onSelect={() => setSelectedRunId(run.id)}
                  />
                ))
              )}
            </div>
          )}
        </DashCard>

        <div className="flex flex-col gap-4">
          {activeTab === "workflows" ? (
            <WorkflowInspector
              workflow={selected}
              runInput={runInput}
              setRunInput={setRunInput}
              onPreflight={() => selected && preflightWorkflow.mutate({ workflowId: selected.id, definition: selected.definition, input: runInput.trim() || "Test preflight run" })}
              preflightPending={preflightWorkflow.isPending}
              onCopy={() => copyDefinition(selected)}
              onToggle={() => selected && setActive.mutate({ id: selected.id, isActive: !selected.isActive })}
              onDuplicate={() => selected && duplicateWorkflow.mutate({ id: selected.id })}
              onDelete={() => selected && setDeleteTarget(selected)}
            />
          ) : (
            <RunDetailsInspector
              runId={selectedRunId}
              detailsQuery={runDetailsQuery}
            />
          )}
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
              onSubmit={createWorkflow}
              onMouseDown={(event) => event.stopPropagation()}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.22 }}
              className="w-full max-w-[620px] overflow-hidden rounded-2xl border dash-border bg-[var(--dash-card)] shadow-[0_30px_90px_-45px_rgba(23,26,23,0.55)]"
            >
              <div className="flex items-center gap-3 border-b dash-border-soft px-5 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ECE9FB] text-[var(--dash-accent)]">
                  <Workflow className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-bold text-[var(--dash-ink)]">New workflow</div>
                  <div className="text-[12px] text-[var(--dash-ink-faint)]">Start from Advan Copilot or create an empty draft for the builder.</div>
                </div>
                <button type="button" onClick={() => setCreateOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--dash-ink-faint)] transition hover:bg-[var(--dash-bg)] hover:text-[var(--dash-ink)]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 p-5">
                <Field label="Name" required>
                  <input value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} autoFocus className={FIELD_CLASS} />
                </Field>
                <Field label="Description">
                  <textarea value={draft.description} onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} className="min-h-[88px] w-full rounded-lg border dash-border bg-white px-3 py-2.5 text-[13px] leading-5 text-[var(--dash-ink)] outline-none transition placeholder:text-[var(--dash-ink-faint)] focus:border-[#9D91EA] focus:ring-2 focus:ring-[#6B5CD6]/15" />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TemplateButton active={draft.template === "copilot"} icon={<Bot className="h-4 w-4" />} title="Advan Copilot" body="Trigger, intent, KB retrieval, compose, approval, CRM, escalation." onClick={() => setDraft((value) => ({ ...value, template: "copilot" }))} />
                  <TemplateButton active={draft.template === "blank"} icon={<LayoutGrid className="h-4 w-4" />} title="Blank draft" body="Start empty and assemble nodes in the orchestration builder." onClick={() => setDraft((value) => ({ ...value, template: "blank", active: false }))} />
                </div>
                <label className="flex items-center gap-2 rounded-lg bg-[var(--dash-bg)] px-3 py-2 text-[12.5px] font-semibold text-[var(--dash-ink-soft)]">
                  <input
                    type="checkbox"
                    checked={draft.active}
                    disabled={draft.template === "blank"}
                    onChange={(event) => setDraft((value) => ({ ...value, active: event.target.checked }))}
                  />
                  Activate after create
                  {draft.template === "blank" && <span className="ml-auto text-[11px] text-[var(--dash-ink-faint)]">Blank workflows must be built first</span>}
                </label>
              </div>
              <div className="flex justify-end gap-2 border-t dash-border-soft px-5 py-4">
                <button type="button" onClick={() => setCreateOpen(false)} className="h-9 rounded-lg border dash-border bg-white px-3.5 text-[13px] font-semibold text-[var(--dash-ink-soft)] transition hover:text-[var(--dash-ink)]">Cancel</button>
                <button type="submit" disabled={saveWorkflow.isPending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] px-4 text-[13px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60">
                  {saveWorkflow.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <ConfirmDelete
            workflow={deleteTarget}
            pending={deleteWorkflow.isPending}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={() => deleteWorkflow.mutate({ id: deleteTarget.id })}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

type Tone = "default" | "sage" | "amber" | "rose" | "accent"

function StatCard({ label, value, icon, tone = "default" }: { label: string; value: ReactNode; icon: ReactNode; tone?: Tone }) {
  return (
    <div className="dash-card p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">{label}</div>
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", toneClass(tone))}>{icon}</span>
      </div>
      <div className="mt-1 text-[22px] font-bold tracking-tight text-[var(--dash-ink)]">{value}</div>
    </div>
  )
}

function toneClass(tone: Tone) {
  return {
    default: "bg-[var(--dash-bg)] text-[var(--dash-ink-faint)]",
    sage: "bg-[var(--dash-sage-wash)] text-[var(--dash-sage)]",
    amber: "bg-[var(--dash-amber-wash)] text-[var(--dash-amber)]",
    rose: "bg-[var(--dash-rose-wash)] text-[var(--dash-rose)]",
    accent: "bg-[#ECE9FB] text-[var(--dash-accent)]",
  }[tone]
}

function WorkflowCard({ workflow, active, onSelect, onToggle, onDuplicate, onDelete, pending }: { workflow: WorkflowRow; active: boolean; onSelect: () => void; onToggle: () => void; onDuplicate: () => void; onDelete: () => void; pending: boolean }) {
  const tone: Tone = workflow.analysis.errors ? "rose" : workflow.analysis.warnings ? "amber" : workflow.analysis.deployable ? "sage" : "default"
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelect()
        }
      }}
      className={cn("rounded-xl border bg-white p-4 text-left transition hover:dash-shadow-sm", active ? "border-[#9D91EA] bg-[#F6F4FF]" : "dash-border-soft")}
    >
      <div className="flex items-start gap-2.5">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", toneClass(tone))}>
          <GitBranch className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold text-[var(--dash-ink)]">{workflow.name}</div>
          <div className="mt-0.5 line-clamp-2 text-[11.5px] leading-4 text-[var(--dash-ink-faint)]">{workflow.description || "No description yet."}</div>
        </div>
        <StatusPill workflow={workflow} />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        <TinyFact label="Nodes" value={workflow.analysis.nodeCount} />
        <TinyFact label="Edges" value={workflow.analysis.edgeCount} />
        <TinyFact label="Waves" value={workflow.analysis.waveCount} />
        <TinyFact label="v" value={workflow.version} />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={(event) => { event.stopPropagation(); onToggle() }} disabled={pending || (!workflow.isActive && !workflow.analysis.deployable)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border dash-border bg-[var(--dash-card)] px-3 text-[12px] font-semibold text-[var(--dash-ink-soft)] transition hover:dash-shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
          {workflow.isActive ? <Pause className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}
          {workflow.isActive ? "Pause" : "Activate"}
        </button>
        <button type="button" onClick={(event) => { event.stopPropagation(); onDuplicate() }} disabled={pending} className="flex h-8 w-8 items-center justify-center rounded-lg border dash-border bg-white text-[var(--dash-ink-faint)] transition hover:text-[var(--dash-accent)] disabled:opacity-50" aria-label={`Duplicate ${workflow.name}`}>
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={(event) => { event.stopPropagation(); onDelete() }} disabled={pending} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg border dash-border bg-white text-[var(--dash-ink-faint)] transition hover:text-[var(--dash-rose)] disabled:opacity-50" aria-label={`Delete ${workflow.name}`}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

function StatusPill({ workflow }: { workflow: WorkflowRow }) {
  if (workflow.analysis.errors) {
    return <span className="rounded-md bg-[var(--dash-rose-wash)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--dash-rose)]">Invalid</span>
  }
  if (workflow.isActive) {
    return <span className="rounded-md bg-[var(--dash-sage-wash)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--dash-sage)]">Active</span>
  }
  if (workflow.analysis.deployable) {
    return <span className="rounded-md bg-[#ECE9FB] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--dash-accent-deep)]">Ready</span>
  }
  return <span className="rounded-md bg-[var(--dash-amber-wash)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--dash-amber)]">Draft</span>
}

function WorkflowInspector({
  workflow,
  runInput,
  setRunInput,
  onPreflight,
  preflightPending,
  onCopy,
  onToggle,
  onDuplicate,
  onDelete,
}: {
  workflow: WorkflowRow | null
  runInput: string
  setRunInput: (value: string) => void
  onPreflight: () => void
  preflightPending: boolean
  onCopy: () => void
  onToggle: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  if (!workflow) {
    return (
      <DashCard title="Workflow inspector" icon={<Workflow className="h-[18px] w-[18px]" />}>
        <EmptyState icon={<Workflow className="h-5 w-5" />} title="No workflow selected" body="Select a workflow to inspect readiness, issues, and execution controls." />
      </DashCard>
    )
  }

  const issues = workflow.analysis.issues
  return (
    <>
      <DashCard title="Workflow inspector" icon={<Workflow className="h-[18px] w-[18px]" />} right={<StatusPill workflow={workflow} />}>
        <div className="text-[15px] font-bold text-[var(--dash-ink)]">{workflow.name}</div>
        <p className="mt-1 text-[12.5px] leading-5 text-[var(--dash-ink-soft)]">{workflow.description || "No description yet."}</p>
        <div className="mt-3 text-[11px] text-[var(--dash-ink-faint)]">Updated {formatRelativeTime(workflow.updatedAt)} · version {workflow.version}</div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <MiniMetric label="Nodes" value={workflow.analysis.nodeCount} />
          <MiniMetric label="Edges" value={workflow.analysis.edgeCount} />
          <MiniMetric label="Parallelism" value={workflow.analysis.maxParallelism} />
          <MiniMetric label="Human gates" value={workflow.analysis.humanGateCount} />
        </div>

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onToggle} disabled={!workflow.isActive && !workflow.analysis.deployable} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border dash-border bg-white text-[12.5px] font-semibold text-[var(--dash-ink-soft)] transition hover:text-[var(--dash-ink)] hover:dash-shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
            {workflow.isActive ? <Pause className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
            {workflow.isActive ? "Pause" : "Activate"}
          </button>
          <Link href="/dashboard/orchestration" className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border dash-border bg-white text-[12.5px] font-semibold text-[var(--dash-accent-deep)] transition hover:dash-shadow-sm">
            <GitBranch className="h-4 w-4" />
            Builder
          </Link>
        </div>
      </DashCard>

      <DashCard title="Readiness checks" icon={<ShieldCheck className="h-[18px] w-[18px]" />}>
        <div className="space-y-2">
          <ReadinessRow ok={workflow.analysis.deployable} label="Deployable" value={workflow.analysis.deployable ? "Ready" : "Blocked"} />
          <ReadinessRow ok={workflow.analysis.triggerCount > 0} label="Trigger" value={`${workflow.analysis.triggerCount} configured`} />
          <ReadinessRow ok={workflow.analysis.errors === 0} label="Errors" value={String(workflow.analysis.errors)} />
          <ReadinessRow ok={workflow.analysis.warnings === 0} label="Warnings" value={String(workflow.analysis.warnings)} />
        </div>
        <div className="mt-3 max-h-[220px] space-y-2 overflow-auto">
          {issues.length === 0 ? (
            <div className="rounded-lg border border-[#CBE0CF] bg-[var(--dash-sage-wash)] px-3 py-2 text-[12px] font-semibold text-[var(--dash-sage)]">No issues detected.</div>
          ) : (
            issues.map((issue, index) => <IssueRow key={`${issue.code}-${index}`} issue={issue} />)
          )}
        </div>
      </DashCard>

      <DashCard title="Run and actions" icon={<PlayCircle className="h-[18px] w-[18px]" />}>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">Test input</span>
          <textarea value={runInput} onChange={(event) => setRunInput(event.target.value)} className="min-h-[92px] w-full rounded-lg border dash-border bg-white px-3 py-2.5 text-[12.5px] leading-5 text-[var(--dash-ink)] outline-none focus:border-[#9D91EA] focus:ring-2 focus:ring-[#6B5CD6]/15" />
        </label>
        <button type="button" onClick={onPreflight} disabled={preflightPending || workflow.analysis.errors > 0 || workflow.analysis.nodeCount === 0} className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] px-4 text-[13px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60">
          {preflightPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          Run preflight
        </button>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Link href="/dashboard/orchestration" className="inline-flex h-8 items-center gap-1.5 rounded-lg border dash-border bg-white px-3 text-[12px] font-semibold text-[var(--dash-accent-deep)] transition hover:dash-shadow-sm">
            <GitBranch className="h-3.5 w-3.5" />
            Open builder
          </Link>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Durable run requirements"
                className="flex h-8 w-8 items-center justify-center rounded-lg border dash-border bg-white text-[var(--dash-ink-faint)] transition hover:text-[var(--dash-ink)]"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" align="end" className="max-w-[260px] leading-5">
              Durable runs require the Temporal worker. Start services with npm run dev:all, then launch from the builder.
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <ActionButton icon={<Clipboard className="h-3.5 w-3.5" />} label="Copy" onClick={onCopy} />
          <ActionButton icon={<Copy className="h-3.5 w-3.5" />} label="Duplicate" onClick={onDuplicate} />
          <ActionButton icon={<Trash2 className="h-3.5 w-3.5" />} label="Delete" onClick={onDelete} danger />
        </div>
      </DashCard>
    </>
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

function MiniMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border dash-border-soft bg-white p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">{label}</div>
      <div className="mt-1 truncate text-[15px] font-bold text-[var(--dash-ink)]">{value}</div>
    </div>
  )
}

function ReadinessRow({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-[var(--dash-bg)] px-3 py-2 text-[12.5px]">
      {ok ? <CheckCircle2 className="h-4 w-4 text-[var(--dash-sage)]" /> : <AlertTriangle className="h-4 w-4 text-[var(--dash-amber)]" />}
      <span className="text-[var(--dash-ink-soft)]">{label}</span>
      <span className="ml-auto font-bold text-[var(--dash-ink)]">{value}</span>
    </div>
  )
}

function IssueRow({ issue }: { issue: WorkflowAnalysis["issues"][number] }) {
  const error = issue.severity === "error"
  return (
    <div className={cn("rounded-lg border px-3 py-2", error ? "border-[#F0CBCB] bg-[var(--dash-rose-wash)]" : "border-[#E7C988] bg-[var(--dash-amber-wash)]")}>
      <div className={cn("text-[11.5px] font-bold", error ? "text-[var(--dash-rose)]" : "text-[var(--dash-amber)]")}>{issue.code}</div>
      <div className="mt-0.5 text-[11.5px] leading-5 text-[var(--dash-ink-soft)]">{issue.message}</div>
    </div>
  )
}

function ActionButton({ icon, label, onClick, danger }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex h-8 items-center justify-center gap-1 rounded-lg border dash-border bg-white text-[11.5px] font-bold transition hover:dash-shadow-sm", danger ? "text-[var(--dash-rose)]" : "text-[var(--dash-ink-soft)] hover:text-[var(--dash-ink)]")}>
      {icon}
      {label}
    </button>
  )
}

function TemplateButton({ active, icon, title, body, onClick }: { active: boolean; icon: ReactNode; title: string; body: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("rounded-xl border p-3 text-left transition", active ? "border-[#9D91EA] bg-[#F6F4FF]" : "dash-border-soft bg-white hover:dash-shadow-sm")}>
      <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--dash-ink)]">{icon}{title}</div>
      <div className="mt-1 text-[11.5px] leading-5 text-[var(--dash-ink-soft)]">{body}</div>
    </button>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">{label}{required ? " *" : ""}</span>
      {children}
    </label>
  )
}

function ConfirmDelete({ workflow, pending, onCancel, onConfirm }: { workflow: WorkflowRow; pending: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onCancel}>
      <motion.div onMouseDown={(event) => event.stopPropagation()} initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} className="w-full max-w-[420px] rounded-2xl border dash-border bg-[var(--dash-card)] p-5 shadow-[0_30px_90px_-45px_rgba(23,26,23,0.55)]">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--dash-rose-wash)] text-[var(--dash-rose)]"><Trash2 className="h-5 w-5" /></div>
          <div>
            <div className="text-[15px] font-bold text-[var(--dash-ink)]">Delete workflow?</div>
            <p className="mt-1 text-[12.5px] leading-5 text-[var(--dash-ink-soft)]">This removes "{workflow.name}" from the workflow registry. Existing historical runs remain in audit data.</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-9 rounded-lg border dash-border bg-white px-3.5 text-[13px] font-semibold text-[var(--dash-ink-soft)] transition hover:text-[var(--dash-ink)]">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--dash-rose)] px-4 text-[13px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-[150px] flex-col items-center justify-center rounded-xl border dash-border-soft bg-white px-5 py-7 text-center">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--dash-bg)] text-[var(--dash-ink-faint)]">{icon}</div>
      <div className="text-[13px] font-bold text-[var(--dash-ink)]">{title}</div>
      <p className="mt-1 max-w-sm text-[12px] leading-5 text-[var(--dash-ink-soft)]">{body}</p>
      {action && <div className="mt-3 text-[12.5px]">{action}</div>}
    </div>
  )
}

type PipelineRunRow = {
  id: string
  workflowId: string | null
  temporalWorkflowId: string
  temporalRunId: string | null
  status: "running" | "completed" | "failed" | "cancelled"
  startedAt: string | Date
  finishedAt: string | Date | null
  workflowName: string | null
}

type PipelineRunStepRow = {
  id: string
  runId: string
  nodeId: string
  nodeType: string
  status: "pending" | "running" | "completed" | "failed" | "skipped"
  output: any
  error: string | null
  latencyMs: number | null
  createdAt: string | Date
}

function RunHistoryCard({
  run,
  active,
  onSelect,
}: {
  run: PipelineRunRow
  active: boolean
  onSelect: () => void
}) {
  const statusColor = {
    running: "text-amber-500 bg-amber-50 border-amber-200",
    completed: "text-emerald-500 bg-emerald-50 border-emerald-200",
    failed: "text-rose-500 bg-rose-50 border-rose-200",
    cancelled: "text-gray-500 bg-gray-50 border-gray-200",
  }[run.status]

  const statusIcon = {
    running: <Loader2 className="h-4 w-4 animate-spin text-amber-500" />,
    completed: <CheckCircle className="h-4 w-4 text-emerald-500" />,
    failed: <XCircle className="h-4 w-4 text-rose-500" />,
    cancelled: <Pause className="h-4 w-4 text-gray-500" />,
  }[run.status]

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3.5 text-left transition hover:dash-shadow-sm cursor-pointer",
        active ? "border-[#9D91EA] bg-[#F6F4FF]" : "border-gray-100 bg-white"
      )}
    >
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", statusColor)}>
        {statusIcon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-bold text-[var(--dash-ink)]">
            {run.workflowName ?? "Advan Conversation Flow"}
          </span>
          <span className="text-[10.5px] text-[var(--dash-ink-faint)] shrink-0 font-mono">
            #{run.id.slice(0, 8)}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--dash-ink-soft)]">
          <span>Started {formatRelativeTime(run.startedAt)}</span>
          {run.finishedAt && (
            <>
              <span>•</span>
              <span>Finished {formatRelativeTime(run.finishedAt)}</span>
            </>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <span className={cn(
          "rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border",
          run.status === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
          run.status === "running" ? "bg-amber-50 text-amber-700 border-amber-100 animate-pulse" :
          run.status === "failed" ? "bg-rose-50 text-rose-700 border-rose-100" :
          "bg-gray-50 text-gray-700 border-gray-100"
        )}>
          {run.status}
        </span>
      </div>
    </div>
  )
}

function RunDetailsInspector({
  runId,
  detailsQuery,
}: {
  runId: string | null
  detailsQuery: any
}) {
  if (!runId) {
    return (
      <DashCard title="Run details inspector" icon={<Clock className="h-[18px] w-[18px]" />}>
        <EmptyState
          icon={<Clock className="h-5 w-5" />}
          title="No execution run selected"
          body="Select any execution run from the timeline list to audit node step timings, latency, payloads, and error traces."
        />
      </DashCard>
    )
  }

  if (detailsQuery.isLoading) {
    return (
      <DashCard title="Run details inspector" icon={<Clock className="h-[18px] w-[18px]" />}>
        <div className="space-y-4">
          <div className="skeleton h-[110px] rounded-xl" />
          <div className="skeleton h-[280px] rounded-xl" />
        </div>
      </DashCard>
    )
  }

  if (detailsQuery.isError || !detailsQuery.data) {
    return (
      <DashCard title="Run details inspector" icon={<Clock className="h-[18px] w-[18px]" />}>
        <EmptyState
          icon={<AlertTriangle className="h-5 w-5 text-[var(--dash-rose)]" />}
          title="Could not load run details"
          body={detailsQuery.error?.message ?? "Execution logs could not be fetched."}
        />
      </DashCard>
    )
  }

  const { run, steps, workflow } = detailsQuery.data as {
    run: PipelineRunRow
    steps: PipelineRunStepRow[]
    workflow: WorkflowRow | null
  }

  // Calculate total latency
  const completedSteps = steps.filter((s) => s.status === "completed")
  const totalLatencyMs = completedSteps.reduce((sum, s) => sum + (s.latencyMs ?? 0), 0)

  return (
    <>
      <DashCard
        title="Durable execution audit"
        icon={<Clock className="h-[18px] w-[18px]" />}
        right={
          <span className={cn(
            "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase border",
            run.status === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
            run.status === "running" ? "bg-amber-50 text-amber-700 border-amber-100 animate-pulse" :
            run.status === "failed" ? "bg-rose-50 text-rose-700 border-rose-100" :
            "bg-gray-50 text-gray-700 border-gray-100"
          )}>
            {run.status}
          </span>
        }
      >
        <div className="text-[14px] font-bold text-[var(--dash-ink)]">
          {workflow?.name ?? "Advan Conversation Flow"}
        </div>
        {workflow?.description && (
          <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--dash-ink-soft)] line-clamp-2">
            {workflow.description}
          </p>
        )}
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between text-[11.5px]">
            <span className="text-[var(--dash-ink-faint)]">Run ID</span>
            <span className="font-mono text-[var(--dash-ink)] select-all bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 text-[10.5px]">
              {run.id}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11.5px]">
            <span className="text-[var(--dash-ink-faint)]">Temporal ID</span>
            <span className="font-mono text-[var(--dash-ink)] select-all truncate max-w-[200px] bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 text-[10.5px]">
              {run.temporalWorkflowId}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11.5px]">
            <span className="text-[var(--dash-ink-faint)]">Total node duration</span>
            <span className="font-semibold text-[var(--dash-ink)]">
              {totalLatencyMs > 1000 ? `${(totalLatencyMs / 1000).toFixed(2)}s` : `${totalLatencyMs}ms`}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11.5px]">
            <span className="text-[var(--dash-ink-faint)]">Steps executed</span>
            <span className="font-semibold text-[var(--dash-ink)]">
              {steps.filter((s) => s.status === "completed").length} / {steps.length}
            </span>
          </div>
        </div>
        {workflow && (
          <div className="mt-4 flex gap-2">
            <Link
              href="/dashboard/orchestration"
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border dash-border bg-white text-[12.5px] font-semibold text-[var(--dash-accent-deep)] transition hover:dash-shadow-sm"
            >
              <GitBranch className="h-4 w-4" />
              Open in builder
            </Link>
          </div>
        )}
      </DashCard>

      <DashCard title="Execution step timeline" icon={<ShieldCheck className="h-[18px] w-[18px]" />} padded={false}>
        <div className="max-h-[360px] overflow-y-auto p-4 space-y-3">
          {steps.length === 0 ? (
            <div className="text-center py-6 text-[12px] text-[var(--dash-ink-faint)]">
              No step execution records recorded yet.
            </div>
          ) : (
            steps.map((step) => <StepExecutionRow key={step.id} step={step} />)
          )}
        </div>
      </DashCard>
    </>
  )
}

function StepExecutionRow({ step }: { step: PipelineRunStepRow }) {
  const [expanded, setExpanded] = useState(false)

  const statusIcon = {
    pending: <Clock className="h-3.5 w-3.5 text-gray-400" />,
    running: <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />,
    completed: <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />,
    failed: <XCircle className="h-3.5 w-3.5 text-rose-500" />,
    skipped: <X className="h-3.5 w-3.5 text-gray-400" />,
  }[step.status]

  const statusBg = {
    pending: "bg-gray-50 border-gray-100",
    running: "bg-amber-50 border-amber-100",
    completed: "bg-emerald-50 border-emerald-100",
    failed: "bg-rose-50 border-rose-100",
    skipped: "bg-gray-50 border-gray-100",
  }[step.status]

  return (
    <div className="rounded-xl border border-gray-100 bg-white overflow-hidden transition-all duration-150 hover:border-gray-200">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setExpanded(!expanded)
          }
        }}
        className="flex items-center justify-between gap-2.5 p-3 cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border", statusBg)}>
            {statusIcon}
          </div>
          <div className="min-w-0">
            <div className="text-[12.5px] font-bold text-[var(--dash-ink)] truncate">
              {step.nodeId}
            </div>
            <div className="text-[10px] text-[var(--dash-ink-faint)] uppercase tracking-wider font-mono mt-0.5">
              {step.nodeType}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {step.latencyMs !== null && (
            <span className="text-[11px] font-mono text-[var(--dash-ink-soft)] bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
              {step.latencyMs}ms
            </span>
          )}
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-[var(--dash-ink-faint)]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[var(--dash-ink-faint)]" />
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden border-t border-gray-50 bg-gray-50/50"
          >
            <div className="p-3 space-y-2.5 text-[11px]">
              {step.error && (
                <div className="rounded-lg bg-rose-50 border border-rose-100 p-2.5 text-[11.5px] text-rose-800 leading-normal font-mono select-all break-words">
                  <div className="font-bold mb-1 uppercase tracking-wide text-rose-900 text-[10px]">Error execution trace</div>
                  {step.error}
                </div>
              )}

              {step.output && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[var(--dash-ink-faint)] uppercase tracking-wide text-[9.5px]">
                      Node Output Payload
                    </span>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation()
                        await navigator.clipboard.writeText(JSON.stringify(step.output, null, 2))
                        toast.success("Payload copied to clipboard")
                      }}
                      className="text-[var(--dash-accent-deep)] hover:underline font-semibold"
                    >
                      Copy JSON
                    </button>
                  </div>
                  <pre className="max-h-[220px] overflow-auto rounded-lg border border-gray-200 bg-gray-900 p-2.5 font-mono text-[10.5px] leading-relaxed text-emerald-400 select-all">
                    {JSON.stringify(step.output, null, 2)}
                  </pre>
                </div>
              )}

              {!step.output && !step.error && (
                <div className="text-center py-2 text-[11px] text-[var(--dash-ink-faint)] font-medium italic">
                  No execution output recorded or required for this node trigger.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
