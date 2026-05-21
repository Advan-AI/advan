"use client"

import { motion } from "framer-motion"
import {
  ArrowRight,
  ChevronDown,
  ShieldCheck,
  BookOpen,
  Activity,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { TapBoxSimulator } from "@/components/tap-box-simulator"

const BOOKING_URL = "https://cal.com/day-nguyen"

export function HeroSection() {
  return (
    <section
      id="hero"
      className="relative isolate overflow-hidden pt-20 pb-14 lg:pt-24 lg:pb-20"
      aria-label="Hero"
    >
      <HeroBackdrop />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center">
          <HeroCopy />
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-8 -z-10 rounded-[2.5rem] bg-gradient-to-br from-[#6B5CD6]/12 via-[#8E80E5]/8 to-[#5C9A70]/10 blur-3xl"
            />
            <TapBoxSimulator />
          </div>
        </div>
      </div>
    </section>
  )
}

function HeroBackdrop() {
  return (
    <>
      <div
        className="absolute inset-0 -z-20"
        style={{ background: "hsl(40 32% 86%)" }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(1200px 700px at 80% -10%, rgba(107,92,214,0.10), transparent 60%), radial-gradient(900px 600px at -5% 110%, rgba(92,154,112,0.10), transparent 55%)",
          }}
        />
      </div>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 grid-bg [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
      />
    </>
  )
}

function HeroCopy() {
  return (
    <div className="relative">
      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        className="text-[44px] sm:text-5xl lg:text-[58px] xl:text-[64px] font-bold tracking-[-0.02em] leading-[1.04] text-foreground"
      >
        Transparent AI Support
        <br />
        for{" "}
        <span className="text-gradient-brand">Better Customer Experiences</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15 }}
        className="mt-6 text-lg lg:text-xl text-foreground/65 max-w-xl leading-[1.55]"
      >
        Resolve tickets in seconds — not minutes. Every answer is sourced,
        scored, and explainable, so customers trust the AI and your team keeps
        full context across every channel.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.25 }}
        className="mt-9 flex flex-col sm:flex-row gap-3"
      >
        <Button
          size="lg"
          asChild
          className="group relative rounded-full bg-[#6B5CD6] hover:bg-[#4E3FB6] text-white h-12 px-7 text-[15px] font-semibold shadow-[0_12px_32px_-10px_rgba(107,92,214,0.55)] hover:-translate-y-px hover:shadow-[0_18px_42px_-12px_rgba(107,92,214,0.6)] transition-all"
        >
          <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
            Book a demo
            <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </a>
        </Button>
        <Button
          size="lg"
          variant="outline"
          asChild
          className="rounded-full h-12 px-7 text-[15px] font-semibold border-black/12 bg-white/60 hover:bg-white text-foreground hover:text-foreground backdrop-blur transition-all"
        >
          <a href="#workflow">
            See how it works
            <ChevronDown className="ml-2 w-4 h-4" />
          </a>
        </Button>
      </motion.div>

      <motion.ul
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.35 }}
        className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-foreground/65"
      >
        <li className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#5C9A70]" />
          SOC 2 + GDPR ready
        </li>
        <li className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#6B5CD6]" />
          Source-cited answers
        </li>
        <li className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#6B5CD6]" />
          Live confidence scoring
        </li>
      </motion.ul>
    </div>
  )
}
