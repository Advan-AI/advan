"use client"

import { motion } from "framer-motion"
import { ShieldCheck, Eye, FileCheck, Lock, KeyRound, ScrollText } from "lucide-react"
import { SectionHeader, GlassCard } from "@/components/section-primitives"

const PILLARS = [
  {
    icon: Eye,
    title: "Every answer is sourced",
    body: "Each reply links to the exact doc, KB article, or ticket it came from. Click to inspect. Nothing is fabricated.",
    glow: "cyan" as const,
  },
  {
    icon: ShieldCheck,
    title: "Confidence before send",
    body: "Live confidence scoring with configurable thresholds. Low-confidence answers route to a human, not the customer.",
    glow: "blue" as const,
  },
  {
    icon: FileCheck,
    title: "Auditable by default",
    body: "Full reasoning traces, prompts, retrievals, and policy decisions logged per ticket. Export to SIEM in one click.",
    glow: "violet" as const,
  },
  {
    icon: Lock,
    title: "Tenant-isolated",
    body: "Your data never trains shared models. VPC peering, BYOK encryption, and EU/US residency options available.",
    glow: "green" as const,
  },
]

const BADGES = ["SOC 2 Type II", "GDPR", "HIPAA-ready", "ISO 27001", "BYOK"]

export function TrustSection() {
  return (
    <section id="trust" className="relative py-14 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Enterprise trust"
          title={
            <>
              The AI you can{" "}
              <span className="text-gradient-brand">explain to your CISO</span>
            </>
          }
          lede="Advan was built for regulated, high-stakes support. Transparency, traceability, and control are first-class — not bolt-ons."
        />

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
            >
              <GlassCard glow={p.glow} className="h-full">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl glass flex items-center justify-center shrink-0">
                    <p.icon className="w-5 h-5 text-cyan-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-1.5">{p.title}</h3>
                    <p className="text-sm text-foreground/60 leading-relaxed">{p.body}</p>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-wrap gap-2.5 justify-center"
        >
          {BADGES.map((b) => (
            <span
              key={b}
              className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs font-medium text-foreground/75"
            >
              <KeyRound className="w-3 h-3 text-cyan-500" />
              {b}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
