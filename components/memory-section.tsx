"use client"

import { motion } from "framer-motion"
import { Mail, MessageCircle, Phone, Slack, Globe, ArrowRight } from "lucide-react"
import { SectionHeader } from "@/components/section-primitives"

const CHANNELS = [
  { icon: Mail, label: "Email", color: "text-cyan-300", ring: "border-cyan-400/30" },
  { icon: MessageCircle, label: "Chat", color: "text-violet-300", ring: "border-violet-400/30" },
  { icon: Phone, label: "Voice", color: "text-emerald-300", ring: "border-emerald-400/30" },
  { icon: Slack, label: "Slack", color: "text-amber-300", ring: "border-amber-400/30" },
  { icon: Globe, label: "Web", color: "text-blue-300", ring: "border-blue-400/30" },
]

export function MemorySection() {
  return (
    <section id="memory" className="relative py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Cross-channel memory"
          title={
            <>
              One customer, one memory —{" "}
              <span className="text-gradient-brand">across every channel</span>
            </>
          }
          lede="Conversations don't reset when a customer switches from chat to email to a call. Advan keeps full context — entitlements, history, tone — wherever they reach you."
        />

        <div className="mt-16 relative">
          <div className="relative rounded-3xl glass-strong overflow-hidden">
            <div className="absolute inset-0 grid-bg opacity-30 [mask-image:radial-gradient(circle_at_center,black_30%,transparent_70%)]" aria-hidden />
            <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-8 lg:gap-12 p-8 lg:p-12 items-center">
              <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-3 gap-3">
                {CHANNELS.map((c, i) => (
                  <motion.div
                    key={c.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.08 }}
                    className={`aspect-square rounded-xl glass border ${c.ring} flex flex-col items-center justify-center gap-1.5`}
                  >
                    <c.icon className={`w-5 h-5 ${c.color}`} />
                    <span className="text-[11px] font-medium text-foreground/70">{c.label}</span>
                  </motion.div>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex flex-col items-center gap-2"
              >
                <div className="hidden lg:block w-10 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400/30 to-violet-500/30 border border-white/15 flex items-center justify-center shadow-[0_0_40px_-8px_rgba(34,211,238,0.6)]">
                  <div className="w-3 h-3 rounded-full bg-cyan-300 animate-pulse" />
                  <div className="absolute inset-0 rounded-2xl border border-cyan-300/30 animate-ping" />
                </div>
                <span className="text-[11px] uppercase tracking-[0.18em] text-foreground/50 font-mono">unified memory</span>
                <div className="hidden lg:block w-10 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
              </motion.div>

              <div className="space-y-3">
                <ContextCard
                  label="Profile"
                  body="Maria Lopez · Acme · Enterprise · CSM: Jordan"
                />
                <ContextCard
                  label="Open issues"
                  body="Webhook signature rotation · Billing FX mismatch"
                />
                <ContextCard
                  label="Tone preference"
                  body="Concise, technical, code-first replies"
                />
                <ContextCard
                  label="Last touch"
                  body="2h ago · Slack · resolved by Advan"
                />
              </div>
            </div>
          </div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8 flex items-center justify-center gap-2 text-sm text-foreground/55"
        >
          <span>Context retention</span>
          <ArrowRight className="w-4 h-4 text-cyan-500" />
          <span className="font-mono text-cyan-600">100% across handoffs</span>
        </motion.p>
      </div>
    </section>
  )
}

function ContextCard({ label, body }: { label: string; body: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="rounded-lg glass px-3 py-2.5"
    >
      <div className="text-[10px] uppercase tracking-wider text-foreground/40 font-medium">{label}</div>
      <div className="mt-0.5 text-xs text-foreground/85 leading-relaxed">{body}</div>
    </motion.div>
  )
}
