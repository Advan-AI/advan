"use client"

import { motion } from "framer-motion"
import {
  MessageCircleQuestion,
  BookOpen,
  ShieldCheck,
  Gauge,
  UserCheck,
  CheckCircle2,
  ArrowRight,
} from "lucide-react"
import { SectionHeader } from "@/components/section-primitives"

const STEPS = [
  {
    icon: MessageCircleQuestion,
    title: "Customer question",
    body: "A customer asks something in chat, email, or your helpdesk.",
  },
  {
    icon: BookOpen,
    title: "Knowledge base",
    body: "Advan searches your docs, policies, and past tickets for the answer.",
  },
  {
    icon: ShieldCheck,
    title: "Policy validation",
    body: "The draft is checked against your company's rules before it ever goes out.",
  },
  {
    icon: Gauge,
    title: "Confidence score",
    body: "Every answer is scored on how certain Advan is that it's correct.",
  },
  {
    icon: UserCheck,
    title: "Human review",
    body: "Below your threshold, a support agent reviews it first. Above it, nothing to do.",
  },
  {
    icon: CheckCircle2,
    title: "Verified response",
    body: "The customer gets an accurate, source-backed answer — in seconds.",
  },
]

export function HowItWorksSection() {
  return (
    <section id="how" className="relative py-14 lg:py-[88px] border-t border-black/[0.05]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="How it works"
          title={<>From question to verified answer, automatically</>}
          lede="Every ticket runs through the same six steps — so nothing reaches a customer without being checked."
        />

        <div className="mt-14 flex flex-col lg:flex-row lg:items-start gap-5 lg:gap-0">
          {STEPS.map((step, i) => {
            const Icon = step.icon
            const isLast = i === STEPS.length - 1
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="flex lg:flex-1 items-start lg:items-stretch gap-4 lg:gap-0"
              >
                <div className="flex flex-col items-center lg:text-center lg:px-2 flex-1">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-black/[0.08] bg-white/70 text-[#4E3FB6]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="mt-0 lg:mt-4">
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-foreground/40">
                      Step {i + 1}
                    </div>
                    <h3 className="mt-1 text-[15px] font-semibold text-foreground leading-snug">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/58 lg:max-w-[180px] lg:mx-auto">
                      {step.body}
                    </p>
                  </div>
                </div>
                {!isLast && (
                  <ArrowRight
                    className="hidden lg:block h-4 w-4 text-foreground/25 shrink-0 mt-[22px]"
                    aria-hidden
                  />
                )}
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
