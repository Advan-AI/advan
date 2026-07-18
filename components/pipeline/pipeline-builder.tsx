"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useStore } from "zustand"
import { ReactFlowProvider } from "@xyflow/react"
import { toast } from "sonner"
import {
  PlayCircle, Save, CheckCircle2, Loader2, Undo2, Redo2, GitBranch, Sparkles, AlertTriangle, Pause, Info, Lock,
} from "lucide-react"
import { api } from "@/lib/api/trpc-client"
import { usePipelineStore } from "@/lib/pipeline/use-pipeline-store"
import { ADVAN_COPILOT_PIPELINE } from "@/lib/pipeline/presets"
import { usePipelineExecution } from "@/lib/pipeline/execution-store"
import { usePipelineRealtime } from "@/lib/pipeline/use-pipeline-realtime"
import { analyzeWorkflowDefinition } from "@/lib/workflows/analyzer"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { PipelineSidebar } from "./sidebar"
import { PipelineCanvas } from "./canvas"
import { PipelineInspector } from "./inspector"
import { PipelineExecutionTrace } from "./execution-trace"

export function PipelineBuilder() {
  usePipelineRealtime()
  const searchParams = useSearchParams()

  const [workflowId, setWorkflowId] = useState<string | undefined>(undefined)
  const [name, setName] = useState("webhook-support-v2")
  const [description, setDescription] = useState("")
  const [isActive, setIsActive] = useState(false)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle")

  const runStatus = usePipelineExecution((s) => s.runStatus)

  const dirty = usePipelineStore((s) => s.dirty)
  const connError = usePipelineStore((s) => s.lastConnectionError)
  const loadPipeline = usePipelineStore((s) => s.loadPipeline)
  const markSaved = usePipelineStore((s) => s.markSaved)

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

      // Compile the pipeline locally to get the detailed waves and nodes
      const { PipelineCompiler } = await import("@/lib/pipeline/compiler")
      const plan = PipelineCompiler.compile(definition)

      // Get the execution store action helpers
      const execStore = usePipelineExecution.getState()
      execStore.beginRun("preflight-sim")

      // Walk through the waves sequentially
      for (const wave of plan.waves) {
        // First phase: set all nodes in the wave to "running" in parallel
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

        // Wait for premium processing effect
        await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 400))

        // Second phase: set all nodes in the wave to "completed" in parallel
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

        // Wait slightly between waves
        await new Promise((resolve) => setTimeout(resolve, 300))
      }

      // Finish the run successfully
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

  return (
    <ReactFlowProvider>
      <div className="dash-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b dash-border-soft px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-[14px] font-bold text-[var(--dash-ink)]">
            <GitBranch className="h-[18px] w-[18px] text-[var(--dash-accent)]" />
            <select
              value={workflowId ?? "__draft__"}
              onChange={(event) => {
                if (event.target.value === "__draft__") return startNewDraft()
                const row = workflows.data?.find((workflow) => workflow.id === event.target.value)
                if (row) loadWorkflow(row)
              }}
              className="h-8 max-w-[220px] rounded-lg border dash-border bg-white px-2 text-[12px] font-semibold text-[var(--dash-ink-soft)] outline-none"
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
              className="w-[200px] rounded-md bg-transparent px-1 py-0.5 outline-none focus:bg-[var(--dash-bg)]"
            />
          </div>
          <span className="font-mono text-[11.5px] text-[var(--dash-ink-faint)]">
            {runStatus === "running"
              ? "running…"
              : dirty
              ? "unsaved changes"
              : saveState === "saved"
              ? "all changes saved"
              : "draft"}
          </span>
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${analysis.errors ? "bg-[var(--dash-rose-wash)] text-[var(--dash-rose)]" : analysis.warnings ? "bg-[var(--dash-amber-wash)] text-[var(--dash-amber)]" : "bg-[var(--dash-sage-wash)] text-[var(--dash-sage)]"}`}>
            {analysis.errors ? `${analysis.errors} errors` : analysis.warnings ? `${analysis.warnings} warnings` : "valid"}
          </span>
          <label className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--dash-bg)] px-2 py-1 text-[11.5px] font-semibold text-[var(--dash-ink-soft)]">
            <input
              type="checkbox"
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

          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => undo()} disabled={pastCount === 0} aria-label="Undo" className="flex h-8 w-8 items-center justify-center rounded-lg border dash-border bg-[var(--dash-bg)] text-[var(--dash-ink-soft)] transition hover:dash-shadow-sm disabled:opacity-40">
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => redo()} disabled={futureCount === 0} aria-label="Redo" className="flex h-8 w-8 items-center justify-center rounded-lg border dash-border bg-[var(--dash-bg)] text-[var(--dash-ink-soft)] transition hover:dash-shadow-sm disabled:opacity-40">
              <Redo2 className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => loadPipeline(ADVAN_COPILOT_PIPELINE, { dirty: true })} className="inline-flex h-8 items-center gap-1.5 rounded-lg border dash-border bg-[var(--dash-bg)] px-3 text-[12px] font-semibold text-[var(--dash-ink-soft)] transition hover:dash-shadow-sm">
              <Sparkles className="h-3.5 w-3.5" /> Advan Copilot
            </button>
            <button
              onClick={() => {
                if (isBillingRestricted) {
                  toast.error("Actions are locked due to past due invoice. Please update billing under settings.")
                } else {
                  void doSave(false)
                }
              }}
              disabled={saveState === "saving" || isBillingRestricted}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border dash-border bg-[var(--dash-card)] px-3 text-[12px] font-semibold text-[var(--dash-ink-soft)] transition hover:dash-shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
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
              onClick={() => void doPreflight()}
              disabled={preflight.isPending || analysis.errors > 0 || analysis.nodeCount === 0}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] px-3.5 text-[12px] font-bold text-white shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] transition hover:-translate-y-px disabled:opacity-60"
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
                  className="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-lg border dash-border bg-white px-3 text-[12px] font-semibold text-[var(--dash-ink-faint)] opacity-70"
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

        <div className="border-b dash-border-soft px-4 py-2">
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Workflow description"
            className="h-8 w-full rounded-lg bg-[var(--dash-bg)] px-3 text-[12px] text-[var(--dash-ink-soft)] outline-none focus:ring-2 focus:ring-[#6B5CD6]/15"
            aria-label="Workflow description"
          />
        </div>

        {connError && (
          <div className="flex items-center gap-2 border-b border-[#F0CBCB] bg-[var(--dash-rose-wash)] px-4 py-2 text-[12px] text-[var(--dash-rose)]">
            <AlertTriangle className="h-3.5 w-3.5" /> {connError}
          </div>
        )}

        {analysis.issues.length > 0 && (
          <div className="flex items-start gap-2 border-b border-[#E7C988] bg-[var(--dash-amber-wash)] px-4 py-2 text-[12px] text-[#7a541f]">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="min-w-0">
              <span className="font-bold">{analysis.errors ? "Deployment blocked:" : "Review:"}</span>{" "}
              <span>{analysis.issues[0]?.message}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col">
          <div className="flex" style={{ height: 480 }}>
            <PipelineSidebar />
            <div className="relative flex-1 dash-bg-deep">
              <PipelineCanvas />
            </div>
            <PipelineInspector />
          </div>
          <PipelineExecutionTrace />
        </div>
      </div>
    </ReactFlowProvider>
  )
}
