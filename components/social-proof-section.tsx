"use client"

import { motion } from "framer-motion"
import {
  FileLock2,
  Globe2,
  History,
  KeyRound,
  ScanEye,
  ShieldCheck,
} from "lucide-react"

/**
 * Credibility band shown directly under the hero.
 *
 * For a product whose entire positioning is *trust*, the landing page needs
 * external validation before a buyer will book a call. Rather than fabricate
 * customer logos (off-brand for a transparency product), we lead with two
 * honest proof points buyers actually evaluate:
 *   1. Adoption friction  → "connects to the tools you already run"
 *   2. Enterprise posture  → verifiable compliance + security controls
 */

const CONNECTORS = [
  "Zendesk",
  "Intercom",
  "Salesforce",
  "Slack",
  "Gmail",
  "HubSpot",
  "Notion",
  "Zapier",
]

const COMPLIANCE = [
  { icon: ShieldCheck, label: "SOC 2 Type II" },
  { icon: Globe2, label: "GDPR · EU residency" },
  { icon: KeyRound, label: "SSO / SAML" },
  { icon: ScanEye, label: "PII redaction" },
  { icon: History, label: "Immutable audit log" },
  { icon: FileLock2, label: "Tenant isolation" },
]

export function SocialProofSection() {
  return (
    <section
      id="proof"
      aria-label="Integrations and enterprise trust"
      className="relative py-12 lg:py-16"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Connectors */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="text-center text-[12px] font-bold uppercase tracking-[0.18em] text-foreground/45"
        >
          Connects to the tools your team already runs
        </motion.p>

        <motion.ul
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } },
          }}
          className="mt-7 flex flex-wrap items-center justify-center gap-x-8 gap-y-5 sm:gap-x-12"
        >
          {CONNECTORS.map((name) => (
            <motion.li
              key={name}
              variants={{
                hidden: { opacity: 0, y: 10 },
                show: { opacity: 1, y: 0 },
              }}
              className="group flex items-center gap-2.5"
            >
              <span
                aria-hidden
                className="h-2 w-2 rounded-[3px] bg-foreground/20 transition-colors duration-200 group-hover:bg-[#6B5CD6]"
              />
              <span className="text-[17px] font-semibold tracking-tight text-foreground/40 transition-colors duration-200 group-hover:text-foreground/80 sm:text-lg">
                {name}
              </span>
            </motion.li>
          ))}
        </motion.ul>

        {/* Divider */}
        <div className="mx-auto mt-11 mb-9 h-px max-w-3xl bg-gradient-to-r from-transparent via-black/[0.09] to-transparent" />

        {/* Compliance + security posture */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {COMPLIANCE.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-black/[0.07] bg-white/70 px-3.5 py-2 text-[12.5px] font-semibold text-foreground/72 shadow-[0_10px_30px_-26px_rgba(34,31,25,0.5)] backdrop-blur transition-colors hover:border-[#197869]/30 hover:text-foreground"
              >
                <Icon className="h-4 w-4 text-[#197869]" aria-hidden />
                {label}
              </span>
            ))}
          </div>

          <p className="max-w-xl text-center text-[13px] leading-relaxed text-foreground/50">
            Every answer ships with its sources, a confidence score, and a complete
            reasoning trace — so security, support, and compliance can see exactly how
            each response was produced.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
