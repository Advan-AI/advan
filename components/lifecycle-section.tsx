"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Palette, FlaskConical, Rocket, BarChart3,
  Check, User, Building2, Briefcase, TrendingUp,
  Zap, Target, Shield, Activity, RefreshCw
} from "lucide-react"

const phases = [
  {
    id: "design",
    title: "Design",
    icon: Palette,
    description: "We build your custom AI Growth Engine from scratch. We define your ideal customer profile, map your total addressable market, curate a verified prospect database of 10,000+ contacts, and craft hyper-personalized messaging sequences tailored to your value proposition.",
  },
  {
    id: "test",
    title: "Test",
    icon: FlaskConical,
    description: "Before going full throttle, we validate everything. We warm up dedicated sending domains, A/B test subject lines and copy variants, verify deliverability across providers, and ensure every message lands in the primary inbox every time.",
  },
  {
    id: "scale",
    title: "Scale",
    icon: Rocket,
    description: "Once validated, we scale your outbound systematically. Our AI agents handle thousands of personalized touchpoints daily — follow-ups, objection handling, and meeting scheduling — while maintaining the quality of a hand-crafted message.",
  },
  {
    id: "optimize",
    title: "Optimize",
    icon: BarChart3,
    description: "Continuous improvement through real-time performance data. We analyze reply rates, meeting conversion, ICP fit scores, and pipeline velocity to constantly refine targeting, messaging, and timing for compounding results.",
  }
]

const icpCriteria = [
  { label: "SaaS - B2B", Icon: Building2, color: "#E85D04" },
  { label: "VP Sales / CRO", Icon: Briefcase, color: "#6366f1" },
  { label: "50-500 employees", Icon: User, color: "#10b981" },
  { label: "$5M-$50M ARR", Icon: TrendingUp, color: "#f59e0b" },
]

const avatarColors = ["#E85D04", "#6366f1", "#10b981", "#f59e0b", "#ec4899", "#3b82f6", "#8b5cf6", "#14b8a6", "#f43f5e", "#84cc16", "#06b6d4", "#a855f7"]
const avatarInitials = ["AM", "JL", "KC", "SR", "TD", "MB", "PW", "HG", "RL", "EN", "CK", "DV"]

function DesignVisual() {
  const [checked, setChecked] = useState<number[]>([])
  const [score, setScore] = useState(0)
  const [count, setCount] = useState(0)
  const [visibleAvatars, setVisibleAvatars] = useState(0)

  useEffect(() => {
    setChecked([])
    setScore(0)
    setCount(0)
    setVisibleAvatars(0)

    const timers: ReturnType<typeof setTimeout>[] = []
    icpCriteria.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setChecked(prev => [...prev, i])
        setScore(prev => Math.min(prev + 23, 94))
      }, 400 + i * 500))
    })

    let n = 0
    const counter = setInterval(() => {
      n += 143
      if (n >= 10_000) { setCount(10_000); clearInterval(counter) }
      else setCount(n)
    }, 25)

    let av = 0
    const avatarTimer = setInterval(() => {
      av++
      setVisibleAvatars(av)
      if (av >= avatarInitials.length) clearInterval(avatarTimer)
    }, 180)

    return () => { timers.forEach(clearTimeout); clearInterval(counter); clearInterval(avatarTimer) }
  }, [])

  const circumference = 2 * Math.PI * 16

  return (
    <div className="w-full max-w-sm mx-auto space-y-2.5">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white/95 rounded-2xl p-4 shadow-lg border border-black/5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-bold text-[#1a1a1a] uppercase tracking-wider">ICP Builder</p>
            <p className="text-xs text-[#999] mt-0.5">AI-matched criteria</p>
          </div>
          <div className="relative w-14 h-14">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="16" fill="none" stroke="#F8F7F4" strokeWidth="3" />
              <motion.circle
                cx="20" cy="20" r="16" fill="none" stroke="#E85D04" strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: circumference * (1 - score / 100) }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-[#E85D04]">{score}%</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {icpCriteria.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + i * 0.15 }}
              className="flex items-center gap-1.5 bg-[#F8F7F4] rounded-lg px-2.5 py-1.5 relative overflow-hidden"
            >
              <c.Icon className="w-3 h-3 shrink-0" style={{ color: c.color }} />
              <span className="text-xs font-medium text-[#1a1a1a] truncate">{c.label}</span>
              <AnimatePresence>
                {checked.includes(i) && (
                  <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="ml-auto shrink-0 w-3.5 h-3.5 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="w-2 h-2 text-white" strokeWidth={3} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        className="bg-white/95 rounded-2xl p-4 shadow-lg border border-black/5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-[#E85D04]" />
            <span className="text-xs font-bold text-[#1a1a1a]">Prospects sourced</span>
          </div>
          <motion.span className="text-sm font-bold text-[#E85D04] tabular-nums">
            {count.toLocaleString()}+
          </motion.span>
        </div>
        <div className="flex flex-wrap gap-1">
          {avatarInitials.map((init, i) => (
            <AnimatePresence key={i}>
              {i < visibleAvatars && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                  style={{ backgroundColor: avatarColors[i] }}
                >
                  {init}
                </motion.div>
              )}
            </AnimatePresence>
          ))}
          {visibleAvatars >= avatarInitials.length && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="w-7 h-7 rounded-full bg-[#F8F7F4] border-2 border-dashed border-[#E85D04]/40 flex items-center justify-center text-[9px] text-[#E85D04] font-bold">
              ...
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

const abVariants = [
  {
    label: "A", subject: "Quick question about {{company}}",
    open: 28, reply: 4, color: "#6366f1"
  },
  {
    label: "B", subject: "{{firstName}}, saw your recent Series B",
    open: 61, reply: 14, color: "#E85D04", winner: true
  },
]

function TestVisual() {
  const [progress, setProgress] = useState(abVariants.map(() => ({ open: 0, reply: 0 })))

  useEffect(() => {
    setProgress(abVariants.map(() => ({ open: 0, reply: 0 })))
    const t = setTimeout(() => {
      const iv = setInterval(() => {
        setProgress(prev => {
          const next = prev.map((p, i) => ({
            open: Math.min(p.open + 1.8, abVariants[i].open),
            reply: Math.min(p.reply + 0.4, abVariants[i].reply),
          }))
          if (next.every((p, i) => p.open >= abVariants[i].open)) clearInterval(iv)
          return next
        })
      }, 25)
      return () => clearInterval(iv)
    }, 300)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="w-full max-w-sm mx-auto space-y-2.5">
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white/95 rounded-xl px-3 py-2 shadow border border-black/5 flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-semibold text-green-600">Inbox verified</span>
        </div>
        <div className="h-3 w-px bg-gray-200 mx-1" />
        <Shield className="w-3 h-3 text-[#666]" />
        <span className="text-xs text-[#666]">Domain warmed</span>
      </motion.div>

      {abVariants.map((v, i) => (
        <motion.div key={i}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 + i * 0.15 }}
          className={`bg-white/95 rounded-2xl p-4 shadow-lg border ${
            v.winner ? "border-[#E85D04]/40 ring-1 ring-[#E85D04]/20" : "border-black/5"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                style={{ backgroundColor: v.color }}>
                {v.label}
              </div>
              <span className="text-xs font-semibold text-[#1a1a1a] truncate max-w-[160px]">{v.subject}</span>
            </div>
            {v.winner && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#E85D04]/10 text-[#E85D04]">Winner</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {["Open", "Reply"].map((metric, mi) => {
              const val = mi === 0 ? progress[i].open : progress[i].reply
              const target = mi === 0 ? v.open : v.reply
              return (
                <div key={metric} className="bg-[#F8F7F4] rounded-lg p-2">
                  <p className="text-[10px] text-[#999] mb-0.5">{metric} Rate</p>
                  <p className="text-sm font-bold tabular-nums" style={{ color: v.color }}>
                    {val.toFixed(0)}%
                  </p>
                  <div className="h-1 bg-white rounded-full mt-1 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      animate={{ width: `${(val / target) * 100}%` }}
                      style={{ backgroundColor: v.color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

const weekData = [
  { week: "W1", meetings: 3 },
  { week: "W2", meetings: 7 },
  { week: "W3", meetings: 12 },
  { week: "W4", meetings: 19 },
  { week: "W5", meetings: 27 },
  { week: "W6", meetings: 38 },
  { week: "W7", meetings: 47 },
]

const liveActivities = [
  { text: "Meeting booked - Alex Chen - Acme Corp" },
  { text: "Reply received - Sarah K. - NovaSaaS" },
  { text: "Follow-up sent - 142 contacts" },
  { text: "ICP match found - TechFlow Inc." },
]

function ScaleVisual() {
  const [bars, setBars] = useState(weekData.map(() => 0))
  const [activityIdx, setActivityIdx] = useState(0)
  const [counter, setCounter] = useState(0)

  useEffect(() => {
    setBars(weekData.map(() => 0))
    setCounter(0)

    const t = setTimeout(() => {
      weekData.forEach((d, i) => {
        setTimeout(() => setBars(prev => { const n = [...prev]; n[i] = d.meetings; return n }), i * 110)
      })
    }, 200)

    let c = 0
    const countIv = setInterval(() => {
      c += 31
      if (c >= 2400) { setCounter(2400); clearInterval(countIv) }
      else setCounter(c)
    }, 20)

    const actIv = setInterval(() => {
      setActivityIdx(i => (i + 1) % liveActivities.length)
    }, 2500)

    return () => { clearTimeout(t); clearInterval(countIv); clearInterval(actIv) }
  }, [])

  const max = Math.max(...weekData.map(d => d.meetings))

  return (
    <div className="w-full max-w-sm mx-auto space-y-2.5">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white/95 rounded-2xl p-4 shadow-lg border border-black/5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-bold text-[#1a1a1a]">Qualified Meetings / Week</p>
            <p className="text-xs text-[#999]">7-week ramp</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-green-500 justify-end">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">+457%</span>
            </div>
            <p className="text-[10px] text-[#999]">vs baseline</p>
          </div>
        </div>

        <div className="flex items-end gap-1.5 h-24 mb-1">
          {bars.map((h, i) => {
            const pct = (h / max) * 100
            const isLast = i === bars.length - 1
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <AnimatePresence>
                  {h > 0 && isLast && (
                    <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
                      className="text-[9px] font-bold text-[#E85D04]">
                      {h}
                    </motion.div>
                  )}
                </AnimatePresence>
                <motion.div
                  className="w-full rounded-t-lg relative overflow-hidden"
                  style={{
                    height: `${pct}%`,
                    minHeight: h > 0 ? "4px" : "0",
                    background: isLast
                      ? "linear-gradient(to top, #E85D04, #F48C06)"
                      : `rgba(232, 93, 4, ${0.15 + (i / weekData.length) * 0.4})`,
                  }}
                  transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
                >
                  {isLast && (
                    <motion.div
                      className="absolute inset-0 bg-white/20"
                      animate={{ opacity: [0, 0.5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}
                </motion.div>
              </div>
            )
          })}
        </div>
        <div className="flex justify-between">
          {weekData.map((d, i) => (
            <span key={i} className="text-[9px] text-[#bbb] flex-1 text-center">{d.week}</span>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-2">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="bg-white/95 rounded-xl p-3 shadow border border-black/5">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="w-3.5 h-3.5 text-[#E85D04]" />
            <span className="text-[10px] text-[#999] font-medium">Daily sends</span>
          </div>
          <p className="text-lg font-bold text-[#1a1a1a]">{counter.toLocaleString()}<span className="text-sm">+</span></p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}
          className="bg-white/95 rounded-xl p-3 shadow border border-black/5 overflow-hidden">
          <div className="flex items-center gap-1 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] text-[#999] font-medium">Live</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.p key={activityIdx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="text-[10px] text-[#1a1a1a] leading-tight font-medium line-clamp-2">
              {liveActivities[activityIdx].text}
            </motion.p>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}

const optimizeMetrics = [
  { label: "Reply Rate", before: 12, after: 38, unit: "%", color: "#E85D04", max: 60 },
  { label: "Meeting Conv.", before: 28, after: 64, unit: "%", color: "#6366f1", max: 80 },
  { label: "ICP Fit Score", before: 61, after: 91, unit: "/100", color: "#10b981", max: 100 },
  { label: "Pipeline Vel.", before: 1.0, after: 2.4, unit: "x", color: "#f59e0b", max: 3 },
]

const aiInsights = [
  "Switching to Tuesday sends - +12% open rate",
  "Shortening email from 180-90 words - +8% reply",
  "Adding case study link - +21% meeting conversion",
]

function OptimizeVisual() {
  const [showAfter, setShowAfter] = useState(false)
  const [values, setValues] = useState(optimizeMetrics.map(m => m.before))
  const [insightIdx, setInsightIdx] = useState(0)

  useEffect(() => {
    setShowAfter(false)
    setValues(optimizeMetrics.map(m => m.before))

    const t1 = setTimeout(() => {
      setShowAfter(true)
      optimizeMetrics.forEach((m, i) => {
        setTimeout(() => {
          setValues(prev => { const n = [...prev]; n[i] = m.after; return n })
        }, i * 180)
      })
    }, 700)

    const insightIv = setInterval(() => setInsightIdx(i => (i + 1) % aiInsights.length), 3000)

    return () => { clearTimeout(t1); clearInterval(insightIv) }
  }, [])

  return (
    <div className="w-full max-w-sm mx-auto space-y-2.5">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white/95 rounded-2xl p-4 shadow-lg border border-black/5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-[#1a1a1a]">Performance Dashboard</p>
          <button
            onClick={() => {
              const next = !showAfter
              setShowAfter(next)
              setValues(optimizeMetrics.map(m => next ? m.after : m.before))
            }}
            className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full transition-all duration-200"
            style={{
              backgroundColor: showAfter ? "#E85D04" : "#F8F7F4",
              color: showAfter ? "white" : "#666",
            }}
          >
            <RefreshCw className="w-2.5 h-2.5" />
            {showAfter ? "After AI" : "Before AI"}
          </button>
        </div>

        <div className="space-y-2.5">
          {optimizeMetrics.map((m, i) => {
            const pct = Math.min((values[i] / m.max) * 100, 100)
            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#666]">{m.label}</span>
                  <div className="flex items-center gap-1.5">
                    {showAfter && (
                      <motion.span initial={{ opacity: 0, x: 4 }} animate={{ opacity: 1, x: 0 }}
                        className="text-[10px] font-bold text-green-500">
                        +{((values[i] - m.before) / m.before * 100).toFixed(0)}%
                      </motion.span>
                    )}
                    <motion.span
                      key={`${i}-${values[i]}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs font-bold tabular-nums"
                      style={{ color: m.color }}
                    >
                      {values[i].toFixed(m.unit === "x" ? 1 : 0)}{m.unit}
                    </motion.span>
                  </div>
                </div>
                <div className="h-2 bg-[#F8F7F4] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    style={{ backgroundColor: m.color }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
        className="bg-white/95 rounded-xl px-3.5 py-2.5 shadow border border-black/5 flex items-center gap-2.5">
        <div className="shrink-0 w-6 h-6 rounded-full bg-[#E85D04]/10 flex items-center justify-center">
          <Activity className="w-3 h-3 text-[#E85D04]" />
        </div>
        <div className="overflow-hidden flex-1 min-w-0">
          <p className="text-[10px] text-[#999] font-medium mb-0.5">AI insight</p>
          <AnimatePresence mode="wait">
            <motion.p
              key={insightIdx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="text-[10px] text-[#1a1a1a] font-semibold truncate"
            >
              {aiInsights[insightIdx]}
            </motion.p>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

function PhaseVisual({ id }: { id: string }) {
  if (id === "design") return <DesignVisual />
  if (id === "test") return <TestVisual />
  if (id === "scale") return <ScaleVisual />
  if (id === "optimize") return <OptimizeVisual />
  return null
}

export function LifecycleSection() {
  const [activePhase, setActivePhase] = useState("design")
  const activeData = phases.find(p => p.id === activePhase)!

  useEffect(() => {
    const interval = setInterval(() => {
      setActivePhase(curr => {
        const idx = phases.findIndex(p => p.id === curr)
        return phases[(idx + 1) % phases.length].id
      })
    }, 6000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section id="lifecycle" className="pt-2 lg:pt-4 pb-8 lg:pb-12 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-10">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-sm font-semibold text-[#E85D04] uppercase tracking-wider mb-4"
          >
            AI Growth Engine Lifecycle
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-2xl md:text-3xl lg:text-4xl font-light text-[#1a1a1a] leading-snug mb-4 font-serif"
          >
            How we build your <span className="italic">revenue engine</span>
          </motion.h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left: phases */}
          <div className="space-y-3">
            {phases.map((phase) => {
              const Icon = phase.icon
              const isActive = phase.id === activePhase
              return (
                <motion.button
                  key={phase.id}
                  onClick={() => setActivePhase(phase.id)}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className={`w-full text-left p-5 rounded-2xl border transition-all duration-300 ${
                    isActive
                      ? "bg-[#1a1a1a] border-[#1a1a1a] text-white"
                      : "bg-[#F8F7F4] border-transparent hover:border-[#ece9e4] text-[#1a1a1a]"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isActive ? "bg-[#E85D04]" : "bg-white"
                    }`}>
                      <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-[#E85D04]"}`} />
                    </div>
                    <div className="flex-1">
                      <p className={`font-semibold ${isActive ? "text-white" : "text-[#1a1a1a]"}`}>{phase.title}</p>
                      {isActive && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="text-sm text-white/70 mt-1 leading-relaxed"
                        >
                          {phase.description}
                        </motion.p>
                      )}
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>

          {/* Right: animated visual */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activePhase}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.4 }}
              className="relative bg-gradient-to-br from-[#1a1a1a] to-[#111] rounded-3xl p-6 lg:p-8 min-h-[320px] flex items-center justify-center overflow-hidden"
            >
              <div className="absolute inset-0 opacity-5"
                style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "30px 30px" }}
              />
              <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-[#E85D04]/5 blur-3xl" />

              <div className="w-full relative z-10">
                <PhaseVisual id={activeData.id} />
              </div>

              <div className="absolute top-5 right-5 flex gap-1.5">
                {phases.map((phase) => (
                  <button
                    key={phase.id}
                    onClick={() => setActivePhase(phase.id)}
                    className="transition-all duration-300"
                  >
                    <div className={`rounded-full transition-all duration-300 ${
                      phase.id === activePhase
                        ? "w-5 h-2.5 bg-[#E85D04]"
                        : "w-2.5 h-2.5 bg-white/25 hover:bg-white/50"
                    }`} />
                  </button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 max-w-4xl mx-auto text-center"
        >
          <p className="text-xl lg:text-2xl text-[#666] leading-relaxed font-serif">
            We help teams generate predictable pipeline with{" "}
            <span className="italic text-[#1a1a1a]">AI outbound, reactivation, and conversion</span>{" "}
            to maximize revenue.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
