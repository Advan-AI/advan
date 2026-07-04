"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Mail,
  MessageCircle,
  Phone,
  Slack,
  Globe,
  Check,
  CheckCircle2,
  User,
  AlertCircle,
  Banknote,
  Sparkles,
  Clock,
  Zap,
  ArrowRight,
} from "lucide-react"
import { SectionHeader } from "@/components/section-primitives"

/* ─── data model ─────────────────────────────────────────── */
type Stage = 0 | 1 | 2 | 3

const CHANNELS = [
  {
    id: "email",
    icon: Mail,
    label: "Email",
    time: "9:12 AM",
    preview: "Re: webhook timeout errors",
    color: "#6B5CD6",
    wash: "#ECE9FB",
  },
  {
    id: "chat",
    icon: MessageCircle,
    label: "Live chat",
    time: "10:24 AM",
    preview: "Following up on yesterday's email…",
    color: "#5A85C3",
    wash: "#E1E9F3",
  },
  {
    id: "voice",
    icon: Phone,
    label: "Voice call",
    time: "11:48 AM",
    preview: "Quick call about the invoice",
    color: "#5C9A70",
    wash: "#E3EFE5",
  },
] as const

const SECONDARY_CHANNELS = [
  { icon: Slack, label: "Slack" },
  { icon: Globe, label: "Web" },
]

const CONTEXT_GROWTH: Array<{
  stage: Stage
  icon: typeof User
  label: string
  meta: string
  tone: "violet" | "blue" | "amber" | "sage"
}> = [
  { stage: 0, icon: User,          label: "Maria Lopez · Acme",   meta: "Enterprise · CSM Jordan",       tone: "violet" },
  { stage: 1, icon: AlertCircle,   label: "Webhook signature",     meta: "Pending since May 18",          tone: "amber" },
  { stage: 2, icon: Banknote,      label: "Billing FX mismatch",   meta: "$1,240 invoice line",           tone: "blue" },
  { stage: 3, icon: CheckCircle2,  label: "Resolved · CSAT 5★",    meta: "Auto-summarized to CRM",        tone: "sage" },
]

const TIMELINE: Array<{ stage: Stage; label: string; sub: string }> = [
  { stage: 0, label: "Inbound email",      sub: "Webhook timeout error" },
  { stage: 1, label: "Switched to chat",    sub: "+1 follow-up, same thread" },
  { stage: 2, label: "Voice call",          sub: "Billing question, no re-explain" },
  { stage: 3, label: "Resolved by Advan",   sub: "12s total agent time" },
]

const KPIS = [
  { k: "Re-explain rate",       v: "0%",   d: "vs 38% industry" },
  { k: "Context retention",     v: "100%", d: "across handoffs" },
  { k: "Mean wait reduction",   v: "−84%", d: "first → final reply" },
]

const STAGE_COUNT = CHANNELS.length + 1 // 4

/* ─── section ────────────────────────────────────────────── */
export function MemorySection() {
  const [stage, setStage] = useState<Stage>(0)
  const [running, setRunning] = useState(true)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setStage((s) => ((s + 1) % STAGE_COUNT) as Stage)
    }, 2600)
    return () => clearInterval(id)
  }, [running])

  return (
    <section id="memory" className="relative py-14 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Cross-channel memory"
          title={
            <>
              One customer, one memory —{" "}
              <span className="text-gradient-brand">across every channel</span>
            </>
          }
          lede="Conversations don’t reset when a customer switches from chat to email to a call. Advan keeps full context — entitlements, history, tone — wherever they reach you."
        />

        {/* Stage track + replay */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="mt-10 mb-5 flex items-center justify-center gap-3"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/70 backdrop-blur px-3 py-1.5">
            {Array.from({ length: STAGE_COUNT }).map((_, i) => {
              const active = i === stage
              return (
                <button
                  key={i}
                  onClick={() => {
                    setRunning(false)
                    setStage(i as Stage)
                  }}
                  className={`flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2 py-0.5 transition ${
                    active
                      ? "bg-[#ECE9FB] text-[#4E3FB6]"
                      : "text-foreground/45 hover:text-foreground/80"
                  }`}
                  aria-label={`Jump to step ${i + 1}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      active ? "bg-[#6B5CD6]" : "bg-foreground/30"
                    }`}
                  />
                  {i < CHANNELS.length ? CHANNELS[i].label : "Resolution"}
                </button>
              )
            })}
          </div>
          <button
            onClick={() => setRunning((v) => !v)}
            className="text-[11.5px] font-bold inline-flex items-center gap-1.5 text-[#4E3FB6] hover:underline"
          >
            {running ? "Pause" : "Replay"}
            <Zap className="w-3 h-3" />
          </button>
        </motion.div>

        {/* Main canvas */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-[#6B5CD6]/12 via-[#8E80E5]/8 to-[#5C9A70]/10 blur-3xl" aria-hidden />
          <div className="relative rounded-3xl border border-black/[0.07] bg-white/65 backdrop-blur-xl overflow-hidden shadow-[0_20px_60px_-30px_rgba(60,50,30,0.25)]">
            {/* Subtle grid */}
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(15,23,42,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.6) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
                maskImage:
                  "radial-gradient(circle at center, black 30%, transparent 75%)",
              }}
            />

            <div className="relative grid grid-cols-1 lg:grid-cols-[1.05fr_1.2fr_1fr] gap-6 lg:gap-4 p-6 lg:p-8 items-stretch min-h-[520px]">
              <ChannelLane stage={stage} />
              <MemoryCore stage={stage} />
              <JourneyPanel stage={stage} />
            </div>

            {/* Bottom KPI strip */}
            <div className="relative grid grid-cols-1 sm:grid-cols-3 border-t border-black/[0.06] bg-white/40">
              {KPIS.map((k, i) => (
                <div
                  key={k.k}
                  className={`px-5 py-4 ${i !== 0 ? "sm:border-l border-black/[0.06]" : ""}`}
                >
                  <div className="text-[11px] font-bold uppercase tracking-[0.13em] text-foreground/50">
                    {k.k}
                  </div>
                  <div className="mt-0.5 flex items-baseline gap-2">
                    <span className="text-[22px] font-bold tracking-tight text-foreground leading-none">
                      {k.v}
                    </span>
                    <span className="text-[11.5px] text-foreground/55">{k.d}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Floating activity chips */}
          <FloatingActivity stage={stage} />
        </motion.div>

        {/* Before vs after micro comparison */}
        <BeforeAfter />
      </div>
    </section>
  )
}

/* ─── left: channel lane ────────────────────────────────── */
function ChannelLane({ stage }: { stage: Stage }) {
  return (
    <div className="relative flex flex-col gap-3">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-foreground/50 mb-1 px-1">
        Touchpoints
      </div>

      {CHANNELS.map((c, i) => {
        const Icon = c.icon
        const status: "active" | "synced" | "queued" =
          i < stage ? "synced" : i === stage ? "active" : "queued"
        const isActive = status === "active"
        const isSynced = status === "synced"
        return (
          <motion.div
            key={c.id}
            animate={
              isActive
                ? { scale: [1, 1.02, 1], boxShadow: ["0 0 0 rgba(107,92,214,0)", `0 0 0 6px rgba(107,92,214,0.10)`, "0 0 0 rgba(107,92,214,0)"] }
                : { scale: 1, boxShadow: "0 0 0 rgba(0,0,0,0)" }
            }
            transition={isActive ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
            className={`relative flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 transition-colors ${
              isActive
                ? "border-[var(--dash-accent,#6B5CD6)]"
                : isSynced
                ? "border-[#5C9A70]/35"
                : "border-black/[0.08]"
            }`}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: c.wash,
                color: c.color,
              }}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-foreground leading-tight">
                  {c.label}
                </span>
                <span className="ml-auto text-[10px] font-mono text-foreground/45">
                  {c.time}
                </span>
              </div>
              <div className="text-[11.5px] text-foreground/55 truncate">{c.preview}</div>
            </div>
            <StatusPip status={status} />
          </motion.div>
        )
      })}

      <div className="mt-2 flex items-center gap-2.5 px-1">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-foreground/45">
          Also unified
        </span>
        {SECONDARY_CHANNELS.map((c) => {
          const Icon = c.icon
          return (
            <span
              key={c.label}
              className="inline-flex items-center gap-1 text-[11px] text-foreground/55 bg-white/70 border border-black/[0.06] rounded-md px-1.5 py-0.5"
            >
              <Icon className="w-3 h-3" />
              {c.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function StatusPip({ status }: { status: "active" | "synced" | "queued" }) {
  if (status === "synced")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#2f5d3f] bg-[#E3EFE5] rounded-md px-1.5 py-0.5">
        <Check className="w-2.5 h-2.5" />
        Synced
      </span>
    )
  if (status === "active")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#4E3FB6] bg-[#ECE9FB] rounded-md px-1.5 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#6B5CD6] animate-pulse" />
        Live
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-foreground/45 bg-black/[0.04] rounded-md px-1.5 py-0.5">
      Queued
    </span>
  )
}

/* ─── center: memory core ────────────────────────────────── */
function MemoryCore({ stage }: { stage: Stage }) {
  // visible context = grows with stage
  const visible = CONTEXT_GROWTH.filter((c) => c.stage <= stage)
  // Packet animation: only emit while a channel exists for this stage (0..2)
  const packetChannel = CHANNELS.at(stage)

  return (
    <div className="relative flex flex-col items-center justify-center min-h-[460px]">
      {packetChannel && (
        <AnimatePresence>
          <Packet key={stage} color={packetChannel.color} />
        </AnimatePresence>
      )}

      {/* Context list */}
      <div className="w-full max-w-[300px] space-y-2">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-foreground/50 mb-1.5 text-center">
          What Advan knows about Maria
        </div>
        <AnimatePresence initial={false}>
          {visible.map((c) => (
            <ContextRow
              key={c.label}
              icon={c.icon}
              label={c.label}
              meta={c.meta}
              tone={c.tone}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

function Packet({ color }: { color: string }) {
  // Travels from left → center, then fades into orb
  return (
    <motion.span
      initial={{ x: -260, y: -10, opacity: 0, scale: 0.6 }}
      animate={{
        x: [-260, -80, 0],
        y: [-10, 0, 0],
        opacity: [0, 1, 0],
        scale: [0.6, 1, 0.4],
      }}
      transition={{ duration: 1.6, ease: [0.4, 0, 0.2, 1] }}
      className="absolute top-1/2 left-1/2 -translate-y-1/2 -ml-3 z-20 w-3 h-3 rounded-full"
      style={{
        background: color,
        boxShadow: `0 0 14px ${color}, 0 0 28px ${color}80`,
      }}
    />
  )
}

const TONE_BG: Record<string, string> = {
  violet: "bg-[#ECE9FB] text-[#4E3FB6]",
  blue:   "bg-[#E1E9F3] text-[#244e8a]",
  amber:  "bg-[#F4E8D3] text-[#8a5a1e]",
  sage:   "bg-[#E3EFE5] text-[#2f5d3f]",
}

function ContextRow({
  icon: Icon,
  label,
  meta,
  tone,
}: {
  icon: typeof User
  label: string
  meta: string
  tone: "violet" | "blue" | "amber" | "sage"
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 8, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-2.5 rounded-lg border border-black/[0.06] bg-white px-2.5 py-2"
    >
      <span
        className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${TONE_BG[tone]}`}
      >
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="min-w-0">
        <div className="text-[12.5px] font-bold text-foreground leading-tight truncate">
          {label}
        </div>
        <div className="text-[10.5px] text-foreground/55 truncate">{meta}</div>
      </div>
    </motion.div>
  )
}

/* ─── right: journey timeline ────────────────────────────── */
function JourneyPanel({ stage }: { stage: Stage }) {
  return (
    <div className="relative flex flex-col">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-foreground/50 mb-2 px-1">
        Customer journey
      </div>

      <div className="relative rounded-xl border border-black/[0.06] bg-white px-4 py-4 flex-1">
        {/* Vertical line */}
        <div className="absolute left-[27px] top-7 bottom-7 w-px bg-black/[0.06]" />
        <div
          className="absolute left-[27px] top-7 w-px bg-gradient-to-b from-[#6B5CD6] to-[#5C9A70] transition-all duration-700 ease-out"
          style={{ height: `${(stage / (STAGE_COUNT - 1)) * 100}%`, maxHeight: "calc(100% - 56px)" }}
        />

        <ul className="space-y-4">
          {TIMELINE.map((t, i) => {
            const done = i < stage
            const active = i === stage
            return (
              <li key={t.label} className="relative flex items-start gap-3.5 pl-1">
                <motion.span
                  animate={
                    active
                      ? {
                          scale: [1, 1.15, 1],
                          boxShadow: [
                            "0 0 0 0 rgba(107,92,214,0.4)",
                            "0 0 0 8px rgba(107,92,214,0)",
                            "0 0 0 0 rgba(107,92,214,0)",
                          ],
                        }
                      : { scale: 1, boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
                  }
                  transition={
                    active ? { duration: 1.6, repeat: Infinity } : { duration: 0.3 }
                  }
                  className={`relative z-10 w-[18px] h-[18px] rounded-full mt-0.5 flex items-center justify-center shrink-0 border-2 ${
                    done
                      ? "bg-[#5C9A70] border-[#5C9A70]"
                      : active
                      ? "bg-white border-[#6B5CD6]"
                      : "bg-white border-black/15"
                  }`}
                >
                  {done && <Check className="w-2.5 h-2.5 text-white" />}
                  {active && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6B5CD6]" />
                  )}
                </motion.span>
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-[13px] font-bold leading-tight ${
                      done || active ? "text-foreground" : "text-foreground/55"
                    }`}
                  >
                    {t.label}
                  </div>
                  <div className="text-[11.5px] text-foreground/55">{t.sub}</div>
                </div>
              </li>
            )
          })}
        </ul>

        {/* Result card revealed at final stage */}
        <AnimatePresence>
          {stage === 3 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.4 }}
              className="mt-5 rounded-xl border border-[#5C9A70]/40 bg-[#E3EFE5]/70 px-3.5 py-3 flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 text-[#2f5d3f] mt-0.5 shrink-0" />
              <div>
                <div className="text-[12.5px] font-bold text-[#1f3f29] leading-tight">
                  Resolved without re-explaining once
                </div>
                <div className="text-[11px] text-[#2f5d3f]">
                  3 channels · 12s agent time · CRM auto-updated
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ─── floating activity chips ────────────────────────────── */
function FloatingActivity({ stage }: { stage: Stage }) {
  const labels: Record<Stage, { label: string; icon: typeof Clock; cls: string }> = {
    0: { label: "Email synced · 0.2s",    icon: Clock,         cls: "bg-[#ECE9FB] text-[#4E3FB6]"   },
    1: { label: "Chat joined · 0.4s",     icon: ArrowRight,    cls: "bg-[#E1E9F3] text-[#244e8a]"   },
    2: { label: "Voice transcribed · 1.1s", icon: Phone,       cls: "bg-[#E3EFE5] text-[#2f5d3f]"   },
    3: { label: "Resolved · CSAT 5★",     icon: CheckCircle2,  cls: "bg-[#E3EFE5] text-[#2f5d3f]"   },
  }
  const a = labels[stage]
  const Icon = a.icon
  return (
    <div className="pointer-events-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={stage}
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.95 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className={`absolute -top-3 right-6 lg:right-10 inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] px-3 py-1.5 text-[11.5px] font-bold shadow-[0_6px_18px_-10px_rgba(60,50,30,0.3)] ${a.cls}`}
        >
          <Icon className="w-3 h-3" />
          {a.label}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ─── before vs after ────────────────────────────────────── */
function BeforeAfter() {
  return (
    <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-black/[0.06] bg-white/55 p-5 lift">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#8a3e3e]">
            Without Advan
          </span>
          <span className="text-[10px] font-mono text-foreground/45">fragmented</span>
        </div>
        <div className="space-y-2">
          {["Email thread", "Chat ticket #4821", "Voice call #4730"].map((s) => (
            <div
              key={s}
              className="flex items-center justify-between rounded-lg border border-black/[0.06] bg-white px-3 py-2 text-[12.5px]"
            >
              <span className="text-foreground/75">{s}</span>
              <span className="text-[10.5px] font-bold text-[#8a3e3e] bg-[#F1DFDE] rounded px-1.5 py-0.5">
                isolated
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11.5px] text-foreground/55">
          Each agent starts from zero. Customer re-explains 3× → frustration, churn.
        </p>
      </div>

      <div className="rounded-2xl border border-[#6B5CD6]/25 bg-gradient-to-br from-[#ECE9FB]/60 to-white p-5 lift">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#4E3FB6]">
            With Advan
          </span>
          <span className="text-[10px] font-mono text-foreground/45">unified</span>
        </div>
        <div className="rounded-xl border border-[#6B5CD6]/30 bg-white px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-[#ECE9FB] flex items-center justify-center text-[#4E3FB6]">
              <Sparkles className="w-3 h-3" />
            </span>
            <span className="text-[12.5px] font-bold text-foreground">Maria · single thread</span>
            <span className="ml-auto text-[10.5px] font-bold text-[#2f5d3f] bg-[#E3EFE5] rounded px-1.5 py-0.5">
              live
            </span>
          </div>
          <div className="mt-2 space-y-1.5">
            {["Email · webhook timeout", "Chat · followed up", "Voice · invoice"].map((s, i) => (
              <div key={s} className="flex items-center gap-2 text-[11.5px] text-foreground/65">
                <span className="w-1 h-1 rounded-full bg-[#6B5CD6]" />
                {s}
                {i === 2 && (
                  <span className="ml-auto text-[10px] font-bold text-[#2f5d3f]">resolved</span>
                )}
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 text-[11.5px] text-foreground/55">
          One memory across channels. Zero re-explains. <b className="text-foreground/80">−84% wait time</b>.
        </p>
      </div>
    </div>
  )
}
