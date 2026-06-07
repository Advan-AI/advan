"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  Box, CheckCircle2, BookOpen, ShieldCheck, RotateCw,
  Sparkles, ExternalLink, ChevronDown, Filter, AlertTriangle,
} from "lucide-react"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"
import { api } from "@/lib/api/trpc-client"

export default function TapBoxPage() {
  const [open, setOpen] = useState(true)
  const [val, setVal] = useState(0)

  const { data: latestLog, isLoading } = api.analytics.latestAuditLog.useQuery({})

  const confidence = latestLog?.metadata?.confidence ?? null

  useEffect(() => {
    setVal(0)
    if (!open || confidence === null) return
    const id = setTimeout(() => setVal(confidence), 100)
    return () => clearTimeout(id)
  }, [open, confidence])

  const citations = latestLog?.metadata?.citations ?? []
  const policyChecks = latestLog?.metadata?.policyChecks ?? []
  const hallucinationFlags = latestLog?.metadata?.hallucinationFlags ?? []
  const model = latestLog?.metadata?.model ?? "Advan-Trust v1.3"
  const latencyMs = latestLog?.metadata?.latencyMs

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
              <div className="text-[10.5px] text-[var(--dash-ink-faint)]">
                AI transparency · {isLoading ? "Loading…" : latestLog ? `log #${latestLog.id.slice(0,8)}` : "No logs yet"}
              </div>
            </div>
            <button
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--dash-ink-faint)] hover:bg-[var(--dash-bg)] hover:text-[var(--dash-ink)] transition"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
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
                  {isLoading ? (
                    <div className="space-y-3">
                      <div className="skeleton h-24 w-full rounded-xl" />
                      <div className="skeleton h-20 w-full rounded-xl" />
                    </div>
                  ) : !latestLog ? (
                    <p className="text-[13px] text-[var(--dash-ink-faint)] text-center py-6">
                      No AI decisions recorded yet. Use the Copilot to generate answers.
                    </p>
                  ) : (
                    <>
                      {/* Confidence block */}
                      <div className="flex items-center gap-4 dash-card-raised p-4 rounded-xl">
                        <ConfidenceRing value={val} />
                        <div className="flex-1">
                          <div className={`flex items-center gap-1.5 text-[13.5px] font-bold mb-1 ${val >= 85 ? "text-[var(--dash-sage)]" : val >= 70 ? "text-[var(--dash-amber)]" : "text-[var(--dash-rose)]"}`}>
                            <CheckCircle2 className="w-4 h-4" />
                            {val >= 85 ? "High Confidence" : val >= 70 ? "Moderate Confidence" : "Low Confidence — Review Required"}
                          </div>
                          <p className="text-[11.5px] leading-[1.5] text-[var(--dash-ink-soft)]">
                            {val >= 85
                              ? "The AI response is highly supported by the knowledge base."
                              : "Manual review recommended before sending this response."}
                          </p>
                        </div>
                      </div>

                      {/* Knowledge sources */}
                      {citations.length > 0 && (
                        <Section icon={<BookOpen className="w-3.5 h-3.5" />} label="Knowledge Sources">
                          {citations.map((c, i) => (
                            <SourceRow
                              key={i}
                              name={c.source}
                              path={c.url ?? ""}
                              score={c.score}
                            />
                          ))}
                        </Section>
                      )}

                      {/* Policy checks */}
                      {policyChecks.length > 0 && (
                        <Section icon={<ShieldCheck className="w-3.5 h-3.5" />} label="Policy Checks">
                          {policyChecks.map((p: any, i: number) => (
                            <div key={i} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border ${p.passed ? "bg-[var(--dash-sage-wash)] border-[#CBE0CF]" : "bg-[var(--dash-rose-wash)] border-[#F0CBCB]"}`}>
                              <div className="w-[26px] h-[26px] rounded-md bg-white flex items-center justify-center">
                                {p.passed
                                  ? <ShieldCheck className="w-3.5 h-3.5 text-[var(--dash-sage)]" />
                                  : <AlertTriangle className="w-3.5 h-3.5 text-[var(--dash-rose)]" />}
                              </div>
                              <div>
                                <div className="text-[12px] font-bold text-[var(--dash-ink)]">{p.rule}</div>
                                {p.reason && <div className="text-[10px] text-[var(--dash-ink-soft)]">{p.reason}</div>}
                              </div>
                              <span className={`ml-auto text-[10px] font-bold rounded-md px-1.5 py-0.5 ${p.passed ? "text-[#2f5d3f] bg-white" : "text-[#8a3e3e] bg-white"}`}>
                                {p.passed ? "Passed" : "Flagged"}
                              </span>
                            </div>
                          ))}
                        </Section>
                      )}

                      {/* Hallucination flags */}
                      {hallucinationFlags.length > 0 && (
                        <Section icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Hallucination Flags">
                          {hallucinationFlags.map((f: string, i: number) => (
                            <div key={i} className="text-[11.5px] text-[var(--dash-rose)] flex items-start gap-1.5">
                              <span className="mt-0.5">⚠</span> {f}
                            </div>
                          ))}
                        </Section>
                      )}

                      {/* AI Input/Output */}
                      <Section icon={<Sparkles className="w-3.5 h-3.5" />} label="AI Reasoning">
                        <div className="rounded-lg bg-[var(--dash-bg)] p-3 text-[11.5px] leading-[1.6] text-[var(--dash-ink-soft)] font-mono">
                          <b>Input:</b> {latestLog.input.slice(0, 120)}{latestLog.input.length > 120 ? "…" : ""}<br />
                          <b>Output:</b> {latestLog.output.slice(0, 120)}{latestLog.output.length > 120 ? "…" : ""}
                        </div>
                      </Section>

                      {/* Ticket history placeholder */}
                      <Section icon={<RotateCw className="w-3.5 h-3.5" />} label="Recent logs">
                        <Link href="/dashboard/analytics" className="inline-flex items-center gap-1 text-[11.5px] font-bold text-[var(--dash-accent-deep)] hover:underline">
                          View all audit logs in Analytics →
                        </Link>
                      </Section>

                      <div className="pt-2.5 border-t dash-border-soft text-[10px] text-[var(--dash-ink-faint)] font-mono">
                        Model: {model}{latencyMs ? ` · ${latencyMs}ms` : ""} ·{" "}
                        {latestLog.createdAt ? new Date(latestLog.createdAt).toLocaleString() : ""}
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right column: metadata */}
        <div className="flex flex-col gap-4">
          <DashCard title="Decision metadata" icon={<ShieldCheck className="w-[18px] h-[18px]" />}>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="skeleton h-4 w-full rounded" />
                ))}
              </div>
            ) : latestLog ? (
              <div className="space-y-3 text-[12.5px]">
                <Row k="Confidence" v={`${latestLog.metadata?.confidence ?? "—"}%`} tone={latestLog.metadata?.confidence >= 85 ? "sage" : undefined} />
                <Row k="Citations" v={String(citations.length)} />
                <Row k="Policy checks" v={`${policyChecks.filter((p: any) => p.passed).length}/${policyChecks.length} passed`} />
                <Row k="Hallucination flags" v={String(hallucinationFlags.length)} />
                <Row k="Model" v={model} />
                {latencyMs && <Row k="Latency" v={`${latencyMs}ms`} />}
                <Row k="Created" v={latestLog.createdAt ? new Date(latestLog.createdAt).toLocaleString() : "—"} />
              </div>
            ) : (
              <p className="text-[13px] text-[var(--dash-ink-faint)]">No audit logs yet.</p>
            )}
          </DashCard>

          <DashCard title="Quick links" icon={<ExternalLink className="w-[18px] h-[18px]" />}>
            <div className="space-y-2">
              {[
                { href: "/dashboard/analytics", label: "Full audit log →" },
                { href: "/dashboard/knowledge-base", label: "Manage knowledge base →" },
                { href: "/dashboard/copilot", label: "Back to Copilot →" },
              ].map((l) => (
                <Link key={l.href} href={l.href} className="block text-[12.5px] font-semibold text-[var(--dash-accent-deep)] hover:underline">
                  {l.label}
                </Link>
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
  const color = value >= 85 ? ["#76B98C", "#4A8A60"] : value >= 70 ? ["#E5A84F", "#B07A2A"] : ["#E58080", "#A04040"]

  return (
    <div
      className="relative w-[88px] h-[88px] shrink-0"
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`AI confidence ${value} percent`}
    >
      <svg width={88} height={88} viewBox="0 0 88 88" className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id="ringgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={color[0]} />
            <stop offset="1" stopColor={color[1]} />
          </linearGradient>
        </defs>
        <circle cx="44" cy="44" r={R} stroke="var(--dash-line)" strokeWidth="9" fill="none" />
        <motion.circle
          cx="44" cy="44" r={R}
          stroke="url(#ringgrad)" strokeWidth="9" fill="none"
          strokeLinecap="round" strokeDasharray={circ}
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

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
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
        {path && <div className="text-[10px] text-[var(--dash-ink-faint)] font-mono truncate">{path}</div>}
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
      <span className={`font-semibold ${tone === "sage" ? "text-[var(--dash-sage)]" : "text-[var(--dash-ink)]"}`}>{v}</span>
    </div>
  )
}
