"use client"

import { motion } from "framer-motion"
import { Check, Sparkles, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/section-primitives"

const BOOKING_URL = "https://cal.com/day-nguyen"

const PLANS = [
  {
    name: "Starter",
    tagline: "For teams piloting transparent AI support",
    price: "$0",
    period: "free 14-day trial",
    cta: "Start free",
    href: BOOKING_URL,
    featured: false,
    features: [
      "Up to 1,000 resolved tickets / mo",
      "Source-cited answers + confidence",
      "Email + Web chat channels",
      "SOC 2 baseline",
    ],
  },
  {
    name: "Growth",
    tagline: "For scaling support orgs going AI-first",
    price: "$1,200",
    period: "/ month",
    cta: "Book a demo",
    href: BOOKING_URL,
    featured: true,
    features: [
      "Up to 25,000 resolved tickets / mo",
      "All channels: email, chat, voice, Slack, web",
      "Cross-channel memory + reasoning audit",
      "Human-in-loop policy gates",
      "SOC 2 + GDPR + EU residency",
    ],
  },
  {
    name: "Enterprise",
    tagline: "For regulated, high-volume support orgs",
    price: "Custom",
    period: "annual contract",
    cta: "Talk to sales",
    href: BOOKING_URL,
    featured: false,
    features: [
      "Unlimited resolved tickets",
      "VPC peering + BYOK encryption",
      "Custom SLAs, dedicated CSM",
      "HIPAA + ISO 27001 + SOX support",
      "On-prem model option",
    ],
  },
]

export function PricingSection() {
  return (
    <section id="pricing" className="relative py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Pricing"
          title={
            <>
              Pricing that scales with{" "}
              <span className="text-gradient-brand">tickets resolved</span>, not seats
            </>
          }
          lede="Pay for outcomes. Every plan includes full transparency features — no upsell for explainability."
        />

        <div className="mt-14 grid grid-cols-1 lg:grid-cols-3 gap-5">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="relative"
            >
              {plan.featured && (
                <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-cyan-400/40 via-blue-400/20 to-violet-400/20 -z-10 blur-sm" aria-hidden />
              )}
              <div className={`relative rounded-2xl p-7 h-full flex flex-col ${plan.featured ? "glass-strong border-cyan-400/30" : "glass"}`}>
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-900 shadow-lg">
                    <Sparkles className="w-3 h-3" />
                    Most popular
                  </div>
                )}

                <div className="mb-5">
                  <h3 className="text-base font-semibold text-foreground">{plan.name}</h3>
                  <p className="mt-1 text-xs text-foreground/55 leading-relaxed">{plan.tagline}</p>
                </div>

                <div className="mb-6">
                  <span className={`text-4xl font-semibold tracking-tight ${plan.featured ? "text-gradient-brand" : "text-foreground"}`}>
                    {plan.price}
                  </span>
                  <span className="ml-1.5 text-xs text-foreground/50">{plan.period}</span>
                </div>

                <ul className="space-y-2.5 mb-7 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/75 leading-relaxed">
                      <Check className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  className={`group w-full rounded-full h-11 text-sm font-medium ${
                    plan.featured
                      ? "bg-foreground text-background hover:bg-foreground/90 shadow-[0_8px_32px_-8px_rgba(34,211,238,0.6)]"
                      : "bg-black/[0.05] hover:bg-black/[0.1] text-foreground border border-black/15"
                  }`}
                >
                  <a href={plan.href} target="_blank" rel="noopener noreferrer">
                    {plan.cta}
                    <ArrowRight className="ml-1.5 w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </a>
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
