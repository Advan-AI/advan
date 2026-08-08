"use client"

import { motion } from "framer-motion"

/**
 * Minimal credibility band under the hero: a connector marquee.
 * Rather than fabricate customer logos (off-brand for a transparency
 * product), we lead with the proof point buyers evaluate first — how
 * easily Advan drops into the stack they already run.
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

export function SocialProofSection() {
  return (
    <section
      id="proof"
      aria-label="Integrations"
      className="relative py-12 lg:py-16 border-t border-black/[0.05]"
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
        <div className="mt-7 overflow-hidden marquee-mask" aria-hidden>
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
      </div>
    </section>
  )
}
