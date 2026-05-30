"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  MessageSquare,
  Brain,
  BookOpen,
  ShieldCheck,
  UserCheck,
  Sparkles,
  PhoneCall,
  Banknote,
  Send,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Activity,
  Clock,
  Database,
  ArrowUpRight,
  Layers,
  Workflow,
  ChevronDown,
} from "lucide-react"
import { SectionHeader } from "@/components/section-primitives"

/* ─── types ────────────────────────────────────────────── */
type AgentId =
  | "triage"
  | "knowledge"
  | "billing"
  | "voice"
  | "policy"
  | "composer"
  | "human"

type AgentState =
  | "idle"
  | "thinking"
  | "processing"
  | "waiting"
  | "escalated"
  | "resolved"

type Tone = "violet" | "blue" | "amber" | "rose" | "sage" | "slate"

interface AgentDef {
  id: AgentId
  label: string
  role: string
  icon: React.ElementType
  tone: Tone
  x: number
  y: number
  memory: string[]
}

interface Edge {
  from: AgentId
  to: AgentId
}

interface LogEvent {
  ts: string
  who: AgentId
  message: string
  tone: "info" | "ok" | "warn" | "err"
}

interface Stage {
  states: Partial<Record<AgentId, AgentState>>
  edges: Edge[]
  log: { who: AgentId; message: string; tone: "info" | "ok" | "warn" | "err" }
  banner?: string
}

/* ─── canvas layout (relative grid coords) ─────────────── */
const NODE_W = 156
const NODE_H = 62
const CANVAS_W = 720
const CANVAS_H = 440

const AGENTS: AgentDef[] = [
  {
    id: "triage",
    label: "Triage",
    role: "Intent classifier",
    icon: Brain,
    tone: "violet",
    x: 40,
    y: 190,
    memory: ["Detects intent in 60ms", "98% routing accuracy"],
  },
  {
    id: "knowledge",
    label: "Knowledge",
    role: "Docs · KB · Tickets",
    icon: BookOpen,
    tone: "blue",
    x: 270,
    y: 50,
    memory: ["Vector search across 12k docs", "Source-cited retrieval"],
  },
  {
    id: "billing",
    label: "Billing Specialist",
    role: "Invoice + refund logic",
    icon: Banknote,
    tone: "amber",
    x: 270,
    y: 190,
    memory: ["Reads from Stripe + ERP", "Applies refund policy v2.3"],
  },
  {
    id: "voice",
    label: "Voice Agent",
    role: "Call transcription",
    icon: PhoneCall,
    tone: "sage",
    x: 270,
    y: 330,
    memory: ["Real-time STT", "Sentiment + tone capture"],
  },
  {
    id: "policy",
    label: "Policy Guard",
    role: "Compliance + redaction",
    icon: ShieldCheck,
    tone: "rose",
    x: 500,
    y: 190,
    memory: ["SOC 2 + GDPR rules", "Blocks unsafe sends"],
  },
  {
    id: "composer",
    label: "Composer",
    role: "Draft & send reply",
    icon: Sparkles,
    tone: "violet",
    x: 700,
    y: 100,
    memory: ["Personalizes tone", "Tracks CSAT outcomes"],
  },
  {
    id: "human",
    label: "Human-in-loop",
    role: "Agent approval",
    icon: UserCheck,
    tone: "amber",
    x: 700,
    y: 290,
    memory: ["Approves edge cases", "Edits AI drafts inline"],
  },
]

const TONE: Record<
  Tone,
  { fg: string; bg: string; border: string; flow: string }
> = {
  violet: { fg: "#4E3FB6", bg: "#ECE9FB", border: "rgba(107,92,214,0.40)",  flow: "#6B5CD6" },
  blue:   { fg: "#244e8a", bg: "#E1E9F3", border: "rgba(90,133,195,0.40)",  flow: "#5A85C3" },
  amber:  { fg: "#8a5a1e", bg: "#F4E8D3", border: "rgba(197,136,60,0.40)",  flow: "#C5883C" },
  rose:   { fg: "#8a3e3e", bg: "#F1DFDE", border: "rgba(190,106,106,0.40)", flow: "#BE6A6A" },
  sage:   { fg: "#2f5d3f", bg: "#E3EFE5", border: "rgba(92,154,112,0.40)",  flow: "#5C9A70" },
  slate:  { fg: "#2A2520", bg: "#EDE7DA", border: "rgba(60,50,30,0.20)",    flow: "#6E6656" },
}

/* ─── pipeline simulation ──────────────────────────────── */
const STAGES: Stage[] = [
  {
    states: { triage: "thinking" },
    edges: [],
    banner: "Inbound · Maria Lopez · Email",
    log: { who: "triage",  tone: "info", message: "Received inbound · classifying intent" },
  },
  {
    states: { triage: "resolved", knowledge: "processing", billing: "processing" },
    edges: [
      { from: "triage", to: "knowledge" },
      { from: "triage", to: "billing" },
    ],
    banner: "Routed to Knowledge + Billing in parallel",
    log: { who: "triage", tone: "ok", message: "Intent = Billing/Overcharge · delegating to 2 agents" },
  },
  {
    states: {
      triage: "resolved",
      knowledge: "resolved",
      billing: "processing",
      voice: "waiting",
    },
    edges: [
      { from: "knowledge", to: "policy" },
      { from: "triage", to: "billing" },
    ],
    banner: "Knowledge retrieved · 3 sources cited",
    log: { who: "knowledge", tone: "ok", message: "Retrieved Docs/Billing-Overcharges (98% match) + 2 more" },
  },
  {
    states: {
      triage: "resolved",
      knowledge: "resolved",
      billing: "resolved",
      policy: "thinking",
    },
    edges: [
      { from: "billing", to: "policy" },
      { from: "knowledge", to: "policy" },
    ],
    banner: "Policy Guard reviewing draft",
    log: { who: "billing", tone: "ok", message: "Refund eligibility confirmed · $49.00 within policy" },
  },
  {
    states: {
      triage: "resolved",
      knowledge: "resolved",
      billing: "resolved",
      policy: "escalated",
      human: "thinking",
    },
    edges: [{ from: "policy", to: "human" }],
    banner: "Policy escalates to human · refund > $25",
    log: { who: "policy", tone: "warn", message: "Refund > $25 → human approval required" },
  },
  {
    states: {
      triage: "resolved",
      knowledge: "resolved",
      billing: "resolved",
      policy: "resolved",
      human: "resolved",
      composer: "processing",
    },
    edges: [{ from: "human", to: "composer" }],
    banner: "Sarah J. approved · composing reply",
    log: { who: "human", tone: "ok", message: "Approved by Sarah J. · routing to Composer" },
  },
  {
    states: {
      triage: "resolved",
      knowledge: "resolved",
      billing: "resolved",
      policy: "resolved",
      human: "resolved",
      composer: "resolved",
    },
    edges: [{ from: "composer", to: "triage" /* loop close */ }],
    banner: "Resolved · sent · CSAT 5★",
    log: { who: "composer", tone: "ok", message: "Reply sent · ticket #TK-84219 resolved in 12s" },
  },
]

const STAGE_DURATION = 2400

/* ─── component ────────────────────────────────────────── */
export function OrchestrationSection() {
  const [stage, setStage] = useState(0)
  const [running, setRunning] = useState(true)
  const [expanded, setExpanded] = useState<AgentId | null>(null)
  const [events, setEvents] = useState<LogEvent[]>([])
  const [stats, setStats] = useState({
    handled: 1284,
    p95: 3.6,
    success: 98.4,
  })

  // advance stage on timer
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setStage((s) => (s + 1) % STAGES.length)
    }, STAGE_DURATION)
    return () => clearInterval(id)
  }, [running])

  // push event log when stage changes
  useEffect(() => {
    const cur = STAGES[stage]
    const ts = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    setEvents((prev) =>
      [{ ts, who: cur.log.who, message: cur.log.message, tone: cur.log.tone }, ...prev].slice(0, 14)
    )
    // micro-bump KPIs on resolution
    if (stage === STAGES.length - 1) {
      setStats((s) => ({
        handled: s.handled + 1,
        p95: +(3.4 + Math.random() * 0.4).toFixed(2),
        success: +(98.0 + Math.random() * 0.9).toFixed(1),
      }))
    }
  }, [stage])

  const cur = STAGES[stage]

  const agentState = useCallback(
    (id: AgentId): AgentState => cur.states[id] ?? "idle",
    [cur]
  )

  const activeEdges = cur.edges

  return (
    <section id="orchestration" className="relative py-14 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Agent Orchestration"
          title={
            <>
              An AI ops center where specialists{" "}
              <span className="text-gradient-brand">collaborate in real time</span>
            </>
          }
          lede="Watch Advan’s autonomous agents triage, retrieve, gate, and escalate — coordinated by a policy-aware orchestrator with a human always one click away."
        />

        {/* Top control bar */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="mt-9 mb-5 flex flex-wrap items-center justify-center gap-3"
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/70 backdrop-blur px-3 py-1.5">
            {STAGES.map((_, i) => {
              const active = i === stage
              return (
                <button
                  key={i}
                  onClick={() => {
                    setRunning(false)
                    setStage(i)
                  }}
                  aria-label={`Jump to stage ${i + 1}`}
                  className={`text-[10.5px] font-bold rounded-full w-6 h-6 inline-flex items-center justify-center transition ${
                    active
                      ? "bg-[#ECE9FB] text-[#4E3FB6]"
                      : i < stage
                      ? "bg-[#E3EFE5] text-[#2f5d3f]"
                      : "text-foreground/45 hover:text-foreground/75"
                  }`}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
          <button
            onClick={() => setRunning((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#4E3FB6] hover:underline"
          >
            {running ? "Pause" : "Replay"}
            <Zap className="w-3 h-3" />
          </button>
          <span className="text-[11.5px] text-foreground/55 inline-flex items-center gap-1.5">
            <Activity className="w-3 h-3" />
            {cur.banner}
          </span>
        </motion.div>

        {/* Main ops console */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <div
            aria-hidden
            className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-[#6B5CD6]/14 via-[#8E80E5]/8 to-[#5C9A70]/12 blur-3xl"
          />
          <div className="relative rounded-3xl border border-black/[0.07] bg-white/65 backdrop-blur-xl overflow-hidden shadow-[0_24px_70px_-32px_rgba(60,50,30,0.28)]">
            {/* Console chrome */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-black/[0.06] bg-white/40">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#BE6A6A]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#C5883C]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#5C9A70]" />
              </div>
              <div className="text-[11.5px] font-mono text-foreground/55 flex items-center gap-1.5">
                <Workflow className="w-3 h-3" />
                advan / orchestrator / webhook-support-v2
              </div>
              <div className="ml-auto flex items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 text-[#2f5d3f] bg-[#E3EFE5] rounded-full px-2 py-0.5 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5C9A70] animate-pulse" />
                  Live
                </span>
                <span className="font-mono text-foreground/45">
                  ▲ {stats.handled.toLocaleString()} handled today
                </span>
              </div>
            </div>

            {/* Body — 3 columns */}
            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_280px] gap-px bg-black/[0.05]">
              {/* Agent fleet */}
              <div className="bg-white/55 px-4 py-4">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-foreground/50 mb-2.5 flex items-center gap-1.5">
                  <Layers className="w-3 h-3" />
                  Agent fleet
                </div>
                <ul className="space-y-1.5">
                  {AGENTS.map((a) => {
                    const st = agentState(a.id)
                    const open = expanded === a.id
                    return (
                      <AgentRow
                        key={a.id}
                        agent={a}
                        state={st}
                        expanded={open}
                        onToggle={() => setExpanded((p) => (p === a.id ? null : a.id))}
                      />
                    )
                  })}
                </ul>
              </div>

              {/* Live flow canvas */}
              <div className="relative bg-white/40 overflow-hidden">
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-[0.07]"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle, rgba(60,50,30,0.55) 1px, transparent 1px)",
                    backgroundSize: "22px 22px",
                  }}
                />
                <div className="relative" style={{ minHeight: CANVAS_H }}>
                  {/* SVG edges layer */}
                  <svg
                    viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    preserveAspectRatio="xMidYMid meet"
                    aria-hidden
                  >
                    <defs>
                      {(["violet", "blue", "amber", "rose", "sage"] as Tone[]).map((t) => (
                        <marker
                          key={t}
                          id={`arrow-${t}`}
                          markerWidth="7"
                          markerHeight="7"
                          refX="6"
                          refY="3.5"
                          orient="auto"
                        >
                          <path d="M0,0 L0,7 L7,3.5 z" fill={TONE[t].flow} />
                        </marker>
                      ))}
                    </defs>

                    {/* Static edges (faint) */}
                    {staticEdges().map((e, i) => {
                      const path = edgePath(e.from, e.to)
                      if (!path) return null
                      return (
                        <path
                          key={`s-${i}`}
                          d={path}
                          stroke="rgba(60,50,30,0.16)"
                          strokeWidth={1.3}
                          fill="none"
                          strokeDasharray="3 5"
                        />
                      )
                    })}

                    {/* Active edges */}
                    {activeEdges.map((e, i) => {
                      const path = edgePath(e.from, e.to)
                      if (!path) return null
                      const fromTone = AGENTS.find((a) => a.id === e.from)?.tone ?? "violet"
                      return (
                        <motion.path
                          key={`a-${stage}-${i}`}
                          d={path}
                          stroke={TONE[fromTone].flow}
                          strokeWidth={2.4}
                          strokeLinecap="round"
                          strokeDasharray="6 7"
                          fill="none"
                          markerEnd={`url(#arrow-${fromTone})`}
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 1, strokeDashoffset: [0, -26] }}
                          transition={{
                            pathLength: { duration: 0.8, ease: "easeOut" },
                            opacity:    { duration: 0.3 },
                            strokeDashoffset: { duration: 1.0, repeat: Infinity, ease: "linear" },
                          }}
                        />
                      )
                    })}
                  </svg>

                  {/* Nodes (HTML on top of SVG) */}
                  <div className="absolute inset-0">
                    <ResponsiveCanvasOverlay>
                      {AGENTS.map((a) => (
                        <CanvasNode
                          key={a.id}
                          agent={a}
                          state={agentState(a.id)}
                        />
                      ))}
                    </ResponsiveCanvasOverlay>
                  </div>

                  {/* Stage banner ribbon (bottom) */}
                  <div className="absolute inset-x-0 bottom-0 px-4 py-2.5 bg-gradient-to-t from-white via-white/85 to-transparent">
                    <div className="flex items-center gap-2 text-[11.5px]">
                      <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-foreground/45">
                        Stage {stage + 1}/{STAGES.length}
                      </span>
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={stage}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.3 }}
                          className="text-foreground/75 font-semibold truncate"
                        >
                          {cur.banner}
                        </motion.span>
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right — execution trace + KPIs */}
              <div className="bg-white/55 flex flex-col">
                {/* KPIs */}
                <div className="grid grid-cols-3 border-b border-black/[0.06]">
                  {[
                    { k: "Handled", v: stats.handled.toLocaleString() },
                    { k: "p95",     v: `${stats.p95}s` },
                    { k: "Success", v: `${stats.success}%` },
                  ].map((s, i) => (
                    <div
                      key={s.k}
                      className={`px-3 py-3 ${i !== 0 ? "border-l border-black/[0.06]" : ""}`}
                    >
                      <div className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-foreground/50">
                        {s.k}
                      </div>
                      <div className="text-[16px] font-bold tracking-tight text-foreground leading-none mt-0.5">
                        {s.v}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Execution trace */}
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-foreground/50 flex items-center gap-1.5">
                    <Activity className="w-3 h-3" />
                    Execution trace
                  </div>
                  <span className="text-[10px] font-mono text-foreground/45">
                    last {events.length}
                  </span>
                </div>
                <div className="flex-1 overflow-hidden relative">
                  <div className="px-3 pb-3 space-y-1.5 max-h-[380px] overflow-y-auto">
                    <AnimatePresence initial={false}>
                      {events.map((e, i) => {
                        const agent = AGENTS.find((a) => a.id === e.who)
                        if (!agent) return null
                        const Icon = agent.icon
                        const tone = agent.tone
                        const dotCls =
                          e.tone === "err"
                            ? "bg-[#BE6A6A]"
                            : e.tone === "warn"
                            ? "bg-[#C5883C]"
                            : e.tone === "ok"
                            ? "bg-[#5C9A70]"
                            : "bg-[#6B5CD6]"
                        return (
                          <motion.div
                            key={`${e.ts}-${i}`}
                            initial={{ opacity: 0, y: -4, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="flex items-start gap-2.5 rounded-lg border border-black/[0.05] bg-white px-2.5 py-2"
                          >
                            <span
                              className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                              style={{ background: TONE[tone].bg, color: TONE[tone].fg }}
                            >
                              <Icon className="w-3 h-3" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-foreground">
                                  {agent.label}
                                </span>
                                <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
                                <span className="ml-auto font-mono text-[9.5px] text-foreground/45">
                                  {e.ts}
                                </span>
                              </div>
                              <div className="text-[11px] text-foreground/65 leading-snug">
                                {e.message}
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                  </div>
                  {/* Fade overlay at bottom */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
                </div>
              </div>
            </div>

            {/* Bottom toolbox row */}
            <div className="border-t border-black/[0.06] grid grid-cols-2 sm:grid-cols-4 bg-white/40">
              {[
                { k: "Channels",  v: "Email · Chat · Voice · Slack", icon: MessageSquare },
                { k: "Backends",  v: "Stripe · Salesforce · Zendesk", icon: Database },
                { k: "Policies",  v: "SOC 2 · GDPR · HIPAA-ready",    icon: ShieldCheck },
                { k: "Escalation",v: "Always 1 click to a human",      icon: UserCheck },
              ].map((it, i) => {
                const Icon = it.icon
                return (
                  <div
                    key={it.k}
                    className={`flex items-start gap-2.5 px-4 py-3 ${i !== 0 ? "sm:border-l border-black/[0.06]" : ""}`}
                  >
                    <span className="w-7 h-7 rounded-md bg-[#ECE9FB] text-[#4E3FB6] flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-foreground/50">
                        {it.k}
                      </div>
                      <div className="text-[12px] font-semibold text-foreground truncate">
                        {it.v}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ─── helpers: edges ───────────────────────────────────── */
function nodeCenter(id: AgentId): { x: number; y: number } | null {
  const a = AGENTS.find((x) => x.id === id)
  if (!a) return null
  return { x: a.x + NODE_W / 2, y: a.y + NODE_H / 2 }
}

function edgePath(from: AgentId, to: AgentId): string | null {
  const a = nodeCenter(from)
  const b = nodeCenter(to)
  if (!a || !b) return null
  const mx = (a.x + b.x) / 2
  return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`
}

function staticEdges(): Edge[] {
  return [
    { from: "triage", to: "knowledge" },
    { from: "triage", to: "billing" },
    { from: "triage", to: "voice" },
    { from: "knowledge", to: "policy" },
    { from: "billing",   to: "policy" },
    { from: "voice",     to: "policy" },
    { from: "policy",    to: "composer" },
    { from: "policy",    to: "human" },
    { from: "human",     to: "composer" },
  ]
}

/* ─── responsive canvas wrapper ────────────────────────── */
function ResponsiveCanvasOverlay({ children }: { children: React.ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const handle = () => {
      if (!wrap.current) return
      const w = wrap.current.clientWidth
      const next = Math.min(1, w / (CANVAS_W + 60))
      setScale(next)
    }
    handle()
    window.addEventListener("resize", handle)
    return () => window.removeEventListener("resize", handle)
  }, [])

  return (
    <div ref={wrap} className="absolute inset-0 flex items-center justify-center">
      <div
        className="relative origin-center"
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}

/* ─── canvas node ──────────────────────────────────────── */
function CanvasNode({ agent, state }: { agent: AgentDef; state: AgentState }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const Icon = agent.icon
  const c = TONE[agent.tone]
  const isLive = state === "thinking" || state === "processing"
  const isResolved = state === "resolved"
  const isEscalated = state === "escalated"
  const isWaiting = state === "waiting"

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      style={{ position: "absolute", left: agent.x, top: agent.y, width: NODE_W }}
    >
      <motion.div
        animate={
          isLive
            ? {
                boxShadow: [
                  `0 0 0 0 ${c.flow}40`,
                  `0 0 0 10px ${c.flow}00`,
                  `0 0 0 0 ${c.flow}00`,
                ],
              }
            : { boxShadow: "0 6px 16px -8px rgba(60,50,30,0.18)" }
        }
        transition={isLive ? { duration: 1.5, repeat: Infinity, ease: "easeOut" } : { duration: 0.3 }}
        className="relative rounded-xl border bg-white px-2.5 py-2"
        style={{
          borderColor: isLive || isEscalated || isResolved ? c.border : "rgba(60,50,30,0.12)",
        }}
      >
        {/* IO ports */}
        <span
          className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-[10px] h-[10px] rounded-full bg-white border-2"
          style={{ borderColor: c.flow }}
        />
        <span
          className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-[10px] h-[10px] rounded-full bg-white border-2"
          style={{ borderColor: c.flow }}
        />

        <div className="flex items-center gap-2">
          <span
            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
            style={{ background: c.bg, color: c.fg }}
          >
            <Icon className="w-3.5 h-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-bold leading-tight text-foreground truncate">
              {agent.label}
            </div>
            <div className="text-[9.5px] text-foreground/55 truncate">{agent.role}</div>
          </div>
        </div>

        {/* State chip */}
        <div className="mt-1.5 flex items-center justify-between">
          <StatePill state={state} tone={agent.tone} />
          {isLive && (
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="text-[9px] font-mono text-foreground/45"
            >
              0.{mounted ? (Math.floor(Math.abs(Math.sin((agent.id.length * 7) + 1)) * 9) + 1) : "5"}s
            </motion.span>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function StatePill({ state, tone }: { state: AgentState; tone: Tone }) {
  const c = TONE[tone]
  switch (state) {
    case "thinking":
      return (
        <span
          className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5"
          style={{ background: c.bg, color: c.fg }}
        >
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
          Thinking
        </span>
      )
    case "processing":
      return (
        <span
          className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5"
          style={{ background: c.bg, color: c.fg }}
        >
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
          Processing
        </span>
      )
    case "waiting":
      return (
        <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 bg-[#F4E8D3] text-[#8a5a1e]">
          <Clock className="w-2.5 h-2.5" />
          Waiting
        </span>
      )
    case "escalated":
      return (
        <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 bg-[#F1DFDE] text-[#8a3e3e]">
          <AlertTriangle className="w-2.5 h-2.5" />
          Escalating
        </span>
      )
    case "resolved":
      return (
        <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 bg-[#E3EFE5] text-[#2f5d3f]">
          <CheckCircle2 className="w-2.5 h-2.5" />
          Resolved
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 bg-black/[0.05] text-foreground/55">
          Idle
        </span>
      )
  }
}

/* ─── agent row (left fleet) ───────────────────────────── */
function AgentRow({
  agent,
  state,
  expanded,
  onToggle,
}: {
  agent: AgentDef
  state: AgentState
  expanded: boolean
  onToggle: () => void
}) {
  const Icon = agent.icon
  const c = TONE[agent.tone]
  return (
    <li className="rounded-xl border border-black/[0.06] bg-white overflow-hidden">
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center gap-2.5 px-2.5 py-2 hover:bg-black/[0.02] transition"
      >
        <span
          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
          style={{ background: c.bg, color: c.fg }}
        >
          <Icon className="w-3.5 h-3.5" />
        </span>
        <div className="min-w-0 flex-1 text-left">
          <div className="text-[12px] font-bold text-foreground leading-tight truncate">
            {agent.label}
          </div>
          <div className="text-[10.5px] text-foreground/55 truncate">{agent.role}</div>
        </div>
        <StatePill state={state} tone={agent.tone} />
        <ChevronDown
          className={`w-3.5 h-3.5 text-foreground/40 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-2.5 pb-2.5 pt-1.5 border-t border-black/[0.05] space-y-1">
              <div className="text-[9.5px] font-bold uppercase tracking-wider text-foreground/45">
                Memory
              </div>
              <ul className="space-y-1">
                {agent.memory.map((m) => (
                  <li
                    key={m}
                    className="flex items-start gap-1.5 text-[11px] text-foreground/65"
                  >
                    <span className="mt-1 w-1 h-1 rounded-full bg-[#6B5CD6] shrink-0" />
                    {m}
                  </li>
                ))}
              </ul>
              <div className="pt-1 flex items-center justify-between">
                <a
                  href="#"
                  className="text-[10.5px] font-bold text-[#4E3FB6] inline-flex items-center gap-0.5 hover:underline"
                >
                  Inspect <ArrowUpRight className="w-3 h-3" />
                </a>
                <span className="text-[10px] font-mono text-foreground/40">
                  v1.3 · {agent.id}.advan
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}
