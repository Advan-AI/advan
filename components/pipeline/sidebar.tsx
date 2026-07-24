"use client"

import { nodeRegistry, type NodeCategory } from "@/lib/pipeline/registry"
import { iconFor, TONE_STYLE } from "./icon-map"

const CATEGORY_LABELS: Record<NodeCategory, string> = {
  trigger: "Triggers",
  ai: "AI",
  data: "Data",
  human: "Human",
  action: "Actions",
}

/**
 * Palette. Iterates the registry — new node types appear automatically.
 * Drag sets the node `type` on the dataTransfer; the Canvas reads it on drop.
 */
export function PipelineSidebar() {
  const grouped = nodeRegistry.byCategory()

  return (
    <div className="w-full h-full overflow-y-auto p-3 dash-bg-sidebar" aria-label="Node palette">
      {(Object.keys(grouped) as NodeCategory[]).map((cat) =>
        grouped[cat].length === 0 ? null : (
          <div key={cat} className="mb-3">
            <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--dash-ink-faint)]">
              {CATEGORY_LABELS[cat]}
            </div>
            <div className="flex flex-col gap-1.5">
              {grouped[cat].map((def) => {
                const Icon = iconFor(def.iconName)
                const tone = TONE_STYLE[def.tone]
                return (
                  <div
                    key={def.type}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/advan-node-type", def.type)
                      e.dataTransfer.effectAllowed = "move"
                    }}
                    title={def.description}
                    className="flex cursor-grab select-none items-center gap-2.5 rounded-lg border dash-border bg-white px-2.5 py-2 transition hover:-translate-y-px hover:dash-shadow-sm active:cursor-grabbing"
                  >
                    <span className="flex h-[26px] w-[26px] items-center justify-center rounded-md" style={{ background: tone.bg, color: tone.fg }}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[12px] font-semibold text-[var(--dash-ink)]">{def.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      )}
    </div>
  )
}
