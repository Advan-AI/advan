"use client"

import { memo } from "react"
import { motion } from "framer-motion"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Loader2, CheckCircle2, XCircle, MinusCircle } from "lucide-react"
import { nodeRegistry } from "@/lib/pipeline/registry"
import { usePipelineExecution } from "@/lib/pipeline/execution-store"
import { iconFor, TONE_STYLE } from "./icon-map"

/**
 * Generic, registry-driven node renderer.
 *
 * ONE component renders every node type by reading its definition from the
 * registry. Adding a node type requires zero changes here — the Open-Closed
 * Principle in action. Ports (Handles) are generated from the type's
 * inputs/outputs, with vertical distribution for multi-port nodes.
 */
export const PipelineNodeView = memo(function PipelineNodeView({ id, type, selected }: NodeProps) {
  const execStatus = usePipelineExecution((s) => (id ? s.nodeStatuses[id] : undefined) ?? "idle")

  if (!type || !nodeRegistry.has(type)) {
    return <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-600">Unknown node</div>
  }
  const def = nodeRegistry.get(type)
  const Icon = iconFor(def.iconName)
  const tone = TONE_STYLE[def.tone]
  const isLive = execStatus === "running"

  const borderColor =
    execStatus === "running" ? tone.fg
    : execStatus === "completed" ? "var(--dash-sage)"
    : execStatus === "failed" ? "var(--dash-rose)"
    : execStatus === "skipped" ? "var(--dash-amber)"
    : selected ? tone.fg : "rgba(0,0,0,0.10)"

  return (
    <motion.div
      className="relative rounded-[11px] border-[1.5px] bg-white px-2.5 py-2 transition"
      style={{
        width: 168,
        borderColor,
        boxShadow: isLive
          ? `0 0 0 6px ${tone.bg}`
          : selected
          ? `0 0 0 3px ${tone.bg}`
          : "0 4px 12px -6px rgba(0,0,0,0.12)",
      }}
      animate={
        isLive
          ? { boxShadow: [`0 0 0 0 ${tone.fg}55`, `0 0 0 10px ${tone.fg}00`, `0 0 0 0 ${tone.fg}00`] }
          : undefined
      }
      transition={isLive ? { duration: 1.4, repeat: Infinity } : undefined}
      role="group"
      aria-label={`${def.label} node${execStatus !== "idle" ? `, ${execStatus}` : ""}`}
    >
      {def.inputs.map((p, i) => (
        <Handle
          key={p.id}
          id={p.id}
          type="target"
          position={Position.Left}
          style={{ top: portTop(i, def.inputs.length), background: tone.fg, width: 9, height: 9, border: "none" }}
        />
      ))}

      <div className="flex items-center gap-2">
        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md" style={{ background: tone.bg, color: tone.fg }}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11.5px] font-bold leading-tight text-[var(--dash-ink)]">{def.label}</div>
          <div className="truncate text-[9.5px] text-[var(--dash-ink-faint)]">{def.category}</div>
        </div>
        <ExecBadge status={execStatus} />
      </div>

      {def.outputs.map((p, i) => (
        <Handle
          key={p.id}
          id={p.id}
          type="source"
          position={Position.Right}
          style={{ top: portTop(i, def.outputs.length), background: tone.fg, width: 9, height: 9, border: "none" }}
        />
      ))}
    </motion.div>
  )
})

function ExecBadge({ status }: { status: string }) {
  if (status === "idle") return null
  if (status === "running") return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--dash-accent)]" aria-hidden />
  if (status === "completed") return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--dash-sage)]" aria-hidden />
  if (status === "failed") return <XCircle className="h-3.5 w-3.5 shrink-0 text-[var(--dash-rose)]" aria-hidden />
  if (status === "skipped") return <MinusCircle className="h-3.5 w-3.5 shrink-0 text-[var(--dash-amber)]" aria-hidden />
  return null
}

function portTop(index: number, count: number): string {
  if (count <= 1) return "50%"
  const pct = ((index + 1) / (count + 1)) * 100
  return `${pct}%`
}
