"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { BookOpenCheck, CheckCircle2, Gauge, ScrollText } from "lucide-react"
import { SectionHeader } from "@/components/section-primitives"

/**
 * Interactive "answer anatomy" — the transparency claim, experienced.
 * Clicking a citation chip opens the exact source passage the answer used.
 */

interface Source {
  id: number
  chip: string
  title: string
  meta: string
  quote: string
}

const SOURCES: Source[] = [
  {
    id: 1,
    chip: "¹ Order #48213 — Order history",
    title: "Order #48213 — Order history",
    meta: "order history · placed 3 days ago",
    quote:
      "Order #48213 shipped via FedEx on Tuesday and is currently in transit, with delivery estimated tomorrow.",
  },
  {
    id: 2,
    chip: "² Carrier tracking",
    title: "Carrier tracking — Shipping status",
    meta: "shipping status · live",
    quote:
      "Package last scanned at the regional facility; on schedule to arrive within the next-day delivery window.",
  },
  {
    id: 3,
    chip: "³ Return & refund policy",
    title: "Return & refund policy",
    meta: "company policy · v3",
    quote:
      "Orders that arrive later than the estimated delivery window qualify for free expedited re-shipping or a full refund.",
  },
]

const FEATURES = [
  {
    icon: BookOpenCheck,
    title: "Citations you can open",
    body: "Every claim links to the exact passage it was built from — one click away.",
  },
  {
    icon: Gauge,
    title: "Confidence against your threshold",
    body: "Each reply is scored; below your threshold, a human reviews before send.",
  },
  {
    icon: ScrollText,
    title: "An audit trail that exports",
    body: "Every gate, source, and decision is logged — and ships to your SIEM.",
  },
]

export function ReceiptsSection() {
  const [activeId, setActiveId] = useState<number | null>(1)
  const active = SOURCES.find((s) => s.id === activeId) ?? null

  return (
    <section id="receipts" className="relative py-14 lg:py-[88px] border-t border-black/[0.05]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 items-center">
          {/* Left: copy */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <SectionHeader
              align="left"
              eyebrow="The product"
              title={
                <>
                  Every answer ships with{" "}
                  <span className="text-gradient-brand">receipts</span>
                </>
              }
              lede="Click any citation to see the exact passage the answer was built from. Your agents, customers, and auditors see the same evidence."
            />
            <ul className="mt-8 space-y-5">
              {FEATURES.map((f) => {
                const Icon = f.icon
                return (
                  <li key={f.title} className="flex items-start gap-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ECE9FB]">
                      <Icon className="h-[18px] w-[18px] text-[#4E3FB6]" aria-hidden />
                    </span>
                    <div>
                      <div className="text-[15px] font-semibold text-foreground">{f.title}</div>
                      <p className="mt-0.5 text-sm leading-relaxed text-foreground/60">{f.body}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </motion.div>

          {/* Right: answer card */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            data-testid="receipts-card"
            className="relative rounded-3xl border border-black/[0.08] bg-white/85 backdrop-blur-xl shadow-[0_24px_70px_-32px_rgba(60,50,30,0.30)] overflow-hidden"
          >
            <div
              aria-hidden
              className="absolute -inset-5 -z-10 rounded-[2rem] bg-[radial-gradient(circle_at_20%_15%,rgba(107,92,214,0.16),transparent_36%),radial-gradient(circle_at_85%_85%,rgba(25,120,105,0.13),transparent_34%)] blur-2xl"
            />

            {/* Header */}
            <div className="flex flex-wrap items-center gap-2 px-5 py-3.5 border-b border-black/[0.06] bg-white/50">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/55 whitespace-nowrap">
                Answer · Ticket #48213
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#E3EFE5] px-2.5 py-1 text-[10.5px] font-bold text-[#2f5d3f] whitespace-nowrap">
                <CheckCircle2 className="w-3 h-3" />
                94% · above threshold
              </span>
            </div>

            <div className="p-5">
              <p className="text-[14px] leading-relaxed text-foreground/85">
                Good news — your order shipped and is on track for delivery
                tomorrow<sup>1</sup>. Tracking shows it&apos;s moving through
                the network on schedule<sup>2</sup>. Since it&apos;s running a
                day behind our estimate, you qualify for free expedited
                re-shipping if it doesn&apos;t arrive by then<sup>3</sup>.
              </p>

              {/* Citation chips */}
              <div className="mt-4 flex flex-wrap gap-2">
                {SOURCES.map((s) => {
                  const isActive = s.id === activeId
                  return (
                    <button
                      key={s.id}
                      type="button"
                      data-testid={`citation-${s.id}`}
                      aria-expanded={isActive}
                      onClick={() => setActiveId(isActive ? null : s.id)}
                      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[11.5px] font-semibold whitespace-nowrap transition-all ${
                        isActive
                          ? "bg-[#E0DBF8] border-[#6B5CD6] text-[#4E3FB6]"
                          : "bg-[#F0EDFB] border-transparent text-[#4E3FB6] hover:border-[#6B5CD6]/40"
                      }`}
                    >
                      {s.chip}
                    </button>
                  )
                })}
              </div>

              {/* Source preview panel */}
              <div
                data-testid="source-preview"
                className="grid transition-[grid-template-rows] duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ gridTemplateRows: active ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  {active && (
                    <div className="mt-4 rounded-xl border border-black/[0.06] bg-[#FBF9F3] p-4">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-[13px] font-semibold text-foreground">
                          {active.title}
                        </span>
                        <span className="font-mono text-[11px] text-foreground/50">
                          {active.meta}
                        </span>
                      </div>
                      <blockquote className="mt-2.5 border-l-2 border-[#6B5CD6] pl-3.5 text-[13px] leading-relaxed text-foreground/70 italic">
                        “{active.quote}”
                      </blockquote>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3 border-t border-black/[0.06] bg-white/50 text-[11px] text-foreground/55">
              {["Policy validated", "PII clean", "Hallucination check passed"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1 whitespace-nowrap">
                  <CheckCircle2 className="w-3 h-3 text-[#5C9A70]" />
                  {t}
                </span>
              ))}
              <span className="font-mono whitespace-nowrap">audit #A-2214</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
