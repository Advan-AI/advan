"use client"

import { motion } from "framer-motion"
import { Inbox, BrainCircuit, ShieldCheck, Send, ArrowRight } from "lucide-react"
import { SectionHeader } from "@/components/section-primitives"

const STEPS = [
  {
    icon: Inbox,
    title: "Ingest",
    body: "Pull every ticket, chat, email, and call across all channels into one unified inbox.",
    accent: "from-cyan-400/30 to-cyan-400/0",
    ring: "border-cyan-300/30",
    dot: "bg-cyan-300",
  },
  {
    icon: BrainCircuit,
    title: "Reason",
    body: "Match intent against your docs, KB, and ticket history with cited sources and live confidence.",
    accent: "from-violet-400/30 to-violet-400/0",
    ring: "border-violet-300/30",
    dot: "bg-violet-300",
  },
  {
    icon: ShieldCheck,
    title: "Verify",
    body: "Apply policy gates, redaction, and human-in-loop checks before any answer leaves your tenant.",
    accent: "from-blue-400/30 to-blue-400/0",
    ring: "border-blue-300/30",
    dot: "bg-blue-300",
  },
  {
    icon: Send,
    title: "Resolve",
    body: "Reply on the customer's channel, sync state to your CRM, and learn from every outcome.",
    accent: "from-emerald-400/30 to-emerald-400/0",
    ring: "border-emerald-300/30",
    dot: "bg-emerald-300",
  },
]

export function WorkflowSection() {
  return (
    <section id="workflow" className="relative py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Workflow"
          title={
            <>
              From inbound message to{" "}
              <span className="text-gradient-brand">resolved ticket</span> — in seconds
            </>
          }
          lede="Advan handles the full support loop: ingest, reason, verify, resolve. Every step is observable and reversible."
        />

        <div className="mt-16 relative">
          <div className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-cyan-400/0 via-cyan-400/30 to-emerald-400/0" aria-hidden />
          <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
            {STEPS.map((step, i) => (
              <motion.li
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="relative"
              >
                <div className="relative rounded-2xl glass p-6 h-full overflow-hidden group">
                  <div className={`absolute inset-0 bg-gradient-to-b ${step.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} aria-hidden />
                  <div className="relative">
                    <div className={`w-12 h-12 rounded-xl bg-white/[0.04] border ${step.ring} flex items-center justify-center mb-5`}>
                      <step.icon className="w-5 h-5 text-white/90" />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${step.dot}`} />
                      <span className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-medium font-mono">
                        Step {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                    <p className="text-sm text-white/60 leading-relaxed">{step.body}</p>
                  </div>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 flex items-center justify-center gap-2 text-sm text-white/55"
        >
          <span>End-to-end latency target</span>
          <ArrowRight className="w-4 h-4 text-cyan-300" />
          <span className="font-mono text-cyan-200">&lt; 4s p95</span>
        </motion.div>
      </div>
    </section>
  )
}
