"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, Sparkles, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

const BOOKING_URL = "https://cal.com/day-nguyen"

const PROOF = [
  "Live demo on your real tickets",
  "Source-cited answers from day one",
  "SOC 2 + GDPR · EU residency available",
]

export function FinalCTA() {
  return (
    <section id="cta" className="relative py-14 lg:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative isolate overflow-hidden rounded-3xl p-10 lg:p-16 text-center"
          style={{
            background:
              "linear-gradient(180deg, #2A2520 0%, #1c1814 100%)",
          }}
        >
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[360px] rounded-full bg-[#6B5CD6]/35 blur-3xl" />
            <div className="absolute -bottom-20 left-1/4 w-[400px] h-[320px] rounded-full bg-[#5C9A70]/20 blur-3xl" />
            <div className="absolute top-10 -right-20 w-[400px] h-[300px] rounded-full bg-[#C5883C]/15 blur-3xl" />
          </div>
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "64px 64px",
              maskImage:
                "radial-gradient(ellipse at center, black 30%, transparent 70%)",
            }}
          />

          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#E1D8FA] mb-7 border border-white/10">
            <Sparkles className="w-3 h-3 text-[#C8BEFF]" />
            Live in under 2 weeks
          </div>

          <h2 className="text-4xl lg:text-[56px] font-bold tracking-[-0.02em] leading-[1.05] text-white max-w-3xl mx-auto">
            See Advan resolve a ticket{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #C8BEFF 0%, #FFFFFF 55%, #B6E2C2 100%)",
              }}
            >
              live, with sources
            </span>
          </h2>

          <p className="mt-5 text-base lg:text-lg text-white/70 max-w-xl mx-auto leading-relaxed">
            Start free on your own tickets today, or book a 25-minute call and
            we&apos;ll walk through the reasoning behind every answer.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              asChild
              size="lg"
              className="group rounded-full bg-white text-[#1c1814] hover:bg-white/95 hover:-translate-y-px h-12 px-7 text-[15px] font-semibold shadow-[0_18px_42px_-14px_rgba(0,0,0,0.55)] transition-all whitespace-nowrap"
            >
              <Link href="/signin">
                Start free trial
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-full h-12 px-7 text-[15px] font-semibold border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-white hover:text-white backdrop-blur transition-all whitespace-nowrap"
            >
              <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
                Book a demo
              </a>
            </Button>
          </div>

          {/* Proof row */}
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12.5px] text-white/65">
            {PROOF.map((p) => (
              <li key={p} className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#7CD49B]" />
                {p}
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  )
}
