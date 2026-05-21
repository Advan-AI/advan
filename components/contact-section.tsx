"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowRight, Calendar, Sparkles } from "lucide-react"

const BOOKING_URL = "https://cal.com/day-nguyen"

const BULLETS = [
  "Walkthrough of your real ticket data",
  "Live confidence + reasoning trace demo",
  "Compliance review with your CISO",
  "Rollout plan and 30-day pilot scope",
]

export function ContactSection() {
  return (
    <section id="contact" className="relative py-14 lg:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-start">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-600 mb-5">
              <Sparkles className="w-3 h-3" />
              Talk to us
            </div>
            <h2 className="text-3xl lg:text-5xl font-semibold tracking-tight leading-[1.1] text-gradient">
              Ready for AI support your{" "}
              <span className="text-gradient-brand">whole team trusts?</span>
            </h2>
            <p className="mt-5 text-base lg:text-lg text-foreground/65 leading-relaxed max-w-md">
              Book 25 minutes with our team. We&apos;ll show Advan resolving real tickets, with every
              source and decision visible.
            </p>

            <ul className="mt-8 space-y-2.5">
              {BULLETS.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-foreground/75">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="relative rounded-3xl glass-strong p-8 lg:p-10"
          >
            <div className="absolute -inset-px rounded-3xl bg-gradient-to-b from-cyan-400/30 via-transparent to-transparent -z-10 blur-sm" aria-hidden />

            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl glass flex items-center justify-center">
                <Calendar className="w-4 h-4 text-cyan-600" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Book a 25-min demo</h3>
            </div>
            <p className="text-sm text-foreground/55 leading-relaxed mb-7">
              Free consultation. No commitment. SOC 2 + GDPR ready from day one.
            </p>

            <Button
              asChild
              size="lg"
              className="group w-full rounded-full bg-white text-slate-900 hover:bg-white/90 h-12 text-base font-medium shadow-[0_8px_32px_-8px_rgba(34,211,238,0.6)]"
            >
              <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
                Pick a time
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </Button>

            <p className="mt-4 text-xs text-foreground/40 text-center">
              Prefer email? Reach out at <span className="text-foreground/70">hello@advan.ai</span>
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
