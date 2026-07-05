"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Copy } from "lucide-react"
import { auditEvents, type AuditTone } from "@/lib/demo-fixtures"

const TONE_CLASS: Record<AuditTone, string> = {
  sage: "bg-[var(--dash-sage-wash)] text-[#2f5d3f]",
  violet: "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]",
  amber: "bg-[var(--dash-amber-wash)] text-[#8a5a1e]",
  blue: "bg-[var(--dash-blue-wash)] text-[#244e8a]",
  rose: "bg-[var(--dash-rose-wash)] text-[#9a4444]",
}

const ROTATE_MS = 3000
const VISIBLE = 4

/**
 * Live audit trail card for the dashboard right rail — light-theme sibling of
 * the sign-in AuditTicker, sharing the same fixture pool.
 */
export function AuditTrailCard() {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }
    const id = setInterval(() => setOffset((o) => (o + 1) % auditEvents.length), ROTATE_MS)
    return () => clearInterval(id)
  }, [])

  const window_ = Array.from({ length: VISIBLE }, (_, i) => {
    const evt = auditEvents[(offset + i) % auditEvents.length]
    return { ...evt, key: `${offset}-${i}` }
  })

  return (
    <div className="dash-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b dash-border-soft">
        <span className="text-[var(--dash-accent)]">
          <Copy className="w-[18px] h-[18px]" />
        </span>
        <span className="text-[14px] font-bold text-[var(--dash-ink)]">Audit trail</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#2f5d3f]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--dash-sage)] dash-pulse-dot" />
          Streaming
        </span>
      </div>
      <ul className="p-3 space-y-2">
        <AnimatePresence initial={false} mode="popLayout">
          {window_.map((evt, i) => (
            <motion.li
              key={evt.key}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: i === VISIBLE - 1 ? 0.5 : 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-2.5 text-[11.5px]"
            >
              <span
                className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${TONE_CLASS[evt.tone]}`}
              >
                {evt.tag}
              </span>
              <span className="truncate text-[var(--dash-ink-soft)]">{evt.text}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  )
}
