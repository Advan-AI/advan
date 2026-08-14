"use client"

import { CheckCircle2, Circle, Loader2 } from "lucide-react"

export interface SandboxSessionView {
  sandboxId: string
  sessionId: string
  traceId: string
  state: string
  createdAt: string | null
  executedAt: string | null
  hibernatedAt: string | null
  wokenAt: string | null
  resumedAt: string | null
  completedAt: string | null
  computeMsEstimate: number
  computeSavedMsEstimate: number
  wakeLatencyMs: number | null
  hitlTimeoutMinutes: number
  events: Array<Record<string, unknown>>
}

interface Step {
  key: string
  label: string
  ts: string | null
}

/** Ordered rubric flow: Sandbox Created -> Execute -> Hibernate -> Waiting -> Wake -> Resume -> Finish. */
function buildSteps(sandbox: SandboxSessionView | null, workflowStatus: string | null): Step[] {
  return [
    { key: "created", label: "Sandbox Created", ts: sandbox?.createdAt ?? null },
    { key: "executed", label: "Execute (agent runs in sandbox)", ts: sandbox?.executedAt ?? null },
    { key: "hibernated", label: "Hibernate (waiting for approval)", ts: sandbox?.hibernatedAt ?? null },
    { key: "woken", label: "Human Approves -> Wake", ts: sandbox?.wokenAt ?? null },
    { key: "resumed", label: "Resume", ts: sandbox?.resumedAt ?? null },
    {
      key: "completed",
      label: "Finish",
      ts: sandbox?.completedAt ?? (workflowStatus === "COMPLETED" ? new Date().toISOString() : null),
    },
  ]
}

export function SandboxTimeline({
  sandbox,
  workflowStatus,
}: {
  sandbox: SandboxSessionView | null
  workflowStatus: string | null
}) {
  const steps = buildSteps(sandbox, workflowStatus)
  const failed = workflowStatus === "FAILED" || workflowStatus === "TIMED_OUT" || workflowStatus === "TERMINATED" || workflowStatus === "CANCELED"
  const activeIndex = steps.findIndex((s) => !s.ts)

  return (
    <ol className="space-y-0">
      {failed && (
        <li className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          Workflow {workflowStatus?.toLowerCase()}. The sandbox demo never reached hibernation — check the Temporal worker log (composer/LLM). This page does not create a dashboard ticket.
        </li>
      )}
      {steps.map((step, i) => {
        const done = !!step.ts
        const active = !done && !failed && i === activeIndex
        return (
          <li key={step.key} className="flex gap-3 pb-5 last:pb-0">
            <div className="flex flex-col items-center">
              {done ? (
                <CheckCircle2 className="w-5 h-5 text-[#5C9A70] shrink-0" />
              ) : active ? (
                <Loader2 className="w-5 h-5 text-[#6B5CD6] animate-spin shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-foreground/25 shrink-0" />
              )}
              {i < steps.length - 1 && (
                <div className={`w-px flex-1 mt-1 ${done ? "bg-[#5C9A70]/40" : "bg-black/10"}`} />
              )}
            </div>
            <div className="min-w-0 pt-0.5">
              <div
                className={`text-sm font-semibold ${
                  done ? "text-foreground" : active ? "text-[#4E3FB6]" : "text-foreground/45"
                }`}
              >
                {step.label}
              </div>
              <div className="text-xs text-foreground/45 font-mono mt-0.5">
                {step.ts ? new Date(step.ts).toLocaleTimeString() : active ? "in progress…" : failed && i === activeIndex ? "failed" : "pending"}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
