"use client"

import { motion } from "framer-motion"
import { ArrowRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

const BOOKING_URL = "https://cal.com/day-nguyen"

export function FinalCTA() {
  return (
    <section id="cta" className="relative py-24 lg:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="relative isolate overflow-hidden rounded-3xl glass-strong p-10 lg:p-16 text-center"
        >
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.08] via-transparent to-violet-500/[0.08]" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-cyan-500/15 blur-3xl" />
            <div className="absolute -bottom-20 left-1/4 w-[400px] h-[300px] rounded-full bg-violet-500/10 blur-3xl" />
          </div>
          <div className="absolute inset-0 -z-10 grid-bg [mask-image:radial-gradient(circle_at_center,black_20%,transparent_70%)]" aria-hidden />

          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs font-medium text-cyan-200 mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            Ship explainable AI support in two weeks
          </div>

          <h2 className="text-4xl lg:text-6xl font-semibold tracking-tight leading-[1.05] text-gradient max-w-3xl mx-auto">
            See Advan resolve a ticket{" "}
            <span className="text-gradient-brand">live, with sources</span>
          </h2>

          <p className="mt-5 text-base lg:text-lg text-white/65 max-w-xl mx-auto leading-relaxed">
            Book a 25-minute call. We&apos;ll walk through your real tickets and show the reasoning
            behind every answer.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              asChild
              size="lg"
              className="group rounded-full bg-white text-slate-900 hover:bg-white/90 h-12 px-7 text-base font-medium shadow-[0_8px_32px_-8px_rgba(34,211,238,0.6)]"
            >
              <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
                Book a demo
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-full h-12 px-7 text-base font-medium border-white/15 bg-white/[0.03] hover:bg-white/[0.06] text-white hover:text-white"
            >
              <a href="#contact">Talk to sales</a>
            </Button>
          </div>

          <p className="mt-6 text-xs text-white/45">
            No card. No commitment. SOC 2 + GDPR ready from day one.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
