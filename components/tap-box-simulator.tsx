"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronDown,
  Sparkles,
  ShieldCheck,
  BookOpen,
  Brain,
  Clock,
  CheckCircle2,
  User,
  MessageSquare,
} from "lucide-react"

const SOURCES = [
  { label: "Docs / Webhooks v2", tone: "cyan" as const },
  { label: "KB / Timeout-Failures", tone: "violet" as const },
  { label: "Ticket #4821", tone: "blue" as const },
]

const REASONING = [
  "Matched customer query intent to webhook-timeout topic (0.97 sim).",
  "Pulled current default from Docs / Webhooks v2 — 30s timeout, 3 retries.",
  "Cross-checked KB / Timeout-Failures for known regressions — none active.",
]

const HISTORY = [
  { id: "#4821", subject: "Webhook retries firing twice", status: "Resolved" },
  { id: "#4730", subject: "Signature header rotation", status: "Resolved" },
]

export function TapBoxSimulator() {
  const [open, setOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto w-full max-w-[520px]"
    >
      <div className="relative rounded-3xl glass-strong shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-white/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            advan / inbox / live
          </div>
        </div>

        <div className="p-5 space-y-4">
          <CustomerMessage />
          <AiResponse />
          <TapBox open={open} onToggle={() => setOpen((v) => !v)} />
        </div>
      </div>

      <FloatingChip
        className="-top-4 -left-4"
        delay={1.0}
        icon={<ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />}
        label="Source-cited"
      />
      <FloatingChip
        className="-bottom-4 -right-4"
        delay={1.2}
        icon={<Clock className="w-3.5 h-3.5 text-emerald-400" />}
        label="Resolved in 4.2s"
      />
    </motion.div>
  )
}

function CustomerMessage() {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="flex items-start gap-3"
    >
      <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-amber-400/30 to-orange-500/30 border border-white/10 flex items-center justify-center">
        <User className="w-4 h-4 text-amber-200" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-white/70">Maria · Acme Corp</span>
          <span className="text-[10px] text-white/30 font-mono">just now</span>
        </div>
        <div className="rounded-2xl rounded-tl-md bg-white/[0.04] border border-white/[0.06] px-4 py-3 text-sm text-white/85 leading-relaxed">
          How do I configure my webhook timeout?
        </div>
      </div>
    </motion.div>
  )
}

function AiResponse() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.7, duration: 0.5 }}
      className="flex items-start gap-3"
    >
      <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-cyan-400/40 to-blue-500/40 border border-cyan-300/20 flex items-center justify-center shadow-[0_0_16px_rgba(34,211,238,0.3)]">
        <Sparkles className="w-4 h-4 text-cyan-200" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-white/70">Advan AI</span>
          <span className="text-[10px] text-cyan-300/80 font-mono">drafting · explainable</span>
        </div>
        <div className="rounded-2xl rounded-tl-md bg-gradient-to-br from-cyan-500/[0.08] to-blue-500/[0.04] border border-cyan-300/15 px-4 py-3 text-sm text-white/90 leading-relaxed">
          Webhook timeout defaults to <span className="font-mono text-cyan-200">30s</span> with{" "}
          <span className="font-mono text-cyan-200">3 retries</span>. Override per endpoint under
          <span className="text-white"> Settings → Webhooks → Advanced</span>. Want me to draft a
          curl example for your <span className="font-mono text-cyan-200">prod</span> endpoint?
        </div>
      </div>
    </motion.div>
  )
}

function TapBox({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9, duration: 0.5 }}
      className="relative ml-11"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="tapbox-details"
        data-testid="tapbox-toggle"
        className="group w-full flex items-center justify-between gap-3 rounded-2xl glass px-4 py-3 hover:border-cyan-400/30 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Brain className="w-4 h-4 text-cyan-300" />
            <span className="absolute inset-0 blur-md bg-cyan-400/30 rounded-full" aria-hidden />
          </div>
          <span className="text-xs font-medium text-white/85">
            Tap to inspect AI reasoning
          </span>
          <span className="rounded-full bg-cyan-400/10 border border-cyan-400/20 px-2 py-0.5 text-[10px] font-mono text-cyan-200">
            98% confidence
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-white/50 transition-transform duration-300 ${
            open ? "rotate-180 text-cyan-300" : ""
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            id="tapbox-details"
            data-testid="tapbox-details"
            initial={{ height: 0, opacity: 0, y: -6 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-2xl glass p-5 space-y-5 border border-cyan-400/15 shadow-[0_0_40px_-12px_rgba(34,211,238,0.4)]">
              <ConfidenceRow />
              <SourcesRow />
              <ReasoningRow />
              <HistoryRow />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function ConfidenceRow() {
  return (
    <div className="flex items-center gap-5">
      <ConfidenceRing value={98} />
      <div className="flex-1">
        <p className="text-[11px] uppercase tracking-wider text-white/40 font-medium">
          Confidence Score
        </p>
        <p className="mt-1 text-2xl font-semibold text-white" data-testid="confidence-score">
          98<span className="text-white/40 text-base">%</span>
        </p>
        <p className="mt-0.5 text-xs text-white/55">
          High match. Safe to auto-send under enterprise policy.
        </p>
      </div>
    </div>
  )
}

function ConfidenceRing({ value }: { value: number }) {
  const radius = 28
  const circ = 2 * Math.PI * radius
  const offset = circ - (value / 100) * circ

  return (
    <div className="relative w-20 h-20" role="img" aria-label={`Confidence ${value}%`}>
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(188 95% 60%)" />
            <stop offset="100%" stopColor="hsl(152 76% 55%)" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r={radius} stroke="hsl(0 0% 100% / 0.08)" strokeWidth="4" fill="none" />
        <motion.circle
          cx="32"
          cy="32"
          r={radius}
          stroke="url(#ring-grad)"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: "drop-shadow(0 0 6px hsl(188 95% 60% / 0.7))" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <CheckCircle2 className="w-5 h-5 text-emerald-300" />
      </div>
    </div>
  )
}

function SourcesRow() {
  const toneMap = {
    cyan: "bg-cyan-400/10 border-cyan-400/25 text-cyan-200",
    violet: "bg-violet-400/10 border-violet-400/25 text-violet-200",
    blue: "bg-blue-400/10 border-blue-400/25 text-blue-200",
  }
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-white/40 font-medium mb-2">
        Knowledge Sources
      </p>
      <div className="flex flex-wrap gap-2" data-testid="source-badges">
        {SOURCES.map((s, i) => (
          <motion.span
            key={s.label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.3 }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneMap[s.tone]}`}
          >
            <BookOpen className="w-3 h-3" />
            {s.label}
          </motion.span>
        ))}
      </div>
    </div>
  )
}

function ReasoningRow() {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-white/40 font-medium mb-2">
        AI Reasoning
      </p>
      <ol className="space-y-1.5">
        {REASONING.map((step, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.1, duration: 0.3 }}
            className="flex items-start gap-2 text-xs text-white/65 leading-relaxed"
          >
            <span className="mt-1.5 w-1 h-1 rounded-full bg-cyan-300 shrink-0" />
            <span>{step}</span>
          </motion.li>
        ))}
      </ol>
    </div>
  )
}

function HistoryRow() {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-white/40 font-medium mb-2">
        Ticket History
      </p>
      <div className="space-y-1.5">
        {HISTORY.map((h) => (
          <div
            key={h.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="w-3.5 h-3.5 text-white/40 shrink-0" />
              <span className="font-mono text-[11px] text-white/55 shrink-0">{h.id}</span>
              <span className="text-xs text-white/70 truncate">{h.subject}</span>
            </div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-300/90 shrink-0">
              {h.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FloatingChip({
  className,
  icon,
  label,
  delay,
}: {
  className: string
  icon: React.ReactNode
  label: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`absolute glass rounded-full px-3 py-1.5 flex items-center gap-1.5 text-[11px] font-medium text-white/80 shadow-xl ${className}`}
    >
      {icon}
      {label}
    </motion.div>
  )
}
