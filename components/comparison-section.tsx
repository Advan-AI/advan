"use client"

import { motion } from "framer-motion"
import { Check, X, Sparkles } from "lucide-react"
import { SectionHeader } from "@/components/section-primitives"

const ROWS = [
  { feature: "Source-cited answers", legacy: false, basic: "partial", advan: true },
  { feature: "Live confidence scoring", legacy: false, basic: false, advan: true },
  { feature: "Cross-channel memory", legacy: false, basic: "partial", advan: true },
  { feature: "Full reasoning audit log", legacy: false, basic: false, advan: true },
  { feature: "Human-in-loop policy gates", legacy: "partial", basic: "partial", advan: true },
  { feature: "Tenant-isolated training", legacy: false, basic: false, advan: true },
  { feature: "p95 resolution < 4s", legacy: false, basic: false, advan: true },
]

export function ComparisonSection() {
  return (
    <section id="comparison" className="relative py-14 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Why Advan"
          title={
            <>
              Most AI support tools are a{" "}
              <span className="text-gradient-brand">black box</span>. Advan isn't.
            </>
          }
          lede="See exactly where the answer came from, why the model is confident, and what happens when it isn't."
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mt-14 rounded-2xl glass-strong overflow-hidden"
        >
          <div className="grid grid-cols-4 px-5 py-4 border-b border-black/[0.06] text-[11px] uppercase tracking-[0.18em] text-foreground/40 font-medium">
            <div>Capability</div>
            <div className="text-center">Legacy ticketing</div>
            <div className="text-center">Generic AI bots</div>
            <div className="text-center">
              <span className="inline-flex items-center gap-1 text-cyan-600">
                <Sparkles className="w-3 h-3" />
                Advan
              </span>
            </div>
          </div>
          {ROWS.map((row, i) => (
            <motion.div
              key={row.feature}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className={`grid grid-cols-4 px-5 py-4 items-center text-sm ${
                i % 2 === 0 ? "bg-black/[0.015]" : ""
              }`}
            >
              <div className="text-foreground/85">{row.feature}</div>
              <div className="flex justify-center">
                <Cell value={row.legacy} />
              </div>
              <div className="flex justify-center">
                <Cell value={row.basic} />
              </div>
              <div className="flex justify-center">
                <Cell value={row.advan} highlight />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

function Cell({ value, highlight = false }: { value: boolean | "partial"; highlight?: boolean }) {
  if (value === true) {
    return (
      <span
        className={`inline-flex w-6 h-6 rounded-full items-center justify-center ${
          highlight ? "bg-cyan-500/15 border border-cyan-500/40" : "bg-emerald-500/10 border border-emerald-500/25"
        }`}
      >
        <Check className={`w-3.5 h-3.5 ${highlight ? "text-cyan-600" : "text-emerald-600"}`} />
      </span>
    )
  }
  if (value === "partial") {
    return <span className="text-xs text-amber-600 font-medium">Partial</span>
  }
  return (
    <span className="inline-flex w-6 h-6 rounded-full items-center justify-center bg-black/[0.03] border border-black/10">
      <X className="w-3.5 h-3.5 text-foreground/35" />
    </span>
  )
}
