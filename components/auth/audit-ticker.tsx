"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { auditEvents, type AuditTone } from "@/lib/demo-fixtures"

const TONE_CLASS: Record<AuditTone, string> = {
  sage: "bg-[#E3EFE5] text-[#2f5d3f]",
  violet: "bg-[#ECE9FB] text-[#4E3FB6]",
  amber: "bg-[#F4E8D3] text-[#8a5a1e]",
  blue: "bg-[#E1E9F3] text-[#244e8a]",
  rose: "bg-[#F1DFDE] text-[#9a4444]",
}

const ROTATE_MS = 2600
const VISIBLE = 4

/**
 * Live audit ticker for the sign-in trust panel. Rotates a window of events
 * from the fixture pool. Honors prefers-reduced-motion by rendering a static
 * window and skipping rotation.
 */
export function AuditTicker() {
  const [offset, setOffset] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }
    if (paused) return
    const id = setInterval(() => setOffset((o) => (o + 1) % auditEvents.length), ROTATE_MS)
    return () => clearInterval(id)
  }, [paused])

  const window_ = Array.from({ length: VISIBLE }, (_, i) => {
    const evt = auditEvents[(offset + i) % auditEvents.length]
    return { ...evt, key: `${offset}-${i}` }
  })

  return (
    <div
      className="rounded-2xl border border-white/10 bg-black/20 backdrop-blur-sm p-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-white/45">
          audit-trail / live
        </span>
        <span className="inline-flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#B6E2C2]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#7CD49B] dash-pulse-dot" />
          Streaming
        </span>
      </div>

      <ul className="space-y-2">
        <AnimatePresence initial={false} mode="popLayout">
          {window_.map((evt, i) => (
            <motion.li
              key={evt.key}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: i === VISIBLE - 1 ? 0.55 : 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-2.5 text-[11.5px]"
            >
              <span
                className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${TONE_CLASS[evt.tone]}`}
              >
                {evt.tag}
              </span>
              <span className="truncate text-white/70">{evt.text}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  )
}
