"use client"

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowRight,
  ChevronDown,
  ShieldCheck,
  BookOpen,
  Activity,
  Sparkles,
  Inbox,
  Brain,
  Send,
  CheckCircle2,
  Zap,
  Star,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { TapBoxSimulator } from "@/components/tap-box-simulator"

const BOOKING_URL = "https://cal.com/day-nguyen"

export function HeroSection() {
  return (
    <section
      id="hero"
      className="relative isolate overflow-hidden pt-20 pb-14 lg:pt-24 lg:pb-20"
      aria-label="Hero"
    >
      <HeroBackdrop />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center">
          <HeroCopy />
          <HeroPanel />
        </div>
      </div>
    </section>
  )
}

/* ─── animated neural-network backdrop ────────────────── */
function HeroBackdrop() {
  // Stable random positions per mount (no hydration mismatch — useMemo runs client-only because parent is "use client")
  const nodes = useMemo(
    () =>
      Array.from({ length: 22 }).map((_, i) => ({
        id: i,
        // Deterministic via seeded-ish pseudo-random (use index trick)
        x: (Math.sin(i * 1.7) * 0.5 + 0.5) * 100,
        y: (Math.cos(i * 1.13 + 0.4) * 0.5 + 0.5) * 100,
        delay: (i % 7) * 0.4,
      })),
    []
  )

  // Build a few connections between closest neighbours
  const links = useMemo(() => {
    const pairs: Array<{ a: number; b: number }> = []
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i]
      const sorted = nodes
        .map((n) => ({
          n,
          d: Math.hypot(a.x - n.x, a.y - n.y),
        }))
        .sort((x, y) => x.d - y.d)
        .slice(1, 3)
      sorted.forEach(({ n }) => {
        if (n.id > a.id) pairs.push({ a: a.id, b: n.id })
      })
    }
    return pairs.slice(0, 26)
  }, [nodes])

  return (
    <>
      <div
        className="absolute inset-0 -z-20"
        style={{ background: "hsl(40 32% 86%)" }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(1200px 700px at 80% -10%, rgba(107,92,214,0.12), transparent 60%), radial-gradient(900px 600px at -5% 110%, rgba(92,154,112,0.10), transparent 55%), radial-gradient(700px 400px at 50% 50%, rgba(197,136,60,0.06), transparent 70%)",
          }}
        />
      </div>

      {/* Animated neural lattice */}
      <svg
        aria-hidden
        className="absolute inset-0 -z-10 w-full h-full pointer-events-none"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
        style={{
          maskImage:
            "radial-gradient(ellipse at center, black 35%, transparent 78%)",
        }}
      >
        <defs>
          <linearGradient id="hero-link" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(107,92,214,0.0)" />
            <stop offset="50%" stopColor="rgba(107,92,214,0.55)" />
            <stop offset="100%" stopColor="rgba(92,154,112,0.0)" />
          </linearGradient>
        </defs>

        {links.map((l, i) => {
          const a = nodes.find((n) => n.id === l.a)!
          const b = nodes.find((n) => n.id === l.b)!
          return (
            <motion.line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="url(#hero-link)"
              strokeWidth={0.15}
              vectorEffect="non-scaling-stroke"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.0, 0.5, 0.0] }}
              transition={{
                duration: 4 + (i % 5) * 0.7,
                repeat: Infinity,
                delay: (i % 9) * 0.5,
                ease: "easeInOut",
              }}
            />
          )
        })}

        {nodes.map((n) => (
          <motion.circle
            key={n.id}
            cx={n.x}
            cy={n.y}
            r={0.28}
            fill="#6B5CD6"
            initial={{ opacity: 0.3 }}
            animate={{ opacity: [0.2, 0.9, 0.2] }}
            transition={{
              duration: 3.4,
              repeat: Infinity,
              delay: n.delay,
              ease: "easeInOut",
            }}
          />
        ))}
      </svg>

      {/* Subtle grid mask */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 grid-bg [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
      />
    </>
  )
}

/* ─── left: copy ─────────────────────────────────────── */
function HeroCopy() {
  return (
    <div className="relative">
      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        className="text-[44px] sm:text-5xl lg:text-[58px] xl:text-[64px] font-bold tracking-[-0.02em] leading-[1.04] text-foreground"
      >
        Transparent AI Support
        <br />
        for{" "}
        <span className="text-gradient-brand">Better Customer Experiences</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15 }}
        className="mt-6 text-lg lg:text-xl text-foreground/65 max-w-xl leading-[1.55]"
      >
        Resolve tickets in seconds — not minutes. Every answer is sourced,
        scored, and explainable, so customers trust the AI and your team keeps
        full context across every channel.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.25 }}
        className="mt-9 flex flex-col sm:flex-row gap-3"
      >
        <Button
          size="lg"
          asChild
          className="group relative rounded-full bg-[#6B5CD6] hover:bg-[#4E3FB6] text-white h-12 px-7 text-[15px] font-semibold shadow-[0_12px_32px_-10px_rgba(107,92,214,0.55)] hover:-translate-y-px hover:shadow-[0_18px_42px_-12px_rgba(107,92,214,0.6)] transition-all"
        >
          <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
            Book a demo
            <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </a>
        </Button>
        <Button
          size="lg"
          variant="outline"
          asChild
          className="rounded-full h-12 px-7 text-[15px] font-semibold border-black/12 bg-white/60 hover:bg-white text-foreground hover:text-foreground backdrop-blur transition-all"
        >
          <a href="#workflow">
            See how it works
            <ChevronDown className="ml-2 w-4 h-4" />
          </a>
        </Button>
      </motion.div>

      <motion.ul
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.35 }}
        className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-foreground/65"
      >
        <li className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#5C9A70]" />
          SOC 2 + GDPR ready
        </li>
        <li className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#6B5CD6]" />
          Source-cited answers
        </li>
        <li className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#6B5CD6]" />
          Live confidence scoring
        </li>
      </motion.ul>
    </div>
  )
}

/* ─── right: command-center panel ────────────────────── */
function HeroPanel() {
  return (
    <div className="relative">
      {/* Halo glow */}
      <div
        aria-hidden
        className="absolute -inset-10 -z-10 rounded-[3rem] bg-gradient-to-br from-[#6B5CD6]/18 via-[#8E80E5]/8 to-[#5C9A70]/14 blur-[60px]"
      />

      {/* Top live ticker */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="absolute -top-3 left-2 sm:left-4 z-20"
      >
        <LiveTicker />
      </motion.div>

      {/* Floating insight cards */}
      <motion.div
        initial={{ opacity: 0, y: 14, x: 14 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        transition={{ duration: 0.7, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="hidden md:block absolute -right-3 sm:-right-8 top-12 z-20"
      >
        <ConfidenceMini />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14, x: -14 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        transition={{ duration: 0.7, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
        className="hidden md:block absolute -left-3 sm:-left-6 bottom-8 z-20"
      >
        <AgentsMini />
      </motion.div>

      {/* Main simulator */}
      <TapBoxSimulator />

      {/* Bottom activity stream */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 1.3 }}
        className="mt-5 hidden sm:block"
      >
        <ActivityStream />
      </motion.div>
    </div>
  )
}

/* ─── live ticker (resolved counter) ───────────────── */
function LiveTicker() {
  const [count, setCount] = useState(1284)
  useEffect(() => {
    const id = setInterval(() => setCount((c) => c + 1), 4200)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/85 backdrop-blur px-3 py-1.5 shadow-[0_6px_18px_-10px_rgba(60,50,30,0.25)]">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5C9A70] opacity-70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#5C9A70]" />
      </span>
      <span className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-foreground/55">
        Live tickets resolved
      </span>
      <motion.span
        key={count}
        initial={{ y: -6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="font-mono text-[12px] font-bold text-[#4E3FB6]"
      >
        {count.toLocaleString()}
      </motion.span>
    </div>
  )
}

/* ─── floating confidence card ───────────────────────── */
function ConfidenceMini() {
  return (
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      className="rounded-2xl bg-white/85 backdrop-blur-xl border border-black/[0.08] px-3.5 py-3 shadow-[0_14px_36px_-18px_rgba(60,50,30,0.28)] flex items-center gap-3"
    >
      <Ring value={98} />
      <div>
        <div className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-foreground/55">
          Confidence
        </div>
        <div className="text-[18px] font-bold tracking-tight text-foreground leading-tight">
          98<span className="text-foreground/45 text-[12px]">%</span>
        </div>
        <div className="text-[10px] text-[#2f5d3f] font-bold">High match</div>
      </div>
    </motion.div>
  )
}

function Ring({ value }: { value: number }) {
  const R = 18
  const C = 2 * Math.PI * R
  const off = C - (value / 100) * C
  return (
    <div className="relative w-12 h-12">
      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
        <defs>
          <linearGradient id="hero-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#76B98C" />
            <stop offset="100%" stopColor="#4A8A60" />
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r={R} stroke="rgba(60,50,30,0.10)" strokeWidth="4" fill="none" />
        <motion.circle
          cx="24"
          cy="24"
          r={R}
          stroke="url(#hero-ring)"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: off }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: "drop-shadow(0 0 4px rgba(92,154,112,0.5))" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <CheckCircle2 className="w-3.5 h-3.5 text-[#5C9A70]" />
      </div>
    </div>
  )
}

/* ─── floating agents card ───────────────────────────── */
function AgentsMini() {
  const agents = [
    { label: "Triage",    color: "#6B5CD6" },
    { label: "Knowledge", color: "#5A85C3" },
    { label: "Policy",    color: "#BE6A6A" },
  ]
  return (
    <motion.div
      animate={{ y: [0, 6, 0] }}
      transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
      className="rounded-2xl bg-white/85 backdrop-blur-xl border border-black/[0.08] px-3.5 py-3 shadow-[0_14px_36px_-18px_rgba(60,50,30,0.28)] min-w-[180px]"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-foreground/55">
          Agents
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#2f5d3f] bg-[#E3EFE5] rounded-md px-1.5 py-0.5">
          <span className="w-1 h-1 rounded-full bg-[#5C9A70] animate-pulse" />
          3 live
        </span>
      </div>
      <ul className="space-y-1.5">
        {agents.map((a) => (
          <li key={a.label} className="flex items-center gap-2 text-[11px]">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: a.color }}
            />
            <span className="text-foreground/75 font-semibold">{a.label}</span>
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="ml-auto font-mono text-[9.5px] text-foreground/45"
            >
              0.{(Math.floor(Math.random() * 9) + 1).toString()}s
            </motion.span>
          </li>
        ))}
      </ul>
    </motion.div>
  )
}

/* ─── activity stream ────────────────────────────────── */
const STREAM_TEMPLATE: Array<{ icon: typeof Inbox; tone: string; text: string }> = [
  { icon: Inbox,        tone: "#244e8a", text: "New email · webhook timeout" },
  { icon: Brain,        tone: "#4E3FB6", text: "Intent: Billing · 98%" },
  { icon: BookOpen,     tone: "#5A85C3", text: "Retrieved 3 sources" },
  { icon: ShieldCheck,  tone: "#8a3e3e", text: "Policy gate → human approval" },
  { icon: Send,         tone: "#4E3FB6", text: "Sarah J. approved · sent" },
  { icon: CheckCircle2, tone: "#2f5d3f", text: "Resolved · 11s · CSAT 5★" },
]

function ActivityStream() {
  const [head, setHead] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setHead((h) => (h + 1) % STREAM_TEMPLATE.length), 1600)
    return () => clearInterval(id)
  }, [])
  // Display 3 visible: head, head-1, head-2
  const visible = [0, 1, 2].map((i) => STREAM_TEMPLATE[(head - i + STREAM_TEMPLATE.length) % STREAM_TEMPLATE.length])

  return (
    <div className="rounded-2xl border border-black/[0.07] bg-white/65 backdrop-blur px-3 py-2.5 shadow-[0_6px_18px_-10px_rgba(60,50,30,0.18)]">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-foreground/55 inline-flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-[#6B5CD6]" />
          Live activity
        </span>
        <span className="text-[10px] font-mono text-foreground/40">streaming</span>
      </div>
      <div className="relative h-[60px] overflow-hidden">
        <AnimatePresence initial={false}>
          {visible.map((row, i) => {
            const Icon = row.icon
            const opacity = 1 - i * 0.32
            return (
              <motion.div
                key={`${head}-${i}`}
                initial={{ opacity: 0, y: -10, scale: 0.97 }}
                animate={{ opacity, y: i * 20, scale: 1 - i * 0.02 }}
                exit={{ opacity: 0, y: 60 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-x-0 top-0 flex items-center gap-2"
              >
                <span
                  className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: `${row.tone}1a`, color: row.tone }}
                >
                  <Icon className="w-3 h-3" />
                </span>
                <span className="text-[12px] text-foreground/75 truncate">
                  {row.text}
                </span>
                <span className="ml-auto font-mono text-[10px] text-foreground/40 shrink-0">
                  {(i === 0 ? "now" : `${i}s ago`)}
                </span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
