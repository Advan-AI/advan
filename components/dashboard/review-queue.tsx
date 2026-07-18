"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Flag, CheckCircle2, FileText } from "lucide-react"
import type { QueueItem } from "@/lib/demo-fixtures"

/**
 * Human review queue — the surface where reviewers approve low-confidence
 * replies (the core human-in-the-loop promise). Controlled by the parent so
 * the "awaiting review" count stays in sync across the dashboard.
 * Wire `onApprove` to the HITL Temporal signal (app/api/hitl) when live.
 */
export function ReviewQueue({
  items,
  onApprove,
}: {
  items: QueueItem[]
  onApprove: (id: string) => void
}) {
  return (
    <div className="dash-card overflow-hidden flex flex-col">
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b dash-border-soft">
        <span className="text-[var(--dash-amber)]">
          <Flag className="w-[18px] h-[18px]" />
        </span>
        <span className="text-[14px] font-bold text-[var(--dash-ink)]">Human review queue</span>
        <span className="inline-flex items-center text-[11px] font-bold rounded-md px-2 py-0.5 bg-[var(--dash-amber-wash)] text-[#8a5a1e]">
          {items.length} awaiting
        </span>
        <button
          type="button"
          className="ml-auto text-[12px] font-semibold text-[var(--dash-accent-deep)] hover:underline"
        >
          View all
        </button>
      </div>

      <div className="flex-1">
        <AnimatePresence mode="popLayout">
          {items.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center text-center px-6 py-14"
            >
              <span className="w-11 h-11 rounded-full bg-[var(--dash-sage-wash)] flex items-center justify-center mb-3">
                <CheckCircle2 className="w-5 h-5 text-[#2f5d3f]" />
              </span>
              <div className="text-[14px] font-bold text-[var(--dash-ink)]">Queue clear</div>
              <p className="mt-1 text-[12.5px] text-[var(--dash-ink-soft)] max-w-xs">
                Every low-confidence reply has been reviewed. Nice work.
              </p>
            </motion.div>
          ) : (
            items.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-start gap-3 px-4 py-3.5 border-b dash-border-soft last:border-b-0"
              >
                <div className="w-9 h-9 rounded-full dash-bg-deep flex items-center justify-center text-[11px] font-bold text-[var(--dash-ink-soft)] shrink-0">
                  {item.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[13px] font-bold text-[var(--dash-ink)]">{item.name}</span>
                    <span className="text-[12px] text-[var(--dash-ink-faint)]">{item.company}</span>
                    <span className="inline-flex items-center text-[10.5px] font-bold rounded-md px-1.5 py-0.5 bg-[var(--dash-amber-wash)] text-[#8a5a1e] whitespace-nowrap">
                      {item.confidence}% · below threshold
                    </span>
                    <span className="font-mono text-[11px] text-[var(--dash-ink-faint)]">
                      {item.ticket}
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-[var(--dash-ink-soft)] leading-snug">
                    {item.summary}
                  </p>
                  <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--dash-accent-deep)] bg-[var(--dash-accent-wash)] rounded-md px-1.5 py-0.5">
                    <FileText className="w-3 h-3" />
                    {item.citation}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onApprove(item.id)}
                    className="h-8 px-3 rounded-lg text-[12px] font-semibold text-white bg-[var(--dash-sage)] hover:brightness-95 transition whitespace-nowrap"
                  >
                    Approve &amp; send
                  </button>
                  <button
                    type="button"
                    className="h-8 px-3 rounded-lg text-[12px] font-semibold text-[var(--dash-ink-soft)] border dash-border hover:dash-shadow-sm transition"
                  >
                    Edit
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
