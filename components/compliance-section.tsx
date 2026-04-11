"use client"

import { motion } from "framer-motion"
import { Shield, Lock, FileCheck, Heart, Server, CheckCircle } from "lucide-react"

const certifications = [
  { icon: FileCheck, label: "ISO 27001:2022", description: "Information security" },
  { icon: Shield, label: "SOC 2 Type 2", description: "Security controls" },
  { icon: Lock, label: "PCI DSS", description: "Payment security" },
  { icon: Heart, label: "HIPAA", description: "Healthcare compliance" },
  { icon: Server, label: "GDPR", description: "EU data privacy" },
  { icon: CheckCircle, label: "CCPA", description: "California privacy" },
]

export function ComplianceSection() {
  return (
    <section className="py-8 lg:py-12 bg-[#F8F7F4]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-8">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-sm font-semibold text-[#E85D04] uppercase tracking-wider mb-4"
          >
            Security & Compliance
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl lg:text-5xl font-light text-[#1a1a1a] mb-6 font-serif"
          >
            Committed to security, privacy and <span className="italic">compliance</span>
          </motion.h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-6 max-w-5xl mx-auto">
          {certifications.map((cert, index) => {
            const Icon = cert.icon
            return (
              <motion.div
                key={cert.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                className="flex flex-col items-center text-center p-6 rounded-2xl bg-white hover:shadow-xl transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-full bg-[#E85D04]/10 flex items-center justify-center mb-4">
                  <Icon className="w-7 h-7 text-[#E85D04]" />
                </div>
                <span className="font-semibold text-[#1a1a1a] text-sm mb-1">{cert.label}</span>
                <span className="text-xs text-[#666]">{cert.description}</span>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
