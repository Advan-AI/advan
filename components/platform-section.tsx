"use client"

import { motion } from "framer-motion"
import { Sparkles, Users, TrendingUp, Zap, Target, LineChart } from "lucide-react"

const features = [
  {
    icon: Target,
    title: "New Demand Generation",
    description: "Build, launch, and manage AI SDR agents that identify, engage, and qualify new buyers at scale.",
  },
  {
    icon: Users,
    title: "Lead Reactivation",
    description: "Reconnect with inactive leads, churned customers, and dormant pipeline with automated reactivation sequences.",
  },
  {
    icon: Zap,
    title: "Inbound Conversion",
    description: "Respond to inbound leads instantly, qualify them in real time, and convert interest into booked meetings.",
  },
  {
    icon: LineChart,
    title: "Pipeline Analytics",
    description: "Real-time visibility into campaign performance, meeting conversion rates, and revenue attribution.",
  },
  {
    icon: TrendingUp,
    title: "Predictable Revenue",
    description: "Move from sporadic lead flow to consistent, scalable pipeline that compounds over time.",
  },
  {
    icon: Sparkles,
    title: "AI Personalization",
    description: "Every touchpoint is personalized with AI — from subject lines to follow-ups to objection handling.",
  },
]

export function PlatformSection() {
  return (
    <section className="py-8 lg:py-12 bg-white" id="platform">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-10">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-sm font-semibold text-[#E85D04] uppercase tracking-wider mb-4"
          >
            The AI Growth Platform
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-2xl md:text-3xl lg:text-4xl font-light text-[#1a1a1a] leading-snug mb-6 font-serif"
          >
            One platform to generate, reactivate, and{" "}
            <span className="italic">convert</span> pipeline
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg text-[#666]"
          >
            Our AI Growth Engine handles the entire revenue lifecycle — from sourcing prospects to booking qualified meetings on your calendar.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group p-8 rounded-2xl bg-[#F8F7F4] hover:bg-[#1a1a1a] transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-[#E85D04]/10 group-hover:bg-[#E85D04] flex items-center justify-center mb-6 transition-colors">
                  <Icon className="w-6 h-6 text-[#E85D04] group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-[#1a1a1a] group-hover:text-white mb-3 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-[#666] group-hover:text-white/70 leading-relaxed transition-colors">
                  {feature.description}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
