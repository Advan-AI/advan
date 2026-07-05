"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence, useInView } from "framer-motion"
import { CheckCircle2, ShieldCheck } from "lucide-react"

/**
 * Compact auto-playing Trust Engine demo for the hero.
 * Loops a 6-phase pipeline (~11s): retrieve → score → policy → approve → sent.
 * Pauses off-screen and under prefers-reduced-motion.
 */

const PHASE_MS = [900, 1500, 1700, 1300, 1200, 4200]
const THRESHOLD = 85
const TARGET_CONFIDENCE = 94

interface Gate {
  label: string
  /** phase in which this gate is RUNNING */
  runsAt: number
  passedLabel: string
}

const GATES: Gate[] = [
  { label: "Retrieve approved sources", runsAt: 1, passedLabel: "3 SOURCES" },
  { label: "Confidence threshold", runsAt: 2, passedLabel: `${TARGET_CONFIDENCE}%` },
  { label: "Policy validation", runsAt: 3, passedLabel: "PASSED" },
  { label: "Approve & send", runsAt: 4, passedLabel: "SENT" },
]

const CITATION_CHIPS = [
  { label: "¹ Webhooks v2 docs", tone: "violet" },
  { label: "² Ticket #4821", tone: "violet" },
  { label: `${TARGET_CONFIDENCE}% confident`, tone: "sage" },
] as const

export function TrustEngineDemo() {
  const containerRef = useRef<HTMLDivElement>(null)
  const inView = useInView(containerRef, { margin: "-10% 0px" })
  const [phase, setPhase] = useState(0)
  const [confidence, setConfidence] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(mq.matches)
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  // Reduced motion: park on the final phase with full confidence.
  useEffect(() => {
    if (reducedMotion) {
      setPhase(5)
      setConfidence(TARGET_CONFIDENCE)
    }
  }, [reducedMotion])

  // Phase loop — only ticks while on screen.
  useEffect(() => {
    if (reducedMotion || !inView) return
    const id = setTimeout(() => {
      setPhase((p) => {
        const next = (p + 1) % PHASE_MS.length
        if (next === 0) setConfidence(0)
        return next
      })
    }, PHASE_MS[phase])
    return () => clearTimeout(id)
  }, [phase, inView, reducedMotion])

  // Confidence ring animates 0 → 94 during phase 2.
  useEffect(() => {
    if (reducedMotion || phase !== 2) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / 1300, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setConfidence(Math.round(TARGET_CONFIDENCE * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, reducedMotion])

  const sent = phase === 5

  return (
    <div
      ref={containerRef}
      data-testid="trust-demo"
      className="relative rounded-3xl border border-black/[0.08] bg-white/80 backdrop-blur-xl shadow-[0_24px_70px_-32px_rgba(60,50,30,0.30)] overflow-hidden"
    >
      {/* Window chrome */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-black/[0.06] bg-white/50">
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="w-2.5 h-2.5 rounded-full bg-[#E8927C]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#E5C07B]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#98C379]" />
        </div>
        <span className="font-mono text-[11px] text-foreground/50">
          advan / trust-engine / live
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#2f5d3f] bg-[#E3EFE5] rounded-full px-2 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5C9A70] dash-pulse-dot" />
          Live
        </span>
      </div>

      <div className="grid sm:grid-cols-[1.15fr_0.85fr]">
        {/* ── Left: conversation ── */}
        <div className="p-4 sm:p-5 flex flex-col gap-3 min-h-[330px]">
          {/* Customer message */}
          <div className="flex items-start gap-2.5">
            <span className="w-7 h-7 rounded-full bg-[#F4E8D3] flex items-center justify-center text-[10px] font-bold text-[#8a5a1e] shrink-0">
              ML
            </span>
            <div className="rounded-2xl rounded-tl-md bg-black/[0.045] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-foreground/80">
              Our webhooks started timing out after yesterday&apos;s deploy — did
              something change on your side?
              <div className="mt-1 text-[10px] text-foreground/40">Maria L. · just now</div>
            </div>
          </div>

          {/* Thinking bubble */}
          <AnimatePresence>
            {phase >= 1 && phase <= 4 && (
              <motion.div
                key="thinking"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-2 self-start rounded-full border border-[#6B5CD6]/20 bg-[#F0EDFB] px-3 py-1.5 text-[11.5px] font-medium text-[#4E3FB6]"
              >
                <span className="flex gap-1" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-1 h-1 rounded-full bg-[#6B5CD6]"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </span>
                {phase === 1 && "Retrieving approved knowledge…"}
                {phase === 2 && "Scoring confidence against threshold…"}
                {phase === 3 && "Running policy validation…"}
                {phase === 4 && "Preparing approved reply…"}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Draft reply */}
          <AnimatePresence>
            {sent && (
              <motion.div
                key="reply"
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 260, damping: 26 }}
                className="flex items-start gap-2.5"
              >
                <span className="w-7 h-7 rounded-lg bg-[#171a17] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-white" />
                </span>
                <div className="flex-1">
                  <div className="rounded-2xl rounded-tl-md border border-[#6B5CD6]/15 bg-white px-3.5 py-2.5 text-[12.5px] leading-relaxed text-foreground/85 shadow-[0_10px_28px_-18px_rgba(107,92,214,0.4)]">
                    Check <strong>webhook_timeout_ms</strong> in your delivery
                    settings — the v2 deploy resets it to 3000ms. Raising it to
                    10000ms resolves this for 90% of cases<sup>1</sup>. If timeouts
                    persist, verify your endpoint responds within the window
                    <sup>2</sup>.
                  </div>
                  <div data-testid="source-badges" className="mt-2 flex flex-wrap gap-1.5">
                    {CITATION_CHIPS.map((chip, i) => (
                      <motion.span
                        key={chip.label}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.2 + i * 0.15 }}
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-semibold whitespace-nowrap ${
                          chip.tone === "sage"
                            ? "bg-[#E3EFE5] text-[#2f5d3f]"
                            : "bg-[#F0EDFB] text-[#4E3FB6]"
                        }`}
                      >
                        {chip.label}
                      </motion.span>
                    ))}
                  </div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.8 }}
                    className="mt-2 flex items-center gap-1.5 text-[11px] text-foreground/50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#5C9A70]" />
                    Sent · logged to audit trail{" "}
                    <span className="font-mono">#A-2214</span>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Right: trust engine panel ── */}
        <div className="border-t sm:border-t-0 sm:border-l border-black/[0.06] bg-[#FBF9F3]/80 p-4 sm:p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#146457]">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden />
              Trust Engine
            </span>
            <ConfidenceRing value={confidence} />
          </div>

          {/* Gate rows */}
          <ol className="flex flex-col gap-1.5">
            {GATES.map((gate) => {
              const running = phase === gate.runsAt
              const passed = phase > gate.runsAt || sent
              return (
                <li
                  key={gate.label}
                  className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-[11.5px] font-medium transition-all duration-300 ${
                    running
                      ? "bg-[#F0EDFB] text-foreground"
                      : passed
                      ? "text-foreground/80"
                      : "opacity-55 text-foreground/70"
                  }`}
                >
                  <span className="whitespace-nowrap">{gate.label}</span>
                  {passed ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#E3EFE5] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-[#2f5d3f] whitespace-nowrap">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      {gate.passedLabel}
                    </span>
                  ) : running ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-white px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-[#4E3FB6] whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#6B5CD6] animate-pulse" />
                      Running
                    </span>
                  ) : (
                    <span className="rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-foreground/50 whitespace-nowrap">
                      Queued
                    </span>
                  )}
                </li>
              )
            })}
          </ol>

          {/* Threshold card */}
          <div className="mt-auto rounded-xl border border-black/[0.06] bg-white p-3">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/50">
              <span>Confidence threshold</span>
              <span data-testid="confidence-score" className="font-mono text-foreground/80">
                {confidence}% / {THRESHOLD}%
              </span>
            </div>
            <div className="relative mt-2 h-1.5 rounded-full bg-black/[0.06] overflow-visible">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-200"
                style={{
                  width: `${confidence}%`,
                  background: "linear-gradient(90deg, #C5883C, #5C9A70)",
                }}
              />
              <span
                className="absolute -top-[3px] w-[2px] h-3 bg-[#171a17] rounded-full"
                style={{ left: `${THRESHOLD}%` }}
                aria-hidden
              />
            </div>
            <p className="mt-2 text-[10.5px] leading-snug text-foreground/50">
              Below {THRESHOLD}% → routed to a human reviewer before send.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ConfidenceRing({ value }: { value: number }) {
  const CIRCUMFERENCE = 113 // 2πr, r = 18
  const offset = CIRCUMFERENCE * (1 - value / 100)
  const color = value >= THRESHOLD ? "#5C9A70" : "#C5883C"
  return (
    <span className="relative inline-flex items-center justify-center w-11 h-11" role="img" aria-label={`Confidence ${value}%`}>
      <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90">
        <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="3.5" />
        <circle
          cx="22"
          cy="22"
          r="18"
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 150ms linear, stroke 300ms" }}
        />
      </svg>
      <span className="absolute font-mono text-[10px] font-bold text-foreground/80">
        {value}
      </span>
    </span>
  )
}
