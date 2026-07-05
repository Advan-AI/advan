"use client"

import { motion } from "framer-motion"
import { CheckCircle2, Flag, Copy } from "lucide-react"
import { SectionHeader } from "@/components/section-primitives"

const CARDS = [
  {
    index: "01",
    title: "Retrieve — approved knowledge only",
    body: "Only versioned docs, KB articles, and resolved tickets are eligible sources. Stale or unapproved content never reaches a customer.",
    footer: (
      <div className="flex flex-wrap gap-1.5">
        {["Docs v2.4", "KB · 1,204 articles", "Resolved tickets"].map((chip) => (
          <span
            key={chip}
            className="inline-flex items-center rounded-full bg-[#ECE9FB] px-2.5 py-1 text-[10.5px] font-semibold text-[#4E3FB6] whitespace-nowrap"
          >
            {chip}
          </span>
        ))}
      </div>
    ),
  },
  {
    index: "02",
    title: "Draft — cited and scored",
    body: "Every claim links back to its source. The reply gets a confidence score checked against your threshold — hallucination detection runs on every draft.",
    footer: (
      <div>
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/50">
          <span>Confidence</span>
          <span className="font-mono text-foreground/80">94%</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: "94%",
              background: "linear-gradient(90deg, #C5883C, #5C9A70)",
            }}
          />
        </div>
      </div>
    ),
  },
  {
    index: "03",
    title: "Gate — policy, people, proof",
    body: "Policy validation runs before send. Low-confidence replies route to a human reviewer. Everything lands in an immutable audit trail.",
    footer: (
      <div className="flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#E3EFE5] px-2.5 py-1 text-[10.5px] font-semibold text-[#2f5d3f] whitespace-nowrap">
          <CheckCircle2 className="w-3 h-3" /> Policy passed
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#F4E8D3] px-2.5 py-1 text-[10.5px] font-semibold text-[#8a5a1e] whitespace-nowrap">
          <Flag className="w-3 h-3" /> Human review
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] px-2.5 py-1 text-[10.5px] font-semibold text-foreground/60 whitespace-nowrap">
          <Copy className="w-3 h-3" /> Audit #A-2214
        </span>
      </div>
    ),
  },
]

export function HowItWorksSection() {
  return (
    <section id="how" className="relative py-14 lg:py-[88px] border-t border-black/[0.05]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="How it works"
          title={
            <>
              Every answer runs the same{" "}
              <span className="text-gradient-brand">governed pipeline</span>
            </>
          }
          lede="Three gates between a customer question and a sent reply. No answer skips a step."
        />

        <div className="mt-12 grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
          {CARDS.map((card, i) => (
            <motion.article
              key={card.index}
              initial={{ opacity: 0, y: 34 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.8, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="glass rounded-2xl p-6 lift flex flex-col gap-4"
            >
              <div className="font-mono text-[12px] font-bold tracking-[0.18em] text-[#4E3FB6]">
                {card.index}
              </div>
              <h3 className="text-lg font-semibold tracking-tight text-foreground leading-snug">
                {card.title}
              </h3>
              <p className="text-sm leading-relaxed text-foreground/60 flex-1">{card.body}</p>
              {card.footer}
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
