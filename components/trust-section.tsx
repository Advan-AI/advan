"use client"

import { motion } from "framer-motion"
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  FileClock,
  Gauge,
  GitBranch,
  LockKeyhole,
  ScrollText,
  ShieldCheck,
  UserCheck,
} from "lucide-react"

const ENGINE_LAYERS = [
  {
    icon: BookOpenCheck,
    title: "Approved knowledge retrieval",
    body: "Answers can only use versioned docs, reviewed KB articles, CRM facts, and resolved-ticket history.",
    metric: "3.2k",
    metricLabel: "approved sources indexed",
  },
  {
    icon: Gauge,
    title: "Confidence thresholds",
    body: "Each intent has a configurable bar for auto-send, human review, or hard stop.",
    metric: "85%",
    metricLabel: "default send threshold",
  },
  {
    icon: ClipboardCheck,
    title: "Policy validation",
    body: "Refund, privacy, PII, legal, and customer-tier policies run before any response leaves the queue.",
    metric: "12",
    metricLabel: "policy gates checked",
  },
  {
    icon: UserCheck,
    title: "Human approval gates",
    body: "Low confidence, sensitive topics, VIP accounts, and unresolved source conflicts route to agents.",
    metric: "54%",
    metricLabel: "escalation trigger shown",
  },
  {
    icon: ShieldCheck,
    title: "Hallucination prevention",
    body: "Unsupported claims are blocked unless they map to a cited source and pass policy scoring.",
    metric: "0",
    metricLabel: "uncited claims sent",
  },
  {
    icon: FileClock,
    title: "Audit trail generation",
    body: "Every retrieval, draft, score, approval, and policy decision is recorded for review and export.",
    metric: "100%",
    metricLabel: "decisions traceable",
  },
]

const POLICY_RULES = [
  { label: "Source coverage", value: "92%", state: "passed" },
  { label: "PII redaction", value: "on", state: "passed" },
  { label: "Refund policy v2.3", value: "matched", state: "passed" },
  { label: "VIP customer", value: "review", state: "review" },
  { label: "Confidence under threshold", value: "escalate", state: "blocked" },
]

const AUDIT_EVENTS = [
  "query.intent = webhook_timeout",
  "retrieval.sources = docs, kb, ticket",
  "confidence.score = 92",
  "policy.privacy = pass",
  "policy.vip_account = human_review",
  "audit.export = ready",
]

export function TrustSection() {
  return (
    <section id="trust" className="relative overflow-hidden bg-[#101512] py-16 text-white lg:py-24">
      <div
        aria-hidden
        className="absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(760px 420px at 15% 10%, rgba(25,120,105,0.24), transparent 58%), radial-gradient(840px 520px at 86% 8%, rgba(107,92,214,0.22), transparent 56%), linear-gradient(180deg, #101512, #151815)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at center, black 35%, transparent 78%)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#b9f2d0]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#b9f2d0]" aria-hidden />
            Trust Engine
          </div>
          <h2 className="text-3xl font-semibold leading-[1.08] tracking-tight text-white sm:text-4xl lg:text-5xl">
            Governance is not a report.{" "}
            <span className="bg-gradient-to-r from-[#b9f2d0] via-white to-[#c9c0ff] bg-clip-text text-transparent">
              It is the runtime.
            </span>
          </h2>
          <p className="max-w-2xl text-base leading-7 text-white/62 lg:text-lg">
            Advan makes trust visible in the product itself: every AI decision is
            retrieved, scored, validated, approved when needed, and logged.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:gap-7">
          <TrustEngineConsole />
          <div className="grid gap-4 sm:grid-cols-2">
            {ENGINE_LAYERS.map((layer, index) => {
              const Icon = layer.icon
              return (
                <motion.div
                  key={layer.title}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-70px" }}
                  transition={{ duration: 0.48, delay: index * 0.04 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.065] p-5 shadow-[0_22px_70px_-50px_rgba(0,0,0,0.9)] backdrop-blur"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#b9f2d0] ring-1 ring-white/10">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="text-right">
                      <span className="block text-xl font-semibold tracking-tight text-white">
                        {layer.metric}
                      </span>
                      <span className="block text-[10px] font-bold uppercase tracking-[0.13em] text-white/42">
                        {layer.metricLabel}
                      </span>
                    </span>
                  </div>
                  <h3 className="text-base font-semibold tracking-tight text-white">{layer.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/58">{layer.body}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

function TrustEngineConsole() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-[1.75rem] border border-white/12 bg-[#f7f8f2] text-[#171a17] shadow-[0_30px_90px_-50px_rgba(0,0,0,0.95)]"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-black/[0.08] bg-white px-5 py-3.5">
        <div className="flex gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#be6a6a]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#c5883c]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#197869]" />
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-foreground/54">
          <LockKeyhole className="h-3.5 w-3.5" aria-hidden />
          trust-engine / production / ruleset-v4
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#e5f3ed] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#166b5f]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#197869] animate-pulse" />
          enforcing
        </span>
      </div>

      <div className="grid gap-px bg-black/[0.06] lg:grid-cols-[1fr_0.82fr]">
        <div className="bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-foreground/48">
                Decision graph
              </div>
              <h3 className="mt-1 text-xl font-semibold tracking-tight">Auto-send or escalate?</h3>
            </div>
            <span className="rounded-full bg-[#fbefd8] px-2.5 py-1 text-[11px] font-bold text-[#85561d]">
              human gate
            </span>
          </div>

          <div className="relative rounded-2xl border border-black/[0.07] bg-[#fbfcf8] p-4">
            <DecisionRail />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              ["92%", "source coverage"],
              ["85%", "send threshold"],
              ["6", "audit events"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl border border-black/[0.07] bg-[#fbfcf8] px-3 py-2.5">
                <div className="text-lg font-semibold tracking-tight">{value}</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/48">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#fbfcf8] p-5">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-[#4e3fb6]" aria-hidden />
            <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-foreground/48">
              Policy validation
            </div>
          </div>
          <div className="space-y-2">
            {POLICY_RULES.map((rule, index) => (
              <motion.div
                key={rule.label}
                initial={{ opacity: 0, x: 8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
                className="flex items-center gap-2 rounded-xl border border-black/[0.07] bg-white px-3 py-2.5"
              >
                {rule.state === "blocked" ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-[#85561d]" aria-hidden />
                ) : rule.state === "review" ? (
                  <UserCheck className="h-3.5 w-3.5 text-[#4e3fb6]" aria-hidden />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#166b5f]" aria-hidden />
                )}
                <span className="min-w-0 flex-1 text-[12px] font-semibold text-foreground/72">
                  {rule.label}
                </span>
                <span className="rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/48">
                  {rule.value}
                </span>
              </motion.div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-black/[0.07] bg-[#101512] p-4 text-white">
            <div className="mb-2 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/52">
              <ScrollText className="h-3.5 w-3.5 text-[#b9f2d0]" aria-hidden />
              Audit trail
            </div>
            <ul className="space-y-1.5 font-mono text-[11px] leading-relaxed text-white/68">
              {AUDIT_EVENTS.map((event, index) => (
                <motion.li
                  key={event}
                  initial={{ opacity: 0, y: 4 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.28, delay: index * 0.05 }}
                  className="flex items-start gap-2"
                >
                  <span className="text-[#b9f2d0]">{"=>"}</span>
                  <span>{event}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function DecisionRail() {
  const nodes = [
    { icon: BookOpenCheck, label: "Sources", state: "92%", tone: "green" },
    { icon: Gauge, label: "Confidence", state: "54%", tone: "amber" },
    { icon: ClipboardCheck, label: "Policy", state: "review", tone: "violet" },
    { icon: UserCheck, label: "Human", state: "approve", tone: "amber" },
  ]

  return (
    <div className="relative">
      <div className="absolute left-6 right-6 top-6 hidden h-px bg-gradient-to-r from-[#197869] via-[#c5883c] to-[#4e3fb6] sm:block" />
      <div className="grid gap-3 sm:grid-cols-4">
        {nodes.map((node, index) => {
          const Icon = node.icon
          const color =
            node.tone === "green"
              ? "bg-[#e5f3ed] text-[#166b5f] ring-[#b8dece]"
              : node.tone === "amber"
                ? "bg-[#fbefd8] text-[#85561d] ring-[#e7c988]"
                : "bg-[#ece9fb] text-[#4e3fb6] ring-[#c9c0ef]"

          return (
            <motion.div
              key={node.label}
              animate={index === 1 ? { y: [0, -3, 0] } : { y: 0 }}
              transition={{ duration: 1.8, repeat: index === 1 ? Infinity : 0, ease: "easeInOut" }}
              className="relative rounded-xl border border-black/[0.07] bg-white p-3 text-center"
            >
              <span className={`relative z-10 mx-auto flex h-12 w-12 items-center justify-center rounded-xl ring-1 ${color}`}>
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="mt-2 text-[12px] font-bold text-foreground/78">{node.label}</div>
              <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/46">
                {node.state}
              </div>
            </motion.div>
          )
        })}
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#e7c988] bg-[#fff8ec] px-3 py-2.5 text-[12px] font-semibold text-[#6e4b1d]">
        <GitBranch className="h-3.5 w-3.5" aria-hidden />
        Escalation logic routes this request to a human because confidence is below threshold.
      </div>
    </div>
  )
}
