"use client"

import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"

export type NodeExecStatus = "idle" | "running" | "completed" | "failed" | "skipped"
export type RunStatus = "idle" | "running" | "completed" | "failed"

export interface PipelineStepEvent {
  orgId: string
  temporalWorkflowId: string
  runId: string
  nodeId: string
  nodeType?: string
  status: string
  output?: unknown
  error?: string
  latencyMs?: number
}

export interface TraceEvent {
  id: string
  ts: string
  nodeId: string
  nodeType: string
  status: string
  message: string
  tone: "info" | "ok" | "warn" | "err"
}

interface ExecutionState {
  activeTemporalWorkflowId: string | null
  runStatus: RunStatus
  nodeStatuses: Record<string, NodeExecStatus>
  trace: TraceEvent[]

  beginRun: (temporalWorkflowId: string) => void
  applyStep: (step: PipelineStepEvent) => void
  finishRun: (temporalWorkflowId: string, status: "completed" | "failed") => void
  reset: () => void
}

const INITIAL: Pick<ExecutionState, "activeTemporalWorkflowId" | "runStatus" | "nodeStatuses" | "trace"> = {
  activeTemporalWorkflowId: null,
  runStatus: "idle",
  nodeStatuses: {},
  trace: [],
}

function toNodeStatus(status: string): NodeExecStatus {
  if (status === "running") return "running"
  if (status === "completed") return "completed"
  if (status === "failed") return "failed"
  if (status === "skipped") return "skipped"
  return "idle"
}

function traceTone(status: string): TraceEvent["tone"] {
  if (status === "completed") return "ok"
  if (status === "failed") return "err"
  if (status === "skipped") return "warn"
  return "info"
}

function traceMessage(step: PipelineStepEvent): string {
  if (step.status === "running") return "Executing…"
  if (step.status === "completed") {
    return step.latencyMs != null ? `Completed in ${step.latencyMs}ms` : "Completed"
  }
  if (step.status === "failed") return step.error ?? "Failed"
  if (step.status === "skipped") return step.error ?? "Skipped"
  return step.status
}

/**
 * Live execution overlay state — kept separate from the graph store so undo/redo
 * and autosave are never polluted by transient run telemetry.
 */
export const usePipelineExecution = create<ExecutionState>()(
  subscribeWithSelector((set, get) => ({
    ...INITIAL,

    beginRun: (temporalWorkflowId) =>
      set({
        activeTemporalWorkflowId: temporalWorkflowId,
        runStatus: "running",
        nodeStatuses: {},
        trace: [],
      }),

    applyStep: (step) => {
      let active = get().activeTemporalWorkflowId
      const currentStatus = get().runStatus

      // Auto-bind to real-world executions from background workers if the UI is currently idle or done
      if (!active || currentStatus !== "running") {
        set({
          activeTemporalWorkflowId: step.temporalWorkflowId,
          runStatus: "running",
          nodeStatuses: {},
          trace: [],
        })
        active = step.temporalWorkflowId
      }

      if (step.temporalWorkflowId !== active) return

      const nodeStatus = toNodeStatus(step.status)
      const event: TraceEvent = {
        id: `${step.nodeId}-${step.status}-${Date.now()}`,
        ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        nodeId: step.nodeId,
        nodeType: step.nodeType ?? "unknown",
        status: step.status,
        message: traceMessage(step),
        tone: traceTone(step.status),
      }

      set((s) => ({
        nodeStatuses: { ...s.nodeStatuses, [step.nodeId]: nodeStatus },
        trace: [event, ...s.trace].slice(0, 40),
      }))
    },

    finishRun: (temporalWorkflowId, status) => {
      if (get().activeTemporalWorkflowId !== temporalWorkflowId) return
      set({ runStatus: status })
    },

    reset: () => set({ ...INITIAL }),
  }))
)
