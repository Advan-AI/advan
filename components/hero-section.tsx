"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
  ArrowRight,
  CheckCircle2,
  DatabaseZap,
  FileCheck2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { CountUp } from "@/components/count-up"
import { TrustEngineDemo } from "@/components/trust-engine-demo"

const BOOKING_URL = "https://cal.com/day-nguyen"

const OUTCOMES = [
  { value: 42, label: "Faster Resolution", note: "p95 response time down" },
  { value: 78, label: "Fewer Escalations", note: "for approved intents" },
  { value: 92, label: "Source-Cited Responses", note: "with visible citations" },
  { value: 50, label: "Fewer Repeated Explanations", note: "across channels" },
]

const TRUST_SIGNALS = [
  { icon: DatabaseZap, label: "Answers only from approved, versioned knowledge" },
  { icon: FileCheck2, label: "Every claim cited, every reply confidence-scored" },
  { icon: LockKeyhole, label: "Immutable audit trail on every interaction" },
]

export function HeroSection() {
  return (
    <section
      id="hero"
      className="relative isolate overflow-hidden pt-24 pb-12 sm:pt-28 lg:pt-32 lg:pb-18"
      aria-label="Advan AI hero"
    >
      <HeroBackdrop />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12 xl:gap-16 items-center">
          <HeroCopy />
          <motion.div
            initial={{ opacity: 0, y: 26, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div
              aria-hidden
              className="absolute -inset-5 -z-10 rounded-[2rem] bg-[radial-gradient(circle_at_30%_20%,rgba(107,92,214,0.20),transparent_34%),radial-gradient(circle_at_90%_30%,rgba(25,120,105,0.16),transparent_32%),radial-gradient(circle_at_55%_90%,rgba(197,136,60,0.16),transparent_35%)] blur-2xl"
            />
            <TrustEngineDemo />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55 }}
          className="mt-10 lg:mt-12 grid grid-cols-2 lg:grid-cols-4 overflow-hidden rounded-2xl border border-black/[0.07] bg-white/72 shadow-[0_18px_55px_-35px_rgba(34,31,25,0.45)] backdrop-blur"
        >
          {OUTCOMES.map((outcome, index) => (
            <div
              key={outcome.label}
              className={`p-4 sm:p-5 ${index !== 0 ? "lg:border-l border-black/[0.06]" : ""} ${
                index >= 2 ? "border-t lg:border-t-0 border-black/[0.06]" : ""
              }`}
            >
              <div className="flex items-baseline gap-2">
                <CountUp
                  value={outcome.value}
                  suffix="%"
                  className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#19201d]"
                />
                <CheckCircle2 className="h-4 w-4 text-[#197869]" aria-hidden />
              </div>
              <div className="mt-1 text-[12px] font-bold uppercase tracking-[0.13em] text-[#29332f]/70">
                {outcome.label}
              </div>
              <div className="mt-1 text-xs text-foreground/55">{outcome.note}</div>
            </div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.7 }}
          className="mt-3 text-center text-[11.5px] leading-relaxed text-foreground/45 lg:text-left"
        >
          Aggregate results across Advan pilot deployments (90-day window). Full
          measurement methodology available on request.
        </motion.p>
      </div>
    </section>
  )
}

function HeroCopy() {
  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65 }}
        className="inline-flex items-center gap-2 rounded-full border border-[#197869]/20 bg-[#eef8f4] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#146457] whitespace-nowrap"
      >
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        Trust engine live on every answer
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.75, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        className="mt-6 max-w-2xl text-[40px] font-semibold leading-[1.04] tracking-tight text-[#171a17] sm:text-5xl lg:text-[54px] xl:text-[60px]"
      >
        AI customer support that{" "}
        <span
          className="bg-clip-text text-transparent"
          style={{
            backgroundImage:
              "linear-gradient(135deg, #4E3FB6 0%, #6B5CD6 55%, #197869 110%)",
          }}
        >
          shows its work
        </span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.18 }}
        className="mt-6 max-w-xl text-base leading-8 text-foreground/68 sm:text-lg"
      >
        Advan answers customers from your approved knowledge only — every reply
        cited, confidence-scored, policy-checked, and logged. When the AI
        isn&apos;t sure, a human is.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.28 }}
        className="mt-8 flex flex-col gap-3 sm:flex-row"
      >
        <Button
          size="lg"
          asChild
          className="group h-12 rounded-full bg-[#171a17] px-6 text-[15px] font-semibold text-white shadow-[0_14px_34px_-18px_rgba(23,26,23,0.55)] transition-all hover:-translate-y-px hover:bg-[#29332f] whitespace-nowrap"
        >
          <Link href="/signin">
            Start free trial
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Button>
        <Button
          size="lg"
          variant="outline"
          asChild
          className="h-12 rounded-full border-black/10 bg-white/70 px-6 text-[15px] font-semibold text-foreground backdrop-blur transition-all hover:bg-white whitespace-nowrap"
        >
          <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
            Book a demo
          </a>
        </Button>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.36 }}
        className="mt-3 text-[12.5px] text-foreground/50"
      >
        14 days free · No credit card · Live in under 2 weeks
      </motion.p>

      <motion.ul
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.42 }}
        className="mt-8 grid gap-3 sm:max-w-xl"
      >
        {TRUST_SIGNALS.map((item) => {
          const Icon = item.icon
          return (
            <li
              key={item.label}
              className="flex items-center gap-3 text-sm font-medium text-foreground/72"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black/[0.06] bg-white/72">
                <Icon className="h-4 w-4 text-[#4e3fb6]" aria-hidden />
              </span>
              {item.label}
            </li>
          )
        })}
      </motion.ul>
    </div>
  )
}

function HeroBackdrop() {
  return (
    <>
      <div
        className="absolute inset-0 -z-20"
        style={{ background: "linear-gradient(180deg, #F0EADC 0%, #EDE7DA 100%)" }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-90"
        style={{
          background:
            "radial-gradient(760px 420px at 12% 18%, rgba(25,120,105,0.14), transparent 62%), radial-gradient(820px 520px at 88% 12%, rgba(107,92,214,0.16), transparent 58%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[620px] opacity-[0.16]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(23,26,23,0.45) 1px, transparent 1px), linear-gradient(90deg, rgba(23,26,23,0.45) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "linear-gradient(180deg, black, transparent)",
        }}
      />
      <motion.div
        aria-hidden
        initial={{ opacity: 0, x: -18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1.1 }}
        className="absolute left-0 top-32 -z-10 hidden h-px w-full bg-gradient-to-r from-transparent via-[#197869]/40 to-transparent lg:block"
      />
      <motion.div
        aria-hidden
        initial={{ opacity: 0, x: 18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1.1, delay: 0.2 }}
        className="absolute left-0 top-[390px] -z-10 hidden h-px w-full bg-gradient-to-r from-transparent via-[#6b5cd6]/35 to-transparent lg:block"
      />
    </>
  )
}
