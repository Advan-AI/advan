"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"

const BOOKING_URL = "https://cal.com/day-nguyen"

export function ContactSection() {
  return (
    <section className="py-8 bg-[#F8F7F4]" id="contact">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <p className="text-sm font-semibold text-[#E85D04] uppercase tracking-wider mb-4">
                Get in Touch
              </p>
              <h2
                className="text-3xl md:text-4xl font-light text-[#1a1a1a] mb-6 font-serif"
              >
                Ready to build your{" "}
                <span className="italic">growth engine</span>?
              </h2>
              <p className="text-lg text-[#666] mb-8">
                Book a demo to see how our AI Growth Engine can deliver qualified sales appointments to your calendar every month.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-3xl p-8 shadow-xl"
            >
              <h3 className="text-xl font-semibold text-[#1a1a1a] mb-2">See it in action</h3>
              <p className="text-[#666] mb-8">
                In 30 minutes, we&apos;ll show you exactly how our AI Growth Engine can build a predictable pipeline for your business.
              </p>

              <div className="space-y-4 mb-8">
                {[
                  "Custom ICP analysis for your market",
                  "Live demo of the AI Growth Engine",
                  "Pipeline projection and ROI estimate",
                  "Clear next steps and timeline"
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#E85D04] flex-shrink-0" />
                    <span className="text-sm text-[#1a1a1a]">{item}</span>
                  </div>
                ))}
              </div>

              <Button asChild className="w-full bg-[#E85D04] hover:bg-[#D45A04] text-white rounded-full h-12">
                <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
                  Book your demo
                </a>
              </Button>
              <p className="text-xs text-[#999] text-center mt-4">
                Free consultation. No commitment required.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
