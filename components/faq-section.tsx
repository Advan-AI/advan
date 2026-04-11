"use client"

import { motion } from "framer-motion"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const faqs = [
  {
    question: "What is Advan AI?",
    answer: "Advan AI is a fully managed AI-powered revenue growth service that builds, deploys, and optimizes AI Growth Engines for B2B companies. It handles the entire pipeline — from ICP research and prospect sourcing to personalized outreach, qualification, and booked sales meetings — so clients receive qualified demos without managing any outbound infrastructure themselves."
  },
  {
    question: "What is an AI Growth Engine?",
    answer: "An AI Growth Engine is a fully automated, end-to-end revenue system that combines AI outbound prospecting, CRM reactivation, and real-time inbound conversion. Advan AI's AI Growth Engine sources 10,000+ verified prospects per campaign, personalizes every touchpoint using AI, manages email deliverability, and routes qualified leads to sales calendars — operating continuously without manual SDR involvement."
  },
  {
    question: "How does Advan AI generate qualified sales meetings?",
    answer: "Advan AI generates qualified sales meetings through a four-phase lifecycle: (1) Design — defining the ideal customer profile and building a verified prospect database; (2) Test — A/B testing messaging sequences to identify what converts; (3) Scale — deploying high-performing sequences to thousands of prospects with AI personalization; (4) Optimize — continuously refining targeting and messaging based on real engagement data. Most clients book their first qualified meeting within 2–3 weeks of launch."
  },
  {
    question: "Who is Advan AI built for?",
    answer: "Advan AI is designed for B2B companies at any stage — pre-revenue startups building their first outbound pipeline, growth-stage companies scaling alongside inbound, and established businesses seeking efficient customer acquisition. The AI Growth Engine adapts to each client's specific ideal customer profile, market, and revenue goals."
  },
  {
    question: "What makes Advan AI unique?",
    answer: "Traditional SDRs cost $60,000–$80,000+ per year in salary, benefits, tools, and management overhead, and take 3–6 months to ramp. Lead generation agencies typically deliver unqualified leads with generic templates and no campaign ownership. Advan AI combines AI precision with human-quality output at 65% lower cost per qualified meeting, with results typically visible within 2–3 weeks rather than months."
  },
  {
    question: "How long does it take to see the first results from Advan AI?",
    answer: "Most clients receive their first qualified appointments within 2–3 weeks of engagement. Week 1 is dedicated to building the custom AI Growth Engine — ICP mapping, prospect research, messaging development, and technical infrastructure setup. Weeks 2–3 initiate outreach and meeting booking. Results compound over time as the AI system learns which messages and segments perform best for that specific market."
  },
  {
    question: "Does Advan AI require day-to-day involvement from my team?",
    answer: "No. Advan AI is a fully managed, done-for-you service. The team handles all technical setup, prospect research, content creation, campaign management, deliverability monitoring, and meeting scheduling. Clients attend a brief weekly strategy call and show up to the demos booked on their behalf."
  },
  {
    question: "Is Advan AI compliant with data privacy regulations?",
    answer: "Yes. Advan AI's infrastructure is designed with enterprise-grade security and compliance in mind, including alignment with GDPR (EU data privacy), CCPA (California privacy), and email deliverability best practices including SPF, DKIM, and DMARC authentication. All prospect data is sourced through compliant, permission-based data providers."
  }
]

export function FAQSection() {
  return (
    <section className="py-8 bg-white" id="faq">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-8">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-sm font-semibold text-[#E85D04] uppercase tracking-wider mb-4"
          >
            Common Questions
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl lg:text-5xl font-light text-[#1a1a1a] mb-4 text-balance font-serif"
          >
            Frequently asked <span className="italic">questions</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-[#666] text-base"
          >
            Everything you need to know about the AI Growth Engine and how Advan AI delivers results.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-[#F8F7F4] rounded-2xl px-6 data-[state=open]:shadow-lg transition-shadow border-none"
              >
                <AccordionTrigger className="text-left text-base font-semibold text-[#1a1a1a] hover:no-underline py-4">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-[#555] leading-relaxed pb-4 text-sm">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  )
}
