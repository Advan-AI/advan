"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowRight, CheckCircle2 } from "lucide-react"

const BOOKING_URL = "https://cal.com/day-nguyen"

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[#111111]" />
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e]/80 via-transparent to-transparent" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <motion.h2
              className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-light text-white leading-tight mb-8 font-serif"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              Stop chasing leads.{" "}
              <span className="italic">Start closing deals.</span>
            </motion.h2>

            <motion.p
              className="text-lg lg:text-xl text-white/70 mb-10 max-w-lg"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              See how our AI Growth Engine builds a predictable pipeline that delivers qualified appointments to your calendar every week — guaranteed.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Button
                size="lg"
                asChild
                className="bg-[#E85D04] hover:bg-[#D45A04] text-white text-base px-8 h-14 rounded-full shadow-xl shadow-[#E85D04]/20"
              >
                <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
                  Book a demo
                  <ArrowRight className="ml-2 w-5 h-5" />
                </a>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="border-white/30 text-white hover:bg-white/10 text-base px-8 h-14 rounded-full bg-transparent"
              >
                <a href="#contact" onClick={(e) => {
                  e.preventDefault()
                  const el = document.getElementById("contact")
                  if (el) el.scrollIntoView({ behavior: "smooth" })
                }}>
                  Contact Us
                </a>
              </Button>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="hidden lg:block"
          >
            <motion.div
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm ml-auto"
            >
              <div className="mb-8">
                <p className="font-semibold text-[#1a1a1a] text-lg">What you get</p>
                <p className="text-sm text-[#666]">Everything included</p>
              </div>

              <div className="space-y-4">
                {[
                  "Qualified appointments monthly",
                  "10,000+ verified prospect database",
                  "AI-CRM with pipeline tracking",
                  "Dedicated sending infrastructure",
                  "Live performance reporting",
                  "Pay-for-performance guarantee"
                ].map((item, index) => (
                  <motion.div
                    key={item}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 + index * 0.06 }}
                    className="flex items-center gap-3"
                  >
                    <CheckCircle2 className="w-5 h-5 text-[#E85D04] flex-shrink-0" />
                    <span className="text-sm text-[#1a1a1a]">{item}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
