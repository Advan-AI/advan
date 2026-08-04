"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { useSearchParams } from "next/navigation"
import { useStore } from "zustand"
import { ReactFlowProvider, useReactFlow } from "@xyflow/react"
import { toast } from "sonner"
import {
  PlayCircle,
  Save,
  CheckCircle2,
  Loader2,
  Undo2,
  Redo2,
  GitBranch,
  Sparkles,
  AlertTriangle,
  Pause,
  Info,
  Lock,
  Boxes,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { api } from "@/lib/api/trpc-client"
import { usePipelineStore } from "@/lib/pipeline/use-pipeline-store"
import { ADVAN_COPILOT_PIPELINE } from "@/lib/pipeline/presets"
import { usePipelineExecution } from "@/lib/pipeline/execution-store"
import { usePipelineRealtime } from "@/lib/pipeline/use-pipeline-realtime"
import { analyzeWorkflowDefinition } from "@/lib/workflows/analyzer"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { PipelineSidebar } from "./sidebar"
import { PipelineCanvas } from "./canvas"
import { PipelineInspector } from "./inspector"
import { PipelineExecutionTrace } from "./execution-trace"

const WORKBENCH_MQ = "(min-width: 1024px)"

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

export function PipelineBuilder() {
  return (
    <ReactFlowProvider>
      <PipelineBuilderInner />
    </ReactFlowProvider>
  )
}

function PipelineBuilderInner() {
  usePipelineRealtime()
  const searchParams = useSearchParams()
  const isWorkbench = useMediaQuery(WORKBENCH_MQ)
  const { screenToFlowPosition } = useReactFlow()

  const [workflowId, setWorkflowId] = useState<string | undefined>(undefined)
  const [name, setName] = useState("webhook-support-v2")
  const [description, setDescription] = useState("")
  const [isActive, setIsActive] = useState(false)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle")
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)

  const runStatus = usePipelineExecution((s) => s.runStatus)

  const dirty = usePipelineStore((s) => s.dirty)
  const connError = usePipelineStore((s) => s.lastConnectionError)
  const loadPipeline = usePipelineStore((s) => s.loadPipeline)
  const markSaved = usePipelineStore((s) => s.markSaved)
  const addNode = usePipelineStore((s) => s.addNode)
  const selectedId = usePipelineStore((s) => s.selectedId)
  const selectedEdgeId = usePipelineStore((s) => s.selectedEdgeId)

  // undo/redo state from the zundo temporal store
  const pastCount = useStore(usePipelineStore.temporal, (s) => s.pastStates.length)
  const futureCount = useStore(usePipelineStore.temporal, (s) => s.futureStates.length)
  const { undo, redo } = usePipelineStore.temporal.getState()

  const workflows = api.orchestration.getWorkflows.useQuery()
  const save = api.orchestration.saveWorkflow.useMutation()
  const { data: billing } = api.auth.getBillingStatus.useQuery()
  const isBillingRestricted = billing?.subscriptionStatus === "past_due" || billing?.subscriptionStatus === "canceled"
  const preflight = api.orchestration.preflightPipeline.useMutation()
  const setWorkflowActive = api.orchestration.setWorkflowActive.useMutation({
    onSuccess: async (row) => {
      setIsActive(row.isActive)
      toast.success(row.isActive ? "Workflow activated" : "Workflow paused")
      await workflows.refetch()
    },
    onError: (err) => toast.error(err.message || "Could not update workflow"),
  })

  const graphNodes = usePipelineStore((s) => s.nodes)
  const graphEdges = usePipelineStore((s) => s.edges)
  const currentDefinition = useMemo(() => ({
    schemaVersion: 1 as const,
    nodes: graphNodes.map((n) => ({
      id: n.id,
      type: n.type ?? "unknown",
      position: n.position,
      data: (n.data ?? {}) as Record<string, unknown>,
    })),
    edges: graphEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
    })),
  }), [graphEdges, graphNodes])
  const analysis = useMemo(() => analyzeWorkflowDefinition(currentDefinition), [currentDefinition])

  function loadWorkflow(row: NonNullable<typeof workflows.data>[number]) {
    if (row.definition && typeof row.definition === "object" && "schemaVersion" in row.definition) {
      setWorkflowId(row.id)
      setName(row.name)
      setDescription(row.description ?? "")
      setIsActive(row.isActive)
      loadPipeline(row.definition as never)
    }
  }

  // Load the first saved workflow, or seed with the Advan Copilot preset.
  const loadedRef = useRef(false)
  useEffect(() => {
    if (loadedRef.current || workflows.isLoading) return
    loadedRef.current = true
    const requestedId = searchParams.get("workflowId")
    const existing = workflows.data?.find((workflow) => workflow.id === requestedId) ?? workflows.data?.[0]
    if (existing) {
      loadWorkflow(existing)
    } else {
      setWorkflowId(undefined)
      setName("webhook-support-v2")
      setDescription("Source-cited support automation draft")
      setIsActive(false)
      loadPipeline(ADVAN_COPILOT_PIPELINE)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflows.isLoading, workflows.data, loadPipeline, searchParams])

  // Debounced autosave on dirty.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!dirty || isBillingRestricted) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void doSave(true), 1500)
    return () => { if (timer.current) clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, isBillingRestricted])

  // On phones, open the inspector sheet when a node/wire is selected.
  useEffect(() => {
    if (!isWorkbench && (selectedId || selectedEdgeId)) setInspectorOpen(true)
  }, [selectedId, selectedEdgeId, isWorkbench])

  useEffect(() => {
    if (isWorkbench) {
      setPaletteOpen(false)
      setInspectorOpen(false)
    }
  }, [isWorkbench])

  async function doSave(isAuto = false) {
    if (isBillingRestricted) {
      toast.error("Actions are locked due to past due invoice. Please update billing under settings.")
      setSaveState("idle")
      return
    }
    setSaveState("saving")
    try {
      const definition = usePipelineStore.getState().toPipeline()
      const requestedActive = isActive
      const safeActive = isActive && analysis.deployable
      const res = await save.mutateAsync({
        id: workflowId,
        name: name.trim() || "Untitled workflow",
        description: description.trim() || undefined,
        definition,
        isActive: safeActive,
      })
      const saved = Array.isArray(res) ? res[0] : res
      if (saved?.id) setWorkflowId(saved.id)
      if (saved?.isActive !== undefined) setIsActive(saved.isActive)
      markSaved()
      setSaveState("saved")
      if (!isAuto) {
        if (requestedActive && !safeActive) {
          toast.info("Pipeline saved as inactive until validation errors are fixed")
        } else {
          toast.success("Pipeline saved")
        }
      }
      setTimeout(() => setSaveState("idle"), 2000)
    } catch (err) {
      setSaveState("idle")
      toast.error(err instanceof Error ? err.message : "Save failed")
    }
  }

  async function doPreflight() {
    try {
      const definition = usePipelineStore.getState().toPipeline()
      const res = await preflight.mutateAsync({ workflowId, definition, input: "Test run from builder" })
      toast.success(`Preflight passed: ${res.planSummary.nodeCount} nodes, ${res.planSummary.waveCount} waves`)

      const { PipelineCompiler } = await import("@/lib/pipeline/compiler")
      const plan = PipelineCompiler.compile(definition)

      const execStore = usePipelineExecution.getState()
      execStore.beginRun("preflight-sim")

      for (const wave of plan.waves) {
        for (const nodeId of wave) {
          const node = plan.nodes[nodeId]
          execStore.applyStep({
            orgId: "preflight",
            temporalWorkflowId: "preflight-sim",
            runId: "sim",
            nodeId: nodeId,
            nodeType: node?.type ?? "unknown",
            status: "running"
          })
        }

        await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 400))

        for (const nodeId of wave) {
          const node = plan.nodes[nodeId]
          execStore.applyStep({
            orgId: "preflight",
            temporalWorkflowId: "preflight-sim",
            runId: "sim",
            nodeId: nodeId,
            nodeType: node?.type ?? "unknown",
            status: "completed",
            latencyMs: Math.floor(Math.random() * 300) + 300
          })
        }

        await new Promise((resolve) => setTimeout(resolve, 300))
      }

      execStore.finishRun("preflight-sim", "completed")

    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preflight failed")
    }
  }

  function startNewDraft() {
    setWorkflowId(undefined)
    setName("New workflow")
    setDescription("")
    setIsActive(false)
    loadPipeline(ADVAN_COPILOT_PIPELINE, { dirty: true })
  }

  function addNodeFromPalette(type: string) {
    const nodes = usePipelineStore.getState().nodes
    let position = { x: 120, y: 140 }
    if (nodes.length > 0) {
      const xs = nodes.map((n) => n.position.x)
      const ys = nodes.map((n) => n.position.y)
      position = {
        x: (Math.min(...xs) + Math.max(...xs)) / 2 + (Math.random() - 0.5) * 80,
        y: Math.max(...ys) + 110,
      }
    } else {
      const center = screenToFlowPosition({
        x: typeof window !== "undefined" ? window.innerWidth / 2 : 400,
        y: typeof window !== "undefined" ? window.innerHeight * 0.42 : 300,
      })
      position = { x: center.x - 84, y: center.y - 32 }
    }
    addNode(type, position)
    setPaletteOpen(false)
  }

  // Toast when the socket reports the run finished.
  const prevRunStatus = useRef(runStatus)
  useEffect(() => {
    if (prevRunStatus.current === "running" && runStatus === "completed") {
      toast.success("Pipeline run completed")
    } else if (prevRunStatus.current === "running" && runStatus === "failed") {
      toast.error("Pipeline run failed")
    }
    prevRunStatus.current = runStatus
  }, [runStatus])

  const hasSelection = Boolean(selectedId || selectedEdgeId)

  return (
    <div className="orchestration-builder dash-card overflow-hidden min-w-0">
      {/* Toolbar */}
      <div className="flex flex-col gap-2.5 border-b dash-border-soft px-3 sm:px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-[14px] font-bold text-[var(--dash-ink)]">
            <GitBranch className="h-[18px] w-[18px] shrink-0 text-[var(--dash-accent)]" />
            <select
              value={workflowId ?? "__draft__"}
              onChange={(event) => {
                if (event.target.value === "__draft__") return startNewDraft()
                const row = workflows.data?.find((workflow) => workflow.id === event.target.value)
                if (row) loadWorkflow(row)
              }}
              className="h-10 sm:h-8 min-w-0 max-w-full sm:max-w-[220px] flex-1 sm:flex-none rounded-lg border dash-border bg-white px-2 text-[12px] font-semibold text-[var(--dash-ink-soft)] outline-none"
              aria-label="Select workflow"
            >
              <option value="__draft__">Unsaved draft</option>
              {(workflows.data ?? []).map((workflow) => (
                <option key={workflow.id} value={workflow.id}>{workflow.name}</option>
              ))}
            </select>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Pipeline name"
              className="min-w-0 w-full sm:w-[200px] rounded-md bg-transparent px-1 py-1.5 sm:py-0.5 outline-none focus:bg-[var(--dash-bg)] text-[13px] sm:text-[14px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto sm:ml-auto">
            <span className="font-mono text-[11px] text-[var(--dash-ink-faint)] truncate max-w-[9rem] sm:max-w-none">
              {runStatus === "running"
                ? "running…"
                : dirty
                ? "unsaved"
                : saveState === "saved"
                ? "saved"
                : "draft"}
            </span>
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${analysis.errors ? "bg-[var(--dash-rose-wash)] text-[var(--dash-rose)]" : analysis.warnings ? "bg-[var(--dash-amber-wash)] text-[var(--dash-amber)]" : "bg-[var(--dash-sage-wash)] text-[var(--dash-sage)]"}`}>
              {analysis.errors ? `${analysis.errors} err` : analysis.warnings ? `${analysis.warnings} warn` : "valid"}
            </span>
            <label className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--dash-bg)] px-2 py-1.5 text-[11.5px] font-semibold text-[var(--dash-ink-soft)]">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={isActive && analysis.deployable}
                disabled={!workflowId || setWorkflowActive.isPending || !analysis.deployable}
                onChange={(event) => {
                  if (!workflowId) return
                  setWorkflowActive.mutate({ id: workflowId, isActive: event.target.checked })
                }}
              />
              {isActive && analysis.deployable ? "Active" : "Inactive"}
            </label>
            {runStatus === "running" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--dash-accent-wash)] px-2 py-0.5 text-[10px] font-bold text-[var(--dash-accent-deep)]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--dash-accent)]" />
                LIVE
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => undo()} disabled={pastCount === 0} aria-label="Undo" className="flex min-h-10 min-w-10 h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-lg border dash-border bg-[var(--dash-bg)] text-[var(--dash-ink-soft)] transition hover:dash-shadow-sm disabled:opacity-40">
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => redo()} disabled={futureCount === 0} aria-label="Redo" className="flex min-h-10 min-w-10 h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-lg border dash-border bg-[var(--dash-bg)] text-[var(--dash-ink-soft)] transition hover:dash-shadow-sm disabled:opacity-40">
            <Redo2 className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => loadPipeline(ADVAN_COPILOT_PIPELINE, { dirty: true })} className="inline-flex min-h-10 h-10 sm:h-8 items-center gap-1.5 rounded-lg border dash-border bg-[var(--dash-bg)] px-3 text-[12px] font-semibold text-[var(--dash-ink-soft)] transition hover:dash-shadow-sm">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Copilot</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (isBillingRestricted) {
                toast.error("Actions are locked due to past due invoice. Please update billing under settings.")
              } else {
                void doSave(false)
              }
            }}
            disabled={saveState === "saving" || isBillingRestricted}
            className="inline-flex min-h-10 h-10 sm:h-8 flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg border dash-border bg-[var(--dash-card)] px-3 text-[12px] font-semibold text-[var(--dash-ink-soft)] transition hover:dash-shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isBillingRestricted ? (
              <Lock className="h-3.5 w-3.5 text-amber-500" />
            ) : saveState === "saving" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : saveState === "saved" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--dash-sage)]" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save
          </button>
          <button
            type="button"
            onClick={() => void doPreflight()}
            disabled={preflight.isPending || analysis.errors > 0 || analysis.nodeCount === 0}
            className="inline-flex min-h-10 h-10 sm:h-8 flex-[1.2] sm:flex-none items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] px-3.5 text-[12px] font-bold text-white shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] transition hover:-translate-y-px disabled:opacity-60"
          >
            {preflight.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlayCircle className="h-3.5 w-3.5" />
            )}
            Preflight
          </button>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled
                className="hidden sm:inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-lg border dash-border bg-white px-3 text-[12px] font-semibold text-[var(--dash-ink-faint)] opacity-70"
              >
                <Pause className="h-3.5 w-3.5" />
                Durable
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" align="end" className="max-w-[260px] leading-5">
              Durable runs require an active workflow plus the Temporal worker. Use Preflight for local validation.
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="border-b dash-border-soft px-3 sm:px-4 py-2">
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Workflow description"
          className="h-10 sm:h-8 w-full rounded-lg bg-[var(--dash-bg)] px-3 text-[12px] text-[var(--dash-ink-soft)] outline-none focus:ring-2 focus:ring-[#6B5CD6]/15"
          aria-label="Workflow description"
        />
      </div>

      {connError && (
        <div className="flex items-start gap-2 border-b border-[#F0CBCB] bg-[var(--dash-rose-wash)] px-3 sm:px-4 py-2 text-[12px] text-[var(--dash-rose)]">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> <span className="min-w-0 break-words">{connError}</span>
        </div>
      )}

      {analysis.issues.length > 0 && (
        <div className="flex items-start gap-2 border-b border-[#E7C988] bg-[var(--dash-amber-wash)] px-3 sm:px-4 py-2 text-[12px] text-[#7a541f]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="min-w-0">
            <span className="font-bold">{analysis.errors ? "Deployment blocked:" : "Review:"}</span>{" "}
            <span className="break-words">{analysis.issues[0]?.message}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col min-w-0">
        <div className="relative flex flex-col lg:flex-row min-h-[min(58dvh,28rem)] lg:h-[min(70dvh,36rem)] 3xl:h-[min(72dvh,42rem)] 4xl:h-[min(75dvh,48rem)]">
          {/* Desktop palette */}
          <div className="hidden lg:block w-[12.5rem] 3xl:w-[14rem] 4xl:w-[15rem] shrink-0 border-r dash-border overflow-y-auto overscroll-contain">
            <PipelineSidebar />
          </div>

          <div className="relative flex-1 min-h-[min(48dvh,22rem)] lg:min-h-0 dash-bg-deep min-w-0">
            <PipelineCanvas compactChrome={!isWorkbench} />

            {/* Mobile canvas tools */}
            {!isWorkbench && (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center gap-2 px-3 pb-[env(safe-area-inset-bottom)]">
                <button
                  type="button"
                  onClick={() => { setInspectorOpen(false); setPaletteOpen(true) }}
                  className="pointer-events-auto inline-flex min-h-11 items-center gap-1.5 rounded-full border dash-border bg-white/95 px-4 text-[12.5px] font-bold text-[var(--dash-ink)] shadow-[0_12px_32px_-16px_rgba(23,26,23,0.55)] backdrop-blur"
                >
                  <Boxes className="h-4 w-4 text-[var(--dash-accent)]" />
                  Nodes
                </button>
                <button
                  type="button"
                  onClick={() => { setPaletteOpen(false); setInspectorOpen(true) }}
                  className={cn(
                    "pointer-events-auto inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[12.5px] font-bold shadow-[0_12px_32px_-16px_rgba(23,26,23,0.55)] backdrop-blur",
                    hasSelection
                      ? "border-[#9D91EA] bg-[#F6F4FF]/95 text-[var(--dash-accent-deep)]"
                      : "dash-border bg-white/95 text-[var(--dash-ink)]",
                  )}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Config
                </button>
              </div>
            )}
          </div>

          {/* Desktop inspector */}
          <div className="hidden lg:block w-[16.25rem] 3xl:w-[18rem] 4xl:w-[20rem] shrink-0 border-l dash-border overflow-y-auto overscroll-contain">
            <PipelineInspector />
          </div>
        </div>
        <PipelineExecutionTrace />
      </div>

      {/* Mobile palette sheet */}
      {!isWorkbench && paletteOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 backdrop-blur-sm lg:hidden" onMouseDown={() => setPaletteOpen(false)}>
          <div
            className="flex max-h-[min(78dvh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border dash-border bg-[var(--dash-card)] shadow-[0_30px_90px_-45px_rgba(23,26,23,0.55)] pb-[env(safe-area-inset-bottom)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b dash-border-soft px-4 py-3 sticky top-0 bg-[var(--dash-card)] z-10">
              <Boxes className="h-4 w-4 text-[var(--dash-accent)]" />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold text-[var(--dash-ink)]">Add node</div>
                <div className="text-[11px] text-[var(--dash-ink-faint)]">Tap a block to place it on the canvas</div>
              </div>
              <button type="button" aria-label="Close" onClick={() => setPaletteOpen(false)} className="flex min-h-9 min-w-9 h-9 w-9 items-center justify-center rounded-md text-[var(--dash-ink-faint)] hover:bg-[var(--dash-bg)]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <PipelineSidebar onPick={addNodeFromPalette} />
            </div>
          </div>
        </div>
      )}

      {/* Mobile inspector sheet */}
      {!isWorkbench && inspectorOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 backdrop-blur-sm lg:hidden" onMouseDown={() => setInspectorOpen(false)}>
          <div
            className="flex max-h-[min(78dvh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border dash-border bg-[var(--dash-card)] shadow-[0_30px_90px_-45px_rgba(23,26,23,0.55)] pb-[env(safe-area-inset-bottom)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b dash-border-soft px-4 py-3 sticky top-0 bg-[var(--dash-card)] z-10">
              <SlidersHorizontal className="h-4 w-4 text-[var(--dash-accent)]" />
              <div className="min-w-0 flex-1 text-[14px] font-bold text-[var(--dash-ink)]">Configure</div>
              <button type="button" aria-label="Close" onClick={() => setInspectorOpen(false)} className="flex min-h-9 min-w-9 h-9 w-9 items-center justify-center rounded-md text-[var(--dash-ink-faint)] hover:bg-[var(--dash-bg)]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <PipelineInspector />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
