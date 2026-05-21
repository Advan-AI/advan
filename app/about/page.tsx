"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { ArrowRight, Target, Eye, Users, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { SectionHeader, GlassCard } from "@/components/section-primitives"

const BOOKING_URL = "https://cal.com/day-nguyen"

const values = [
  {
    icon: Eye,
    title: "Transparency by default",
    description:
      "Every AI decision is sourced, scored, and inspectable. If we can't show why, we don't ship it.",
  },
  {
    icon: ShieldCheck,
    title: "Trust is the product",
    description:
      "Compliance, audit, and control aren't bolt-ons. They are the reason teams pick Advan over generic AI bots.",
  },
  {
    icon: Users,
    title: "Humans stay in the loop",
    description:
      "Advan is a copilot. Agents keep the high-empathy work. AI takes the repetitive load.",
  },
  {
    icon: Target,
    title: "Outcomes over outputs",
    description:
      "We measure ourselves by resolution rate, CSAT shift, and time saved — not by tokens generated.",
  },
]

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="relative pt-32">
        <section className="relative py-16 lg:py-24">
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-cyan-500/10 blur-3xl" />
          </div>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHeader
              eyebrow="About Advan"
              title={
                <>
                  Building AI support people can{" "}
                  <span className="text-gradient-brand">actually trust</span>
                </>
              }
              lede="We started Advan because the first wave of AI support tools failed the moment they met a regulated industry, a compliance review, or a customer who deserved a real answer."
            />
          </div>
        </section>

        <section className="py-14 lg:py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight text-gradient mb-5">
                  Our mission
                </h2>
                <div className="space-y-4 text-base text-foreground/65 leading-relaxed">
                  <p>
                    Customer support is the front door of every modern company. When AI gets it
                    wrong — silently — it costs trust faster than any other channel.
                  </p>
                  <p>
                    Advan exists to make every answer explainable, every action reversible, and
                    every customer interaction observable. Not as a feature flag. As the entire
                    posture of the product.
                  </p>
                  <p>
                    We&apos;re building for the next decade of support: AI-first, but human-led, and
                    accountable on day one.
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.98 }}
                whileInView={{ opacity: 1, x: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="relative"
              >
                <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-[#6B5CD6]/15 via-[#8E80E5]/10 to-[#5C9A70]/10 blur-2xl" aria-hidden />
                <div className="relative rounded-[22px] overflow-hidden border border-black/[0.08] dash-shadow-md bg-white/40">
                  <div className="relative aspect-[4/3]">
                    <Image
                      src="/images/diverse-team.png"
                      alt="Diverse Advan team collaborating in a modern workspace"
                      fill
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      className="object-cover"
                      priority
                    />
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHeader
              eyebrow="Values"
              title={
                <>
                  What we{" "}
                  <span className="text-gradient-brand">stand for</span>
                </>
              }
            />
            <div className="mt-12 grid md:grid-cols-2 gap-4 lg:gap-5">
              {values.map((value, index) => {
                const Icon = value.icon
                return (
                  <motion.div
                    key={value.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.08 }}
                  >
                    <GlassCard glow="cyan" className="h-full">
                      <div className="flex items-start gap-4">
                        <div className="w-11 h-11 rounded-xl glass flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5 text-cyan-600" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-foreground mb-1.5">{value.title}</h3>
                          <p className="text-sm text-foreground/60 leading-relaxed">{value.description}</p>
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="py-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-gradient mb-5"
            >
              See it for yourself
            </motion.h2>
            <p className="text-base lg:text-lg text-foreground/60 mb-9 max-w-xl mx-auto leading-relaxed">
              Book a demo and watch Advan resolve a real ticket — with every source and decision
              visible.
            </p>
            <Button
              asChild
              size="lg"
              className="group rounded-full bg-foreground text-background hover:bg-foreground/90 h-12 px-7 text-base font-medium shadow-[0_8px_32px_-8px_rgba(34,211,238,0.6)]"
            >
              <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
                Book a demo
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
