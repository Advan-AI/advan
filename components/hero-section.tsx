"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, CheckCircle2, FileCheck2, Gauge, UserCheck } from "lucide-react"
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
  { icon: Gauge, label: "Confidence-scored, so you know how sure the AI is" },
  { icon: FileCheck2, label: "Source-cited and policy-checked on every reply" },
  { icon: UserCheck, label: "Handed to a human whenever it isn't sure" },
]

export function HeroSection() {
  return (
    <section
      id="hero"
      className="relative pt-28 pb-14 sm:pt-32 lg:pt-40 lg:pb-20"
      aria-label="Advan AI hero"
    >
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 xl:gap-20 items-center">
          <HeroCopy />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <TrustEngineDemo />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-14 lg:mt-16 grid grid-cols-2 lg:grid-cols-4 overflow-hidden rounded-2xl border border-black/[0.08] bg-white/60"
        >
          {OUTCOMES.map((outcome, index) => (
            <div
              key={outcome.label}
              className={`p-5 sm:p-6 ${index !== 0 ? "lg:border-l border-black/[0.07]" : ""} ${
                index >= 2 ? "border-t lg:border-t-0 border-black/[0.07]" : ""
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
          transition={{ duration: 0.6, delay: 0.65 }}
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
      <motion.h1
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-2xl text-[38px] font-semibold leading-[1.08] tracking-tight text-[#171a17] sm:text-5xl lg:text-[52px] xl:text-[56px]"
      >
        Transparent AI support for{" "}
        <span
          className="bg-clip-text text-transparent"
          style={{
            backgroundImage:
              "linear-gradient(135deg, #4E3FB6 0%, #6B5CD6 55%, #197869 110%)",
          }}
        >
          better customer experiences
        </span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.12 }}
        className="mt-6 max-w-xl text-base leading-8 text-foreground/68 sm:text-lg"
      >
        Advan helps teams automate customer support with transparent AI that
        delivers faster, trusted responses at lower cost.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.22 }}
        className="mt-8 flex flex-col gap-3 sm:flex-row"
      >
        <Button
          size="lg"
          asChild
          className="group h-12 rounded-full bg-[#171a17] px-6 text-[15px] font-semibold text-white transition-all hover:-translate-y-px hover:bg-[#29332f] whitespace-nowrap"
        >
          <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
            Book a demo
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        </Button>
        <Button
          size="lg"
          variant="outline"
          asChild
          className="h-12 rounded-full border-black/10 bg-white/70 px-6 text-[15px] font-semibold text-foreground transition-all hover:bg-white whitespace-nowrap"
        >
          <Link href="/signin">Start free trial</Link>
        </Button>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mt-3 text-[12.5px] text-foreground/50"
      >
        14 days free · No credit card · Live in under 2 weeks
      </motion.p>

      <motion.ul
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.36 }}
        className="mt-9 grid gap-3 sm:max-w-xl"
      >
        {TRUST_SIGNALS.map((item) => {
          const Icon = item.icon
          return (
            <li
              key={item.label}
              className="flex items-center gap-3 text-sm font-medium text-foreground/72"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black/[0.06] bg-white/60">
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
