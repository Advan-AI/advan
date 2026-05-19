"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, ChevronDown, Sparkles, ShieldCheck, BookOpen, Activity, MessageSquare, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TapBoxSimulator } from "@/components/tap-box-simulator"

const BOOKING_URL = "https://cal.com/day-nguyen"

export function HeroSection() {
  return (
    <section
      id="hero"
      className="relative isolate overflow-hidden pt-28 pb-24 lg:pt-36 lg:pb-32"
      aria-label="Hero"
    >
      <HeroBackdrop />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center">
          <HeroCopy />
          <div className="relative">
            <div className="absolute -inset-8 -z-10 rounded-[2.5rem] bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-violet-500/10 blur-3xl" aria-hidden />
            <TapBoxSimulator />
          </div>
        </div>

        <HeroTrustRow />
      </div>
    </section>
  )
}

function HeroBackdrop() {
  return (
    <>
      <div className="absolute inset-0 -z-20">
        <div className="absolute inset-0 bg-gradient-to-b from-[#070a0f] via-[#0a0f17] to-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] rounded-full bg-gradient-to-b from-cyan-500/15 via-blue-500/10 to-transparent blur-3xl" />
        <div className="absolute top-40 -left-40 w-[480px] h-[480px] rounded-full bg-violet-500/10 blur-[100px]" />
        <div className="absolute bottom-0 -right-32 w-[480px] h-[480px] rounded-full bg-cyan-500/10 blur-[100px]" />
      </div>
      <div className="absolute inset-0 -z-10 grid-bg [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" aria-hidden />
    </>
  )
}

function HeroCopy() {
  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs font-medium text-white/80 mb-6"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
        </span>
        Now live: Explainable AI for Customer Support
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.05 }}
        className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-semibold tracking-tight leading-[1.05] text-gradient"
      >
        Transparent AI Support
        <br />
        for{" "}
        <span className="text-gradient-brand font-semibold">
          Better Customer Experiences
        </span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15 }}
        className="mt-6 text-lg lg:text-xl text-white/65 max-w-xl leading-relaxed"
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
          className="group relative overflow-hidden rounded-full bg-white text-slate-900 hover:bg-white/90 h-12 px-7 text-base font-medium shadow-[0_8px_32px_-8px_rgba(34,211,238,0.6)] transition-all"
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
          className="rounded-full h-12 px-7 text-base font-medium border-white/15 bg-white/[0.03] hover:bg-white/[0.06] text-white hover:text-white"
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
        className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/55"
      >
        <li className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          SOC 2 + GDPR ready
        </li>
        <li className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          Source-cited answers
        </li>
        <li className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          Live confidence scoring
        </li>
      </motion.ul>
    </div>
  )
}

function HeroTrustRow() {
  const logos = ["Linear", "Notion", "Vercel", "Stripe", "Loom", "Ramp"]
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7 }}
      className="mt-20 lg:mt-28"
    >
      <p className="text-center text-xs uppercase tracking-[0.2em] text-white/40">
        Trusted by modern support teams
      </p>
      <div className="mt-6 grid grid-cols-3 sm:grid-cols-6 gap-6 items-center justify-items-center">
        {logos.map((logo) => (
          <div key={logo} className="text-white/40 hover:text-white/70 transition-colors text-base font-medium tracking-tight">
            {logo}
          </div>
        ))}
      </div>
    </motion.div>
  )
}
