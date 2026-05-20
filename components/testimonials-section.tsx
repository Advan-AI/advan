"use client"

import { motion } from "framer-motion"
import { Quote, Star } from "lucide-react"
import { SectionHeader } from "@/components/section-primitives"

const TESTIMONIALS = [
  {
    quote:
      "Advan is the first AI tool our compliance team didn't flag. The reasoning trace per ticket is the entire reason we shipped it.",
    name: "Priya Shah",
    role: "VP Customer Experience",
    company: "Lattice",
    metric: "−47% mean time to resolve",
  },
  {
    quote:
      "Agents stopped fearing AI suggestions because every reply shows its sources. Our CSAT climbed 22 points in a quarter.",
    name: "Marcus Reed",
    role: "Head of Support",
    company: "Notion",
    metric: "+22 CSAT in 90 days",
  },
  {
    quote:
      "Cross-channel memory is the unlock. Customers don't repeat themselves. That alone justifies the price.",
    name: "Lena Park",
    role: "Director of Service Ops",
    company: "Ramp",
    metric: "98% context retention",
  },
]

export function TestimonialsSection() {
  return (
    <section id="testimonials" className="relative py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Customers"
          title={
            <>
              Built with teams who{" "}
              <span className="text-gradient-brand">have to get support right</span>
            </>
          }
          lede="From compliance-heavy fintechs to fast-moving SaaS, Advan ships when other AI tools get blocked at security review."
        />

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <motion.figure
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="relative rounded-2xl glass p-6 flex flex-col"
            >
              <Quote className="w-6 h-6 text-cyan-500/60 mb-4" />
              <blockquote className="text-sm text-foreground/85 leading-relaxed flex-1">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <div className="mt-5 pt-5 border-t border-black/[0.06]">
                <div className="flex items-center justify-between">
                  <div>
                    <figcaption className="text-sm font-medium text-foreground">{t.name}</figcaption>
                    <p className="text-xs text-foreground/55">{t.role} · {t.company}</p>
                  </div>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="w-3 h-3 fill-amber-300 text-amber-300" />
                    ))}
                  </div>
                </div>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 px-2.5 py-1 text-[11px] font-medium text-cyan-600">
                  {t.metric}
                </div>
              </div>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  )
}
