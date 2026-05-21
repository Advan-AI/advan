"use client"

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Inbox,
  BrainCircuit,
  ShieldCheck,
  Send,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Loader2,
  Activity,
  Clock,
  Zap,
} from "lucide-react"
import { SectionHeader } from "@/components/section-primitives"

/* ─── pipeline data ───────────────────────────────────── */
type StageId = "ingest" | "reason" | "verify" | "resolve"

interface StageDef {
  id: StageId
  icon: React.ElementType
  label: string
  sub: string
  detail: string
  color: string
  wash: string
}

const STAGES: StageDef[] = [
  {
    id: "ingest",
    icon: Inbox,
    label: "Ingest",
    sub: "Email · Chat · Voice · Slack",
    detail: "Unified inbox · channel auto-detected",
    color: "#5A85C3",
    wash: "#E1E9F3",
  },
  {
    id: "reason",
    icon: BrainCircuit,
    label: "Reason",
    sub: "Source-cited · scored",
    detail: "Match intent · retrieve 3 sources · 98% conf.",
    color: "#6B5CD6",
    wash: "#ECE9FB",
  },
  {
    id: "verify",
    icon: ShieldCheck,
    label: "Verify",
    sub: "Policy + redaction",
    detail: "SOC 2 + GDPR checks · human gate if needed",
    color: "#C5883C",
    wash: "#F4E8D3",
  },
  {
    id: "resolve",
    icon: Send,
    label: "Resolve",
    sub: "Reply + sync CRM",
    detail: "Send on customer’s channel · learn outcome",
    color: "#5C9A70",
    wash: "#E3EFE5",
  },
]

const TICKETS = [
  { id: "TK-84219", who: "Maria Lopez",  topic: "Webhook timeout"      },
  { id: "TK-84221", who: "Tom Becker",   topic: "Refund confirmation"  },
  { id: "TK-84224", who: "Priya Shah",   topic: "SSO provisioning"     },
  { id: "TK-84228", who: "Dana Romero",  topic: "Usage report export"  },
]

const STAGE_MS = 1500
const FINISH_MS = 1500 // pause showing "resolved" badge
const CYCLE_LEN = STAGES.length + 1 // ingest, reason, verify, resolve, finished

/* ─── component ──────────────────────────────────────── */
export function WorkflowSection() {
  const [phase, setPhase] = useState(0)        // 0..3 stages, 4 = finished
  const [ticketIdx, setTicketIdx] = useState(0)
  const [latency, setLatency] = useState(0)    // ms-ish ticking counter
  const [throughput, setThroughput] = useState(1284)

  // drive simulation
  useEffect(() => {
    const id = setInterval(
      () => {
        setPhase((p) => {
          const next = (p + 1) % CYCLE_LEN
          if (next === 0) {
            setTicketIdx((t) => (t + 1) % TICKETS.length)
            setLatency(0)
            setThroughput((n) => n + 1)
          }
          return next
        })
      },
      // give 'finished' phase a touch longer
      phase === CYCLE_LEN - 1 ? FINISH_MS : STAGE_MS
    )
    return () => clearInterval(id)
  }, [phase])

  // tick latency
  useEffect(() => {
    if (phase === CYCLE_LEN - 1) return
    const id = setInterval(() => setLatency((l) => l + 0.1), 100)
    return () => clearInterval(id)
  }, [phase])

  const ticket = TICKETS[ticketIdx]
  const finished = phase === CYCLE_LEN - 1
  const activeStageIdx = finished ? STAGES.length - 1 : phase

  return (
    <section id="workflow" className="relative py-14 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Workflow"
          title={
            <>
              From inbound message to{" "}
              <span className="text-gradient-brand">resolved ticket</span> — in seconds
            </>
          }
          lede="Advan handles the full support loop: ingest, reason, verify, resolve. Every step is observable, reversible, and shows you exactly why the AI chose its answer."
        />

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative mt-12 lg:mt-14"
        >
          {/* Halo */}
          <div
            aria-hidden
            className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-[#6B5CD6]/12 via-[#8E80E5]/8 to-[#5C9A70]/12 blur-[60px]"
          />

          {/* Live pipeline console */}
          <div className="relative rounded-3xl border border-black/[0.07] bg-white/70 backdrop-blur-xl shadow-[0_24px_70px_-32px_rgba(60,50,30,0.28)] overflow-hidden">
            {/* Inbound banner */}
            <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-black/[0.06] bg-white/40">
              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#2f5d3f] bg-[#E3EFE5] rounded-full px-2.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5C9A70] animate-pulse" />
                Live pipeline
              </span>

              <AnimatePresence mode="wait">
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 6 }}
                  transition={{ duration: 0.4 }}
                  className="flex items-center gap-2 text-[12px]"
                >
                  <span className="font-mono text-foreground/55">{ticket.id}</span>
                  <span className="text-foreground/75">·</span>
                  <span className="font-bold text-foreground">{ticket.who}</span>
                  <span className="text-foreground/55">·</span>
                  <span className="text-foreground/75">{ticket.topic}</span>
                </motion.div>
              </AnimatePresence>

              <div className="ml-auto flex items-center gap-3 text-[11px] text-foreground/55">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#6B5CD6]" />
                  <motion.span
                    key={Math.floor(latency * 10)}
                    initial={{ opacity: 0, y: -2 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className="font-mono font-bold text-foreground/80"
                  >
                    {finished ? "—" : `${latency.toFixed(1)}s`}
                  </motion.span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Activity className="w-3 h-3 text-[#5A85C3]" />
                  <span className="font-mono font-bold text-foreground/80">
                    {throughput.toLocaleString()}
                  </span>
                  <span>resolved today</span>
                </span>
              </div>
            </div>

            {/* Pipeline track */}
            <div className="relative px-5 lg:px-8 py-8">
              {/* progress rail */}
              <div className="relative">
                <div className="absolute top-[28px] left-[40px] right-[40px] h-1 rounded-full bg-black/[0.05]" />
                <motion.div
                  className="absolute top-[28px] left-[40px] h-1 rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg, #5A85C3 0%, #6B5CD6 35%, #C5883C 70%, #5C9A70 100%)",
                  }}
                  animate={{
                    width: `calc(${
                      finished ? 100 : (phase / (STAGES.length - 1)) * 100
                    }% * (100% - 80px) / 100% )`,
                  }}
                  transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
                />

                {/* stage dots / cards */}
                <ol className="grid grid-cols-4 gap-3 lg:gap-5 relative">
                  {STAGES.map((s, i) => (
                    <StageCard
                      key={s.id}
                      stage={s}
                      index={i}
                      active={i === activeStageIdx && !finished}
                      done={i < activeStageIdx || finished}
                      pending={i > activeStageIdx && !finished}
                    />
                  ))}
                </ol>

                {/* flying packet */}
                <FlyingPacket activeIdx={activeStageIdx} finished={finished} />
              </div>

              {/* result card slides in when finished */}
              <AnimatePresence>
                {finished && (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="mt-8 mx-auto max-w-md rounded-2xl border border-[#5C9A70]/35 bg-[#E3EFE5]/70 px-4 py-3 flex items-center gap-3 shadow-[0_8px_24px_-14px_rgba(92,154,112,0.4)]"
                  >
                    <span className="w-9 h-9 rounded-xl bg-white flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-[#2f5d3f]" />
                    </span>
                    <div className="flex-1">
                      <div className="text-[13.5px] font-bold text-[#1f3f29] leading-tight">
                        Resolved · CSAT 5★ · sent to {ticket.who.split(" ")[0]}
                      </div>
                      <div className="text-[11px] text-[#2f5d3f]">
                        Sources cited · CRM updated · agent zero touches
                      </div>
                    </div>
                    <span className="font-mono text-[12px] font-bold text-[#2f5d3f]">
                      11.8s
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-black/[0.06] bg-white/40">
              {[
                { k: "Latency p95",        v: "< 4s",  d: "first reply" },
                { k: "AI resolution rate", v: "72%",   d: "+9pts qoq" },
                { k: "Re-explain rate",    v: "0%",    d: "vs 38% baseline" },
                { k: "CSAT",               v: "4.86",  d: "+0.22 lift" },
              ].map((it, i) => (
                <div
                  key={it.k}
                  className={`px-4 py-3.5 ${
                    i !== 0 ? "sm:border-l border-black/[0.06]" : ""
                  } ${
                    i >= 2 ? "border-t sm:border-t-0 border-black/[0.06]" : ""
                  }`}
                >
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-foreground/50">
                    {it.k}
                  </div>
                  <div className="mt-0.5 flex items-baseline gap-1.5">
                    <span className="text-[20px] font-bold tracking-tight text-foreground leading-none">
                      {it.v}
                    </span>
                    <span className="text-[11px] text-foreground/55">{it.d}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ─── stage card ─────────────────────────────────────── */
function StageCard({
  stage,
  index,
  active,
  done,
  pending,
}: {
  stage: StageDef
  index: number
  active: boolean
  done: boolean
  pending: boolean
}) {
  const Icon = stage.icon
  return (
    <li className="relative pt-8">
      {/* connector dot above */}
      <motion.span
        className="absolute top-[22px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 z-10"
        animate={{
          background: done ? stage.color : active ? "#fff" : "#fff",
          borderColor: done || active ? stage.color : "rgba(60,50,30,0.18)",
          scale: active ? [1, 1.15, 1] : 1,
          boxShadow: active
            ? [
                `0 0 0 0 ${stage.color}55`,
                `0 0 0 10px ${stage.color}00`,
                `0 0 0 0 ${stage.color}00`,
              ]
            : "0 0 0 0 rgba(0,0,0,0)",
        }}
        transition={{
          scale:     { duration: 1.6, repeat: active ? Infinity : 0, ease: "easeInOut" },
          boxShadow: { duration: 1.6, repeat: active ? Infinity : 0, ease: "easeOut" },
          background: { duration: 0.4 },
          borderColor: { duration: 0.4 },
        }}
      />

      <motion.div
        animate={{
          y: active ? -2 : 0,
          boxShadow: active
            ? "0 14px 32px -18px rgba(60,50,30,0.30)"
            : "0 4px 12px -10px rgba(60,50,30,0.15)",
          borderColor: active
            ? stage.color
            : done
            ? "rgba(92,154,112,0.30)"
            : "rgba(60,50,30,0.08)",
        }}
        transition={{ duration: 0.35 }}
        className="relative rounded-2xl bg-white border px-3.5 py-3.5 lg:px-4 lg:py-4 overflow-hidden"
      >
        {/* Top: icon + step */}
        <div className="flex items-center gap-2.5 mb-2">
          <motion.span
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: stage.wash, color: stage.color }}
            animate={active ? { rotate: [0, 6, -3, 0] } : { rotate: 0 }}
            transition={{ duration: 1.4, repeat: active ? Infinity : 0 }}
          >
            <Icon className="w-5 h-5" />
          </motion.span>
          <div className="min-w-0 flex-1">
            <div className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-foreground/45 font-mono leading-none mb-1">
              Step {String(index + 1).padStart(2, "0")}
            </div>
            <div className="text-[14px] font-bold tracking-tight text-foreground leading-tight">
              {stage.label}
            </div>
          </div>
          <StagePill active={active} done={done} pending={pending} />
        </div>

        <div className="text-[11.5px] text-foreground/55 leading-snug">
          {stage.sub}
        </div>

        {/* Active detail reveal */}
        <AnimatePresence>
          {active && (
            <motion.div
              key="detail"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mt-2.5 pt-2.5 border-t border-black/[0.06] text-[11px] text-foreground/65 leading-snug flex items-start gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin text-[#6B5CD6] mt-[2px] shrink-0" />
                {stage.detail}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </li>
  )
}

function StagePill({
  active,
  done,
  pending,
}: {
  active: boolean
  done: boolean
  pending: boolean
}) {
  if (done)
    return (
      <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 bg-[#E3EFE5] text-[#2f5d3f]">
        <CheckCircle2 className="w-2.5 h-2.5" />
        Done
      </span>
    )
  if (active)
    return (
      <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 bg-[#ECE9FB] text-[#4E3FB6]">
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
        Running
      </span>
    )
  return (
    <span className="text-[9.5px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 bg-black/[0.04] text-foreground/55">
      Pending
    </span>
  )
}

/* ─── flying packet (the message moving through pipeline) ── */
function FlyingPacket({
  activeIdx,
  finished,
}: {
  activeIdx: number
  finished: boolean
}) {
  // Position based on stage index — convert to %
  const pct = finished ? 100 : (activeIdx / (STAGES.length - 1)) * 100
  return (
    <motion.div
      className="absolute -top-2 left-[40px] z-20 pointer-events-none"
      style={{ width: `calc(100% - 80px)` }}
    >
      <motion.div
        animate={{ x: `calc(${pct}% - 14px)` }}
        transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
        className="relative"
      >
        <motion.div
          animate={{
            scale: [1, 1.06, 1],
            boxShadow: [
              "0 0 0 0 rgba(107,92,214,0.45)",
              "0 0 0 8px rgba(107,92,214,0)",
              "0 0 0 0 rgba(107,92,214,0)",
            ],
          }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          className="w-7 h-7 rounded-full flex items-center justify-center shadow-[0_8px_22px_-6px_rgba(107,92,214,0.55)]"
          style={{
            background: "linear-gradient(150deg, #8E80E5 0%, #6B5CD6 50%, #4E3FB6 100%)",
          }}
        >
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
