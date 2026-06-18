"use client"

import { useEffect, useRef, useState } from "react"
import { useStore } from "zustand"
import { ReactFlowProvider } from "@xyflow/react"
import { toast } from "sonner"
import {
  PlayCircle, Save, CheckCircle2, Loader2, Undo2, Redo2, GitBranch, Sparkles, AlertTriangle,
} from "lucide-react"
import { api } from "@/lib/api/trpc-client"
import { usePipelineStore } from "@/lib/pipeline/use-pipeline-store"
import { ADVAN_COPILOT_PIPELINE } from "@/lib/pipeline/presets"
import { usePipelineExecution } from "@/lib/pipeline/execution-store"
import { usePipelineRealtime } from "@/lib/pipeline/use-pipeline-realtime"
import { PipelineSidebar } from "./sidebar"
import { PipelineCanvas } from "./canvas"
import { PipelineInspector } from "./inspector"
import { PipelineExecutionTrace } from "./execution-trace"

export function PipelineBuilder() {
  usePipelineRealtime()

  const [workflowId, setWorkflowId] = useState<string | undefined>(undefined)
  const [name, setName] = useState("webhook-support-v2")
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle")

  const runStatus = usePipelineExecution((s) => s.runStatus)
  const beginRun = usePipelineExecution((s) => s.beginRun)

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
  const run = api.orchestration.runPipeline.useMutation()

  // Load the first saved workflow, or seed with the Advan Copilot preset.
  const loadedRef = useRef(false)
  useEffect(() => {
    if (loadedRef.current || workflows.isLoading) return
    loadedRef.current = true
    const existing = workflows.data?.[0]
    if (existing?.definition && typeof existing.definition === "object" && "schemaVersion" in existing.definition) {
      setWorkflowId(existing.id)
      setName(existing.name)
      loadPipeline(existing.definition as never)
    } else {
      loadPipeline(ADVAN_COPILOT_PIPELINE)
    }
  }, [workflows.isLoading, workflows.data, loadPipeline])

  // Debounced autosave on dirty.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!dirty) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void doSave(true), 1500)
    return () => { if (timer.current) clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty])

  async function doSave(isAuto = false) {
    setSaveState("saving")
    try {
      const definition = usePipelineStore.getState().toPipeline()
      const res = await save.mutateAsync({ id: workflowId, name, definition })
      const saved = Array.isArray(res) ? res[0] : res
      if (saved?.id) setWorkflowId(saved.id)
      markSaved()
      setSaveState("saved")
      if (!isAuto) toast.success("Pipeline saved")
      setTimeout(() => setSaveState("idle"), 2000)
    } catch (err) {
      setSaveState("idle")
      toast.error(err instanceof Error ? err.message : "Save failed")
    }
  }

  async function doRun() {
    try {
      const definition = usePipelineStore.getState().toPipeline()
      const res = await run.mutateAsync({ workflowId, definition, input: "Test run from builder" })
      beginRun(res.workflowId)
      toast.success(`Run started — live trace active`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Run failed")
    }
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
          <div className="flex items-center gap-2 text-[14px] font-bold text-[var(--dash-ink)]">
            <GitBranch className="h-[18px] w-[18px] text-[var(--dash-accent)]" />
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
            <button onClick={() => loadPipeline(ADVAN_COPILOT_PIPELINE)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border dash-border bg-[var(--dash-bg)] px-3 text-[12px] font-semibold text-[var(--dash-ink-soft)] transition hover:dash-shadow-sm">
              <Sparkles className="h-3.5 w-3.5" /> Advan Copilot
            </button>
            <button onClick={() => void doSave(false)} disabled={saveState === "saving"} className="inline-flex h-8 items-center gap-1.5 rounded-lg border dash-border bg-[var(--dash-card)] px-3 text-[12px] font-semibold text-[var(--dash-ink-soft)] transition hover:dash-shadow-sm disabled:opacity-60">
              {saveState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saveState === "saved" ? <CheckCircle2 className="h-3.5 w-3.5 text-[var(--dash-sage)]" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </button>
            <button
              onClick={() => void doRun()}
              disabled={run.isPending || runStatus === "running"}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] px-3.5 text-[12px] font-bold text-white shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] transition hover:-translate-y-px disabled:opacity-60"
            >
              {run.isPending || runStatus === "running" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PlayCircle className="h-3.5 w-3.5" />
              )}
              {runStatus === "running" ? "Running…" : "Run"}
            </button>
          </div>
        </div>

        {connError && (
          <div className="flex items-center gap-2 border-b border-[#F0CBCB] bg-[var(--dash-rose-wash)] px-4 py-2 text-[12px] text-[var(--dash-rose)]">
            <AlertTriangle className="h-3.5 w-3.5" /> {connError}
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
