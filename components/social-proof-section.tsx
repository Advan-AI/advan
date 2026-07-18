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
 * Compact credibility band under the hero: connector marquee + compliance
 * chips. Rather than fabricate customer logos (off-brand for a transparency
 * product), we lead with the two proof points buyers actually evaluate —
 * adoption friction and enterprise posture.
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
      className="relative py-10 lg:py-14 border-t border-black/[0.05]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="text-center text-[12px] font-bold uppercase tracking-[0.18em] text-foreground/45"
        >
          Connects to the tools your team already runs
        </motion.p>

        {/* Connector marquee */}
        <div className="mt-6 overflow-hidden marquee-mask" aria-hidden>
          <div className="marquee-track items-center gap-x-12">
            {[...CONNECTORS, ...CONNECTORS].map((name, i) => (
              <span key={`${name}-${i}`} className="group flex items-center gap-2.5 shrink-0">
                <span className="h-2 w-2 rounded-[3px] bg-foreground/20 transition-colors duration-200 group-hover:bg-[#6B5CD6]" />
                <span className="text-[17px] font-semibold tracking-tight text-foreground/40 transition-colors duration-200 group-hover:text-foreground/80 sm:text-lg whitespace-nowrap">
                  {name}
                </span>
              </span>
            ))}
          </div>
        </div>
        {/* Screen-reader fallback for the animated marquee */}
        <p className="sr-only">Integrates with {CONNECTORS.join(", ")}.</p>

        {/* Compliance chips */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-2.5"
        >
          {COMPLIANCE.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-black/[0.07] bg-white/70 px-3.5 py-2 text-[12.5px] font-semibold text-foreground/72 shadow-[0_10px_30px_-26px_rgba(34,31,25,0.5)] backdrop-blur transition-colors hover:border-[#197869]/30 hover:text-foreground whitespace-nowrap"
            >
              <Icon className="h-4 w-4 text-[#197869]" aria-hidden />
              {label}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
