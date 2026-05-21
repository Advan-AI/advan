"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  Box,
  CheckCircle2,
  BookOpen,
  ShieldCheck,
  RotateCw,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Filter,
} from "lucide-react"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"

const SOURCES = [
  { name: "Docs / Billing Overcharges", path: "help.advan.com/billing/overcharges", score: 98 },
  { name: "KB / Refunds Process Guide", path: "help.advan.com/billing/refunds", score: 95 },
  { name: "Help Center / Add-on Charges", path: "help.advan.com/pricing/add-ons", score: 90 },
]

const HISTORY = [
  { time: "May 18, 10:15 AM", text: "Inquired about add-on pricing" },
  { time: "May 19,  2:37 PM", text: "Requested additional seat" },
  { time: "May 21,  9:12 AM", text: "Reported overcharge" },
]

export default function TapBoxPage() {
  const [open, setOpen] = useState(true)
  const [val, setVal] = useState(0)

  // Animate confidence ring
  useEffect(() => {
    setVal(0)
    if (!open) return
    const id = setTimeout(() => setVal(92), 100)
    return () => clearTimeout(id)
  }, [open])

  return (
    <div>
      <DashPageHeader
        eyebrow="AI Transparency"
        title="Tap Box"
        subtitle="Every Advan answer is sourced, scored, and reversible. Click into the panel to see exactly how the AI reached its draft."
        actions={
          <>
            <button className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:dash-shadow-sm transition">
              <Filter className="w-4 h-4" /> Filter sources
            </button>
            <Link
              href="/dashboard/copilot"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] hover:-translate-y-px transition"
            >
              <Sparkles className="w-4 h-4" /> Back to Copilot
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        {/* Tap Box panel */}
        <div className="rounded-2xl border dash-border bg-gradient-to-b from-white/95 to-[#F8F5ED]/95 backdrop-blur dash-shadow-md overflow-hidden">
          <div
            className="flex items-center gap-2.5 px-4 py-3.5 border-b dash-border-soft"
            style={{ background: "linear-gradient(135deg, rgba(236,233,251,.7), transparent)" }}
          >
            <div className="w-[26px] h-[26px] rounded-lg bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] flex items-center justify-center">
              <Box className="w-[15px] h-[15px] text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-bold text-[var(--dash-ink)]">Tap Box</div>
              <div className="text-[10.5px] text-[var(--dash-ink-faint)]">AI transparency · ticket #TK-84219</div>
            </div>
            <button
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--dash-ink-faint)] hover:bg-[var(--dash-bg)] hover:text-[var(--dash-ink)] transition"
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                key="body"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className="p-5 flex flex-col gap-4">
                  {/* Confidence block */}
                  <div className="flex items-center gap-4 dash-card-raised p-4 rounded-xl">
                    <ConfidenceRing value={val} />
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 text-[13.5px] font-bold text-[var(--dash-sage)] mb-1">
                        <CheckCircle2 className="w-4 h-4" />
                        High Confidence
                      </div>
                      <p className="text-[11.5px] leading-[1.5] text-[var(--dash-ink-soft)]">
                        The AI response is highly supported by our knowledge base and policies.
                      </p>
                    </div>
                  </div>

                  {/* Knowledge sources */}
                  <Section icon={<BookOpen className="w-3.5 h-3.5" />} label="Knowledge Sources">
                    {SOURCES.map((s) => (
                      <SourceRow key={s.name} {...s} />
                    ))}
                  </Section>

                  {/* Policy refs */}
                  <Section icon={<ShieldCheck className="w-3.5 h-3.5" />} label="Policy References">
                    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[var(--dash-accent-wash)] border border-[#DCD5F4]">
                      <div className="w-[26px] h-[26px] rounded-md bg-white flex items-center justify-center">
                        <ShieldCheck className="w-3.5 h-3.5 text-[var(--dash-accent)]" />
                      </div>
                      <div>
                        <div className="text-[12px] font-bold text-[var(--dash-ink)]">
                          Billing Policy — Overcharges
                        </div>
                        <div className="text-[10px] text-[var(--dash-ink-soft)]">
                          v2.3 · Updated May 1, 2024
                        </div>
                      </div>
                      <ExternalLink className="ml-auto w-3.5 h-3.5 text-[var(--dash-ink-faint)]" />
                    </div>
                  </Section>

                  {/* Ticket history */}
                  <Section icon={<RotateCw className="w-3.5 h-3.5" />} label="Ticket History">
                    {HISTORY.map((h) => (
                      <div key={h.time} className="flex items-center gap-2.5 py-1 text-[11.5px]">
                        <span className="w-[11px] h-[11px] rounded-full border-2 border-[var(--dash-accent)] bg-[var(--dash-card)] shrink-0" />
                        <span className="font-semibold text-[var(--dash-ink-faint)] w-[110px] shrink-0">
                          {h.time}
                        </span>
                        <span className="text-[var(--dash-ink-soft)]">{h.text}</span>
                      </div>
                    ))}
                    <button className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-bold text-[var(--dash-accent-deep)] hover:underline">
                      View full history →
                    </button>
                  </Section>

                  {/* AI Reasoning */}
                  <Section icon={<Sparkles className="w-3.5 h-3.5" />} label="AI Reasoning">
                    <div className="rounded-lg bg-[var(--dash-bg)] p-3 text-[11.5px] leading-[1.6] text-[var(--dash-ink-soft)] font-mono">
                      Matched intent to <b className="text-[var(--dash-accent-deep)] font-semibold">&apos;Overcharge — Billing&apos;</b> (98%). Retrieved 3 relevant sources. Cross-checked policy and past tickets. Refund eligibility <b className="text-[var(--dash-accent-deep)] font-semibold">confirmed</b>.
                    </div>
                  </Section>

                  <div className="pt-2.5 border-t dash-border-soft text-[10px] text-[var(--dash-ink-faint)] font-mono">
                    Model: Advan-Trust v1.3 · Generated May 21, 10:24 AM
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right column: metadata + audit */}
        <div className="flex flex-col gap-4">
          <DashCard title="Decision metadata" icon={<ShieldCheck className="w-[18px] h-[18px]" />}>
            <div className="space-y-3 text-[12.5px]">
              <Row k="Intent" v="Overcharge — Billing" />
              <Row k="Match score" v="98%" tone="sage" />
              <Row k="Policy version" v="v2.3" />
              <Row k="Tenant" v="acme.advan.ai" />
              <Row k="Region" v="eu-west-1" />
              <Row k="Auto-send" v="Yes (above 95%)" tone="sage" />
            </div>
          </DashCard>

          <DashCard title="Reviewer audit" icon={<CheckCircle2 className="w-[18px] h-[18px]" />}>
            <div className="space-y-3 text-[12.5px]">
              {[
                { who: "Sarah Johnson", action: "Approved draft", time: "10:25 AM" },
                { who: "Jordan Kim", action: "Flagged sources", time: "9:14 AM" },
                { who: "Auto-policy", action: "Allowed auto-send", time: "8:01 AM" },
              ].map((r) => (
                <div key={r.action} className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full dash-bg-deep flex items-center justify-center text-[10px] font-bold text-[var(--dash-ink-soft)]">
                    {r.who.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold text-[var(--dash-ink)] truncate">{r.who}</div>
                    <div className="text-[11px] text-[var(--dash-ink-faint)]">{r.action}</div>
                  </div>
                  <span className="text-[11px] text-[var(--dash-ink-faint)]">{r.time}</span>
                </div>
              ))}
            </div>
          </DashCard>
        </div>
      </div>
    </div>
  )
}

function ConfidenceRing({ value }: { value: number }) {
  const R = 40
  const circ = 2 * Math.PI * R
  const offset = circ - (value / 100) * circ

  return (
    <div className="relative w-[88px] h-[88px] shrink-0">
      <svg width={88} height={88} viewBox="0 0 88 88" className="-rotate-90">
        <defs>
          <linearGradient id="ringgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#76B98C" />
            <stop offset="1" stopColor="#4A8A60" />
          </linearGradient>
        </defs>
        <circle cx="44" cy="44" r={R} stroke="var(--dash-line)" strokeWidth="9" fill="none" />
        <motion.circle
          cx="44"
          cy="44"
          r={R}
          stroke="url(#ringgrad)"
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: [0.34, 1.2, 0.64, 1] }}
          style={{ filter: "drop-shadow(0 0 5px rgba(92,154,112,.5))" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[21px] font-extrabold text-[var(--dash-ink)]">
        {value}%
      </div>
    </div>
  )
}

function Section({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="border-t dash-border-soft pt-3">
      <div className="text-[11px] font-bold tracking-wider uppercase text-[var(--dash-ink-soft)] mb-2 flex items-center gap-1.5">
        <span className="text-[var(--dash-accent)]">{icon}</span>
        {label}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function SourceRow({ name, path, score }: { name: string; path: string; score: number }) {
  return (
    <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border dash-border-soft bg-white hover:-translate-y-px hover:dash-shadow-sm transition cursor-pointer">
      <div className="w-[26px] h-[26px] rounded-md dash-bg-blue-wash flex items-center justify-center">
        <BookOpen className="w-3.5 h-3.5 text-[var(--dash-blue)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-bold text-[var(--dash-ink)] truncate">{name}</div>
        <div className="text-[10px] text-[var(--dash-ink-faint)] font-mono truncate">{path}</div>
      </div>
      <span className="text-[10.5px] font-extrabold text-[var(--dash-sage)] dash-bg-sage-wash rounded-md px-1.5 py-0.5">
        {score}%
      </span>
      <ExternalLink className="w-3.5 h-3.5 text-[var(--dash-ink-faint)] shrink-0" />
    </div>
  )
}

function Row({ k, v, tone }: { k: string; v: string; tone?: "sage" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--dash-ink-faint)]">{k}</span>
      <span className={`font-semibold ${tone === "sage" ? "text-[var(--dash-sage)]" : "text-[var(--dash-ink)]"}`}>
        {v}
      </span>
    </div>
  )
}
