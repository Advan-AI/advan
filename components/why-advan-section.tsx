"use client"

import { motion } from "framer-motion"
import { Zap, Eye, Users, Rocket } from "lucide-react"
import { SectionHeader } from "@/components/section-primitives"

const PILLARS = [
  {
    icon: Zap,
    title: "Faster resolution",
    body: "Resolve customer questions instantly without increasing support headcount.",
  },
  {
    icon: Eye,
    title: "Transparent AI",
    body: "Every response includes a confidence score, source citations, and a policy check.",
  },
  {
    icon: Users,
    title: "Human + AI copilot",
    body: "Routine questions are handled automatically. Complex cases are escalated to a human agent.",
  },
  {
    icon: Rocket,
    title: "Built for growing SaaS teams",
    body: "Affordable and simple to deploy — built for growing B2B SaaS companies, not just large enterprises.",
  },
]

export function WhyAdvanSection() {
  return (
    <section id="why" className="relative py-14 lg:py-[88px] border-t border-black/[0.05]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Why Advan"
          title={
            <>
              Most AI support tools optimize for automation.{" "}
              <span className="text-gradient-brand">Advan optimizes for trust.</span>
            </>
          }
          lede="Every response is explainable and verifiable, so you can deliver faster support without sacrificing quality."
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {PILLARS.map((pillar, i) => {
            const Icon = pillar.icon
            return (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.7, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-2xl border border-black/[0.08] bg-white/60 p-7 lift"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ECE9FB] text-[#4E3FB6]">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-foreground">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground/62">{pillar.body}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
