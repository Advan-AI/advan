"use client"

import { nodeRegistry, type NodeCategory } from "@/lib/pipeline/registry"
import { iconFor, TONE_STYLE } from "./icon-map"
import { cn } from "@/lib/utils"

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
 * On touch / mobile sheets, `onPick` adds a node without requiring HTML5 DnD.
 */
export function PipelineSidebar({ onPick }: { onPick?: (type: string) => void }) {
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
                    role={onPick ? "button" : undefined}
                    tabIndex={onPick ? 0 : undefined}
                    draggable={!onPick}
                    onDragStart={onPick ? undefined : (e) => {
                      e.dataTransfer.setData("application/advan-node-type", def.type)
                      e.dataTransfer.effectAllowed = "move"
                    }}
                    onClick={onPick ? () => onPick(def.type) : undefined}
                    onKeyDown={onPick ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        onPick(def.type)
                      }
                    } : undefined}
                    title={def.description}
                    className={cn(
                      "flex select-none items-center gap-2.5 rounded-lg border dash-border bg-white px-2.5 py-2.5 sm:py-2 transition hover:-translate-y-px hover:dash-shadow-sm",
                      onPick ? "min-h-11 cursor-pointer active:scale-[0.99]" : "cursor-grab active:cursor-grabbing",
                    )}
                  >
                    <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md" style={{ background: tone.bg, color: tone.fg }}>
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
