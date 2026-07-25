"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Activity, Loader2 } from "lucide-react"
import { usePipelineExecution } from "@/lib/pipeline/execution-store"
import { nodeRegistry } from "@/lib/pipeline/registry"
import { iconFor, TONE_STYLE } from "./icon-map"

/**
 * Live execution trace fed by Socket.IO `pipeline:step` events.
 */
export function PipelineExecutionTrace() {
  const trace = usePipelineExecution((s) => s.trace)
  const runStatus = usePipelineExecution((s) => s.runStatus)
  const active = usePipelineExecution((s) => s.activeTemporalWorkflowId)

  const dotCls = (tone: string) =>
    tone === "err" ? "bg-[var(--dash-rose)]"
    : tone === "warn" ? "bg-[var(--dash-amber)]"
    : tone === "ok" ? "bg-[var(--dash-sage)]"
    : "bg-[var(--dash-accent)]"

  return (
    <div className="flex h-[min(28dvh,13rem)] sm:h-[220px] 3xl:h-[240px] shrink-0 flex-col border-t dash-border-soft bg-white/80">
      <div className="flex items-center justify-between border-b dash-border-soft px-3 py-2 min-h-10">
        <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--dash-ink-soft)]">
          <Activity className="h-3 w-3 text-[var(--dash-accent)]" />
          Execution trace
        </div>
        <span className="flex items-center gap-1 font-mono text-[10px] text-[var(--dash-ink-faint)]">
          {runStatus === "running" && <Loader2 className="h-3 w-3 animate-spin text-[var(--dash-accent)]" />}
          {runStatus === "running" ? "LIVE" : runStatus === "completed" ? "DONE" : runStatus === "failed" ? "FAILED" : "IDLE"}
        </span>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {!active || trace.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12px] text-[var(--dash-ink-faint)]">
            {runStatus === "running" ? "Waiting for step events…" : "Run the pipeline to see live telemetry."}
          </p>
        ) : (
          <div className="max-h-full space-y-1.5 overflow-y-auto px-2 py-2">
            <AnimatePresence initial={false}>
              {trace.map((event) => {
                let label = event.nodeId
                let Icon = iconFor("Box")
                let tone = TONE_STYLE.slate
                try {
                  const def = nodeRegistry.get(event.nodeType)
                  label = def.label
                  Icon = iconFor(def.iconName)
                  tone = TONE_STYLE[def.tone]
                } catch {
                  /* unknown node type in trace */
                }

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-2 rounded-lg border dash-border-soft bg-white px-2 py-1.5"
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                      style={{ background: tone.bg, color: tone.fg }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[11px] font-bold text-[var(--dash-ink)]">{label}</span>
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotCls(event.tone)}`} />
                        <span className="ml-auto font-mono text-[9px] text-[var(--dash-ink-faint)]">{event.ts}</span>
                      </div>
                      <p className="text-[10.5px] leading-snug text-[var(--dash-ink-soft)]">{event.message}</p>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent" />
      </div>
    </div>
  )
}
