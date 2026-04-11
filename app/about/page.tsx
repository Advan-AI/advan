"use client"

import { motion } from "framer-motion"
import { ArrowRight, Target, Zap, Users, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

const BOOKING_URL = "https://cal.com/day-nguyen"

const values = [
  {
    icon: Target,
    title: "Results-Driven",
    description: "We measure success by your success. Our model is built around delivering real outcomes — qualified appointments on your calendar."
  },
  {
    icon: Zap,
    title: "AI-First Innovation",
    description: "We continuously evolve our AI systems to stay ahead of deliverability changes, market shifts, and buyer behavior patterns."
  },
  {
    icon: Users,
    title: "Partnership Mindset",
    description: "We&apos;re not a vendor — we&apos;re an extension of your growth team, fully invested in building a pipeline engine that compounds over time."
  },
  {
    icon: TrendingUp,
    title: "Scalable by Design",
    description: "Everything we build is engineered to scale with you, from your first 10 demos per month to hundreds of qualified opportunities."
  }
]

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="pt-20">
        {/* Hero Section */}
        <section className="py-24 bg-white relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[#E85D04]/5 to-transparent" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#E85D04]/5 rounded-full blur-3xl" />
          </div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm font-semibold text-[#E85D04] uppercase tracking-wider mb-4"
              >
                About Advan AI
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-4xl md:text-5xl lg:text-6xl font-light text-[#1a1a1a] mb-6 text-balance font-serif"
              >
                Building the future of{" "}
                <span className="italic">predictable growth</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-xl text-[#666] max-w-2xl mx-auto"
              >
                Advan AI was founded on a simple belief: every company deserves access to scalable growth infrastructure that drives pipeline and revenue.
              </motion.p>
            </div>
          </div>
        </section>

        {/* Mission Section */}
        <section className="py-24 bg-[#F8F7F4]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <h2
                  className="text-3xl md:text-4xl font-light text-[#1a1a1a] mb-6 font-serif"
                >
                  Our Mission
                </h2>
                <div className="space-y-4 text-lg text-[#666] leading-relaxed">
                  <p>
                    We&apos;re on a mission to democratize growth. Many companies struggle with unpredictable pipelines, inconsistent lead flow, and the impossible choice between hiring expensive SDR teams or settling for generic agencies.
                  </p>
                  <p>
                    Advan AI changes that equation. We&apos;ve built an AI Growth Engine that combines the precision of data science, the personalization of a world-class SDR, and the scalability of intelligent automation.
                  </p>
                  <p>
                    The result? Predictable, scalable customer acquisition that lets you focus on what you do best — building great products and serving your customers.
                  </p>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative"
              >
                <img
                  src="/images/diverse-team.jpg"
                  alt="Diverse team collaborating at Advan AI"
                  className="rounded-3xl w-full object-cover aspect-[4/3]"
                />
              </motion.div>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto text-center mb-16">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-3xl md:text-4xl font-light text-[#1a1a1a] font-serif"
              >
                What we stand for
              </motion.h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {values.map((value, index) => {
                const Icon = value.icon
                return (
                  <motion.div
                    key={value.title}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="text-center p-6"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-[#E85D04]/10 flex items-center justify-center mx-auto mb-6">
                      <Icon className="w-7 h-7 text-[#E85D04]" />
                    </div>
                    <h3 className="font-semibold text-[#1a1a1a] mb-3">{value.title}</h3>
                    <p className="text-sm text-[#666] leading-relaxed">{value.description}</p>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-[#1a1a1a]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl lg:text-5xl font-light text-white mb-6 font-serif"
            >
              Ready to build your growth engine?
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-xl text-white/60 mb-10 max-w-2xl mx-auto"
            >
              Book a demo and see how Advan AI can transform your pipeline in 30 days.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <Button size="lg" asChild
                className="bg-[#E85D04] hover:bg-[#D45A04] text-white px-8 h-14 rounded-full text-base shadow-xl shadow-[#E85D04]/20"
              >
                <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
                  Book a demo
                  <ArrowRight className="ml-2 w-5 h-5" />
                </a>
              </Button>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
