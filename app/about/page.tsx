"use client"

import { motion } from "framer-motion"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { ArrowRight, Linkedin, Twitter } from "lucide-react"

const BOOKING_URL = "https://cal.com/day-nguyen"

const values = [
  {
    title: "Results First",
    description: "We measure success by the meetings we book and pipeline we generate — not activity metrics.",
  },
  {
    title: "AI + Human Intelligence",
    description: "Our AI handles scale and personalization while human strategists guide campaign direction.",
  },
  {
    title: "Radical Transparency",
    description: "Real-time dashboards, weekly strategy calls, and honest conversations about what's working.",
  },
  {
    title: "Continuous Innovation",
    description: "We invest heavily in R&D to stay ahead of the curve in AI-powered revenue generation.",
  },
]

const team = [
  {
    name: "Day Nguyen",
    role: "Founder & CEO",
    bio: "Former growth lead at Series B startups. Obsessed with building scalable revenue systems.",
    linkedin: "https://linkedin.com/in/day-nguyen",
    twitter: "https://twitter.com/daynguyen",
  },
]

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white">
      <Header />
      
      {/* Hero */}
      <section className="pt-32 pb-16 lg:pt-40 lg:pb-24 bg-[#F8F7F4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm font-semibold text-[#E85D04] uppercase tracking-wider mb-4"
          >
            About Advan AI
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-light text-[#1a1a1a] mb-6 max-w-4xl font-serif"
          >
            We believe every B2B company deserves{" "}
            <span className="italic">predictable revenue</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg lg:text-xl text-[#666] max-w-2xl"
          >
            Advan AI was founded to solve a simple problem: most B2B companies struggle to generate consistent, qualified pipeline. We built the AI Growth Engine to change that.
          </motion.p>
        </div>
      </section>

      {/* Story */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-light text-[#1a1a1a] mb-6 font-serif">
                Our <span className="italic">story</span>
              </h2>
              <div className="space-y-4 text-[#666] leading-relaxed">
                <p>
                  After years of watching B2B companies struggle with outbound — hiring expensive SDRs who took months to ramp, working with agencies that delivered unqualified leads, or trying to piece together their own tech stack — we knew there had to be a better way.
                </p>
                <p>
                  We built Advan AI to be the revenue engine we wished existed: fully managed, AI-powered, and laser-focused on one metric that matters — qualified meetings on your calendar.
                </p>
                <p>
                  Today, we help growth-minded B2B companies across SaaS, fintech, and professional services generate predictable pipeline without the overhead of traditional sales development.
                </p>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="aspect-square bg-gradient-to-br from-[#E85D04] to-[#D45A04] rounded-3xl flex items-center justify-center">
                <div className="text-center text-white p-8">
                  <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-6">
                    <span className="text-5xl font-bold">A</span>
                  </div>
                  <p className="text-2xl font-light font-serif">Building the future of B2B revenue</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 lg:py-24 bg-[#F8F7F4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mb-12"
          >
            <p className="text-sm font-semibold text-[#E85D04] uppercase tracking-wider mb-4">
              Our Values
            </p>
            <h2 className="text-3xl md:text-4xl font-light text-[#1a1a1a] font-serif">
              What drives <span className="italic">everything</span> we do
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl p-8 hover:shadow-xl transition-shadow"
              >
                <h3 className="text-xl font-semibold text-[#1a1a1a] mb-3">{value.title}</h3>
                <p className="text-[#666] leading-relaxed">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mb-12"
          >
            <p className="text-sm font-semibold text-[#E85D04] uppercase tracking-wider mb-4">
              Leadership
            </p>
            <h2 className="text-3xl md:text-4xl font-light text-[#1a1a1a] font-serif">
              Meet the <span className="italic">team</span>
            </h2>
          </motion.div>

          <div className="max-w-md">
            {team.map((member, index) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-[#F8F7F4] rounded-2xl p-8"
              >
                <div className="w-20 h-20 rounded-full bg-[#E85D04] flex items-center justify-center mb-6">
                  <span className="text-white text-2xl font-bold">
                    {member.name.split(" ").map(n => n[0]).join("")}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-[#1a1a1a] mb-1">{member.name}</h3>
                <p className="text-[#E85D04] font-medium mb-4">{member.role}</p>
                <p className="text-[#666] leading-relaxed mb-6">{member.bio}</p>
                <div className="flex gap-3">
                  <a
                    href={member.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-white hover:bg-[#E85D04] flex items-center justify-center transition-colors group"
                  >
                    <Linkedin className="w-5 h-5 text-[#666] group-hover:text-white transition-colors" />
                  </a>
                  <a
                    href={member.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-white hover:bg-[#E85D04] flex items-center justify-center transition-colors group"
                  >
                    <Twitter className="w-5 h-5 text-[#666] group-hover:text-white transition-colors" />
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-24 bg-[#1a1a1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl lg:text-5xl font-light text-white mb-6 font-serif"
          >
            Ready to build your{" "}
            <span className="italic">growth engine</span>?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-white/60 mb-8 max-w-2xl mx-auto"
          >
            Book a demo to see how our AI Growth Engine can deliver qualified sales appointments to your calendar every month.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Button
              size="lg"
              asChild
              className="bg-[#E85D04] hover:bg-[#D45A04] text-white rounded-full px-8 h-14"
            >
              <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
                Book a demo
                <ArrowRight className="ml-2 w-5 h-5" />
              </a>
            </Button>
          </motion.div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
