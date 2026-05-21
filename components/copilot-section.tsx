"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles,
  CheckCircle2,
  Pencil,
  Send,
  User,
  ShieldCheck,
  Brain,
  BookOpen,
  Lightbulb,
  Smile,
  Loader2,
  Users,
  Zap,
  ArrowRight,
  Clock,
  MessageSquare,
  Banknote,
  PhoneCall,
} from "lucide-react"
import { SectionHeader } from "@/components/section-primitives"

/* ─── domain model ──────────────────────────────────── */
type StageId =
  | "incoming"
  | "thinking"
  | "drafted"
  | "agent_edit"
  | "approved"
  | "resolved"

interface Stage {
  id: StageId
  label: string
}

const STAGES: Stage[] = [
  { id: "incoming",   label: "Inbound from customer" },
  { id: "thinking",   label: "AI reasoning" },
  { id: "drafted",    label: "AI drafted" },
  { id: "agent_edit", label: "Agent edit" },
  { id: "approved",   label: "Approved & sent" },
  { id: "resolved",   label: "Resolved" },
]

const STAGE_MS: Record<StageId, number> = {
  incoming:   1600,
  thinking:   2400,
  drafted:    2200,
  agent_edit: 2400,
  approved:   1500,
  resolved:   2000,
}

const AI_DRAFT = `Hi Maria — I checked your account. The signature rotation invalidated the old secret. Re-sign middleware with the v2 header and accept both keys for 24h. Want the snippet?`
const AGENT_EDIT = `Hi Maria — I checked your account. The signature rotation invalidated the old secret. Re-sign middleware with the v2 header and accept both keys for 24h. I'll also tag this thread to your CSM so we can confirm webhook delivery. Want the snippet?`

const SUGGESTIONS = [
  { label: "Refund the add-on", tone: "violet" as const, icon: Banknote },
  { label: "Share docs link",   tone: "blue"   as const, icon: BookOpen },
  { label: "Escalate to CSM",   tone: "amber"  as const, icon: PhoneCall },
]

const NEXT_BEST = [
  "Tag thread to CSM",
  "Schedule 24h follow-up",
  "Add to webhook-rotation runbook",
]

const REASONING_LINES = [
  "Matched intent → Webhook · Signature rotation (97%)",
  "Pulled Docs/Webhooks-v2 + KB/Signature-rotation (3 sources)",
  "Cross-checked customer’s last 4 tickets · no regressions",
  "Confidence 94% · safe to draft, human approval recommended",
]

const TONE_BG: Record<string, string> = {
  violet: "bg-[#ECE9FB] text-[#4E3FB6] border-[#D7CFF2]",
  blue:   "bg-[#E1E9F3] text-[#244e8a] border-[#C7D4E8]",
  amber:  "bg-[#F4E8D3] text-[#8a5a1e] border-[#E5D2A8]",
  sage:   "bg-[#E3EFE5] text-[#2f5d3f] border-[#CBE0CF]",
}

/* ─── component ─────────────────────────────────────── */
export function CopilotSection() {
  const [stageIdx, setStageIdx] = useState(0)
  const [running, setRunning] = useState(true)
  const stage = STAGES[stageIdx]

  // advance stage
  useEffect(() => {
    if (!running) return
    const ms = STAGE_MS[stage.id]
    const t = setTimeout(() => {
      setStageIdx((i) => (i + 1) % STAGES.length)
    }, ms)
    return () => clearTimeout(t)
  }, [stageIdx, running, stage.id])

  return (
    <section id="copilot" className="relative py-14 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1fr_1.45fr] gap-10 lg:gap-14 items-start">
          <CopilotCopy stage={stage} />
          <CopilotWorkspace
            stage={stage}
            stageIdx={stageIdx}
            onJump={(i) => {
              setRunning(false)
              setStageIdx(i)
            }}
            running={running}
            onToggle={() => setRunning((v) => !v)}
          />
        </div>
      </div>
    </section>
  )
}

/* ─── left: copy + KPIs ─────────────────────────────── */
function CopilotCopy({ stage }: { stage: Stage }) {
  const productivity = [
    { k: "First response",  v: "11s",   d: "−84% vs baseline", icon: Clock,        tone: "violet" as const },
    { k: "AI resolution",   v: "72%",   d: "+9pts qoq",        icon: Sparkles,     tone: "sage"   as const },
    { k: "CSAT lift",       v: "+0.22", d: "vs control",       icon: Smile,        tone: "amber"  as const },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6 }}
    >
      <SectionHeader
        align="left"
        eyebrow="Human + AI Copilot"
        title={
          <>
            Your team stays in control —{" "}
            <span className="text-gradient-brand">the AI just makes them faster</span>
          </>
        }
        lede="Advan drafts the answer, surfaces reasoning and confidence, suggests next-best actions, then hands control to your agent. One click to approve, one keystroke to rewrite."
      />

      {/* Stage indicator */}
      <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/70 backdrop-blur px-3 py-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#6B5CD6] animate-pulse" />
        <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-foreground/55">
          Currently
        </span>
        <AnimatePresence mode="wait">
          <motion.span
            key={stage.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="text-[12px] font-bold text-[#4E3FB6]"
          >
            {stage.label}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Productivity tiles */}
      <ul className="mt-8 grid grid-cols-3 gap-3">
        {productivity.map((p) => {
          const Icon = p.icon
          return (
            <li
              key={p.k}
              className="rounded-xl border border-black/[0.06] bg-white/70 backdrop-blur px-3 py-3 lift"
            >
              <span
                className={`inline-flex w-7 h-7 rounded-lg items-center justify-center border ${TONE_BG[p.tone]}`}
              >
                <Icon className="w-3.5 h-3.5" />
              </span>
              <div className="mt-2 text-[18px] font-bold tracking-tight text-foreground leading-none">
                {p.v}
              </div>
              <div className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-foreground/50 mt-1">
                {p.k}
              </div>
              <div className="text-[10.5px] text-foreground/55">{p.d}</div>
            </li>
          )
        })}
      </ul>

      {/* Benefits */}
      <ul className="mt-7 space-y-2.5">
        {[
          { icon: CheckCircle2, text: "Suggested replies in-line — never auto-sent on sensitive intents" },
          { icon: Pencil,       text: "Agents edit, approve, or rewrite — every decision feeds the model" },
          { icon: ShieldCheck,  text: "Confidence + sources surfaced before send, not after" },
        ].map((b) => {
          const Icon = b.icon
          return (
            <li key={b.text} className="flex items-start gap-2.5 text-[13.5px] text-foreground/75 leading-snug">
              <span className="mt-0.5 w-5 h-5 rounded-full bg-[#ECE9FB] border border-[#D7CFF2] flex items-center justify-center shrink-0">
                <Icon className="w-3 h-3 text-[#4E3FB6]" />
              </span>
              {b.text}
            </li>
          )
        })}
      </ul>
    </motion.div>
  )
}

/* ─── right: split-screen workspace ────────────────── */
function CopilotWorkspace({
  stage,
  stageIdx,
  onJump,
  running,
  onToggle,
}: {
  stage: Stage
  stageIdx: number
  onJump: (i: number) => void
  running: boolean
  onToggle: () => void
}) {
  const showCustomer  = true
  const showAi        = stageIdx >= 2 // drafted onwards
  const showAgentEdit = stageIdx >= 3
  const showSent      = stageIdx >= 4
  const showResolved  = stageIdx >= 5

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      {/* Halo */}
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-[#6B5CD6]/14 via-[#8E80E5]/8 to-[#5C9A70]/12 blur-[60px]"
      />

      {/* Console */}
      <div className="relative rounded-3xl border border-black/[0.07] bg-white/65 backdrop-blur-xl shadow-[0_24px_70px_-32px_rgba(60,50,30,0.28)] overflow-hidden">
        {/* Chrome */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-black/[0.06] bg-white/40">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#BE6A6A]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#C5883C]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#5C9A70]" />
          </div>
          <div className="text-[11.5px] font-mono text-foreground/55 flex items-center gap-1.5">
            <MessageSquare className="w-3 h-3" />
            advan / inbox / #TK-84219
          </div>
          <CollaborationCursors />
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-bold text-[#2f5d3f] bg-[#E3EFE5] rounded-full px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5C9A70] animate-pulse" />
            Live
          </span>
        </div>

        {/* Stage track */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-black/[0.06] bg-white/30 overflow-x-auto">
          {STAGES.map((s, i) => {
            const done = i < stageIdx
            const cur = i === stageIdx
            return (
              <button
                key={s.id}
                onClick={() => onJump(i)}
                className={`group inline-flex items-center gap-1 text-[10.5px] font-bold rounded-full px-2.5 py-1 transition ${
                  cur
                    ? "bg-[#ECE9FB] text-[#4E3FB6]"
                    : done
                    ? "bg-[#E3EFE5] text-[#2f5d3f]"
                    : "text-foreground/45 hover:text-foreground/70"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    cur
                      ? "bg-[#6B5CD6] animate-pulse"
                      : done
                      ? "bg-[#5C9A70]"
                      : "bg-foreground/30"
                  }`}
                />
                {s.label}
              </button>
            )
          })}
          <button
            onClick={onToggle}
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-[#4E3FB6] hover:underline shrink-0"
          >
            {running ? "Pause" : "Replay"}
            <Zap className="w-3 h-3" />
          </button>
        </div>

        {/* Body: split */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-px bg-black/[0.05]">
          {/* Conversation */}
          <div className="bg-white/55 p-4 lg:p-5 min-h-[460px] flex flex-col">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-foreground/50 mb-3">
              Conversation
            </div>

            <div className="space-y-4 flex-1">
              {/* Customer */}
              <AnimatePresence>
                {showCustomer && (
                  <ChatBubble
                    side="left"
                    who="Maria Lopez · Acme"
                    role="Customer"
                    tone="rose"
                    text="Our webhooks stopped after we rotated API keys. Did we miss a step?"
                    time="10:24 AM"
                  />
                )}
              </AnimatePresence>

              {/* AI typing or AI drafted */}
              <AnimatePresence>
                {stageIdx === 1 && (
                  <TypingRow tone="violet" who="Advan AI · drafting" />
                )}
                {showAi && (
                  <ChatBubble
                    side="right"
                    who="Advan AI"
                    role="AI Draft"
                    tone="violet"
                    text={showAgentEdit ? AGENT_EDIT : AI_DRAFT}
                    time="10:24 AM"
                    confidence={showAgentEdit ? 96 : 94}
                    edited={showAgentEdit}
                    actionRow={!showSent}
                  />
                )}
              </AnimatePresence>

              {/* Agent edit chip */}
              <AnimatePresence>
                {stageIdx === 3 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex justify-center"
                  >
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F4E8D3] border border-[#E5D2A8] text-[#8a5a1e] px-3 py-1 text-[11px] font-bold">
                      <Pencil className="w-3 h-3" />
                      Jordan is editing the response…
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Approval + Sent */}
              <AnimatePresence>
                {stageIdx === 4 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    className="flex justify-center"
                  >
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E3EFE5] border border-[#CBE0CF] text-[#2f5d3f] px-3 py-1 text-[11px] font-bold">
                      <CheckCircle2 className="w-3 h-3" />
                      Approved by Sarah J. · sent
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Resolved */}
              <AnimatePresence>
                {showResolved && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    className="flex justify-center"
                  >
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECE9FB] border border-[#D7CFF2] text-[#4E3FB6] px-3 py-1 text-[11px] font-bold">
                      <Sparkles className="w-3 h-3" />
                      Resolved · 12s · CSAT 5★
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Composer footer (visible when not resolved) */}
            <div className="mt-3 rounded-xl border border-black/[0.06] bg-white px-3 py-2">
              <div className="text-[11px] text-foreground/45">
                {showResolved
                  ? "Thread closed · context preserved across channels"
                  : "Reply on email · Maria's preferred tone: concise, friendly"}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[10.5px] font-mono text-foreground/40">⌘+Enter to send</span>
                <span className="ml-auto inline-flex items-center gap-1.5 text-[10.5px] text-foreground/55">
                  <Users className="w-3 h-3" />
                  3 viewing
                </span>
              </div>
            </div>
          </div>

          {/* AI Copilot panel */}
          <div className="bg-white/55 p-4 lg:p-5 min-h-[460px] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-foreground/50 inline-flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#6B5CD6]" />
                AI copilot panel
              </div>
              <ConfidenceMeter
                value={stageIdx < 2 ? 0 : showAgentEdit ? 96 : 94}
              />
            </div>

            {/* Reasoning stream */}
            <ReasoningStream active={stageIdx >= 1} stageIdx={stageIdx} />

            {/* Sentiment + intent */}
            <div className="grid grid-cols-2 gap-2.5">
              <SignalCard
                icon={Brain}
                label="Detected intent"
                value="Webhook / Sig rotation"
                tone="violet"
              />
              <SignalCard
                icon={Smile}
                label="Sentiment"
                value="Frustrated · cooling"
                tone="amber"
              />
            </div>

            {/* Suggestions */}
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-foreground/50 mb-1.5 flex items-center gap-1.5">
                <Lightbulb className="w-3 h-3 text-[#C5883C]" />
                Suggested actions
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s, i) => {
                  const Icon = s.icon
                  const active = stageIdx >= 2 && i === 0
                  return (
                    <motion.button
                      key={s.label}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      animate={
                        active
                          ? { boxShadow: ["0 0 0 0 rgba(107,92,214,0.0)", "0 0 0 4px rgba(107,92,214,0.18)", "0 0 0 0 rgba(107,92,214,0)"] }
                          : { boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
                      }
                      transition={active ? { duration: 1.6, repeat: Infinity } : { duration: 0.3 }}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold border ${TONE_BG[s.tone]}`}
                    >
                      <Icon className="w-3 h-3" />
                      {s.label}
                    </motion.button>
                  )
                })}
              </div>
            </div>

            {/* Next-best */}
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-foreground/50 mb-1.5 flex items-center gap-1.5">
                <ArrowRight className="w-3 h-3 text-[#5A85C3]" />
                Next-best actions
              </div>
              <ul className="space-y-1.5">
                {NEXT_BEST.map((n, i) => (
                  <motion.li
                    key={n}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{
                      opacity: stageIdx >= 2 ? 1 : 0.4,
                      x: stageIdx >= 2 ? 0 : 8,
                    }}
                    transition={{ duration: 0.4, delay: i * 0.08 }}
                    className="flex items-center gap-2 text-[12px] text-foreground/70"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5A85C3]" />
                    {n}
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* Action bar */}
            <div className="mt-auto flex items-center gap-2 pt-3 border-t border-black/[0.06]">
              <button
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-black/[0.08] text-[12.5px] font-bold text-foreground/60 hover:bg-black/[0.03] transition"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
              <motion.button
                animate={
                  stageIdx === 3
                    ? {
                        boxShadow: [
                          "0 0 0 0 rgba(107,92,214,0.55)",
                          "0 0 0 10px rgba(107,92,214,0)",
                          "0 0 0 0 rgba(107,92,214,0)",
                        ],
                      }
                    : { boxShadow: "0 8px 22px -10px rgba(107,92,214,0.5)" }
                }
                transition={
                  stageIdx === 3
                    ? { duration: 1.4, repeat: Infinity }
                    : { duration: 0.3 }
                }
                className="ml-auto inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[12.5px] font-bold text-white bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] shadow-[0_8px_22px_-10px_rgba(107,92,214,0.5)] hover:-translate-y-px transition"
              >
                {stageIdx >= 4 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                {stageIdx >= 4 ? "Sent" : "Approve & send"}
              </motion.button>
            </div>
          </div>
        </div>

        {/* Bottom metrics ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-black/[0.06] bg-white/40">
          {[
            { k: "Drafts/hr",      v: "47"   },
            { k: "Auto-approved",  v: "61%"  },
            { k: "Avg edits",      v: "0.8"  },
            { k: "Edge escalates", v: "3.2%" },
          ].map((m, i) => (
            <div
              key={m.k}
              className={`px-4 py-3 ${i !== 0 ? "sm:border-l border-black/[0.06]" : ""} ${
                i >= 2 ? "border-t sm:border-t-0 border-black/[0.06]" : ""
              }`}
            >
              <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-foreground/50">
                {m.k}
              </div>
              <div className="mt-0.5 text-[18px] font-bold tracking-tight text-foreground leading-none">
                {m.v}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

/* ─── chat bubble ───────────────────────────────────── */
function ChatBubble({
  side,
  who,
  role,
  tone,
  text,
  time,
  confidence,
  edited,
  actionRow,
}: {
  side: "left" | "right"
  who: string
  role: string
  tone: "violet" | "blue" | "amber" | "sage" | "rose"
  text: string
  time: string
  confidence?: number
  edited?: boolean
  actionRow?: boolean
}) {
  const flip = side === "right"
  const bubbleStyle =
    tone === "violet"
      ? "bg-[#ECE9FB] text-[#37308a] border-[#D7CFF2]"
      : tone === "rose"
      ? "bg-[#F1DFDE] text-[#5d2727] border-[#E5C5C4]"
      : tone === "amber"
      ? "bg-[#F4E8D3] text-[#5a3e1c] border-[#E5D2A8]"
      : tone === "sage"
      ? "bg-[#E3EFE5] text-[#1f3f29] border-[#CBE0CF]"
      : "bg-[#E1E9F3] text-[#1f3a66] border-[#C7D4E8]"

  const avatarStyle =
    tone === "violet"
      ? "bg-gradient-to-br from-[#8E80E5] to-[#4E3FB6] text-white"
      : tone === "rose"
      ? "bg-[#F1DFDE] text-[#8a3e3e]"
      : "bg-[#E3EFE5] text-[#2f5d3f]"

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`flex items-start gap-2.5 ${flip ? "flex-row-reverse" : ""}`}
    >
      <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${avatarStyle}`}>
        {tone === "violet" ? <Sparkles className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
      </span>
      <div className="max-w-[88%]">
        <div className={`flex items-center gap-2 mb-1 ${flip ? "justify-end" : ""}`}>
          <span className="text-[11.5px] font-bold text-foreground/70">{who}</span>
          <span className="text-[9.5px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 bg-black/[0.04] text-foreground/55">
            {role}
          </span>
          <span className="text-[10.5px] font-mono text-foreground/40">{time}</span>
          {edited && (
            <span className="text-[9.5px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 bg-[#F4E8D3] text-[#8a5a1e]">
              edited
            </span>
          )}
        </div>
        <div className={`rounded-2xl ${flip ? "rounded-tr-md" : "rounded-tl-md"} border ${bubbleStyle} px-3.5 py-2.5 text-[13px] leading-[1.55]`}>
          {text}
          {actionRow && (
            <div className="mt-2.5 pt-2 border-t border-black/[0.08] flex items-center gap-2">
              <button className="inline-flex items-center gap-1 rounded-full bg-[#4E3FB6] text-white px-2.5 py-0.5 text-[10px] font-bold hover:bg-[#37308a] transition">
                <CheckCircle2 className="w-2.5 h-2.5" />
                Approve
              </button>
              <button className="inline-flex items-center gap-1 rounded-full bg-white border border-black/[0.08] text-foreground/70 px-2.5 py-0.5 text-[10px] font-bold hover:bg-black/[0.03] transition">
                <Pencil className="w-2.5 h-2.5" />
                Edit
              </button>
              {confidence !== undefined && (
                <span className="ml-auto font-mono text-[10px] text-[#2f5d3f] font-bold">
                  {confidence}%
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

/* ─── typing dots ───────────────────────────────────── */
function TypingRow({ tone, who }: { tone: "violet" | "blue"; who: string }) {
  const bg = tone === "violet" ? "bg-[#ECE9FB] border-[#D7CFF2]" : "bg-[#E1E9F3] border-[#C7D4E8]"
  const dot = tone === "violet" ? "bg-[#6B5CD6]" : "bg-[#5A85C3]"
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25 }}
      className="flex items-start gap-2.5 flex-row-reverse"
    >
      <span className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-[#8E80E5] to-[#4E3FB6] text-white flex items-center justify-center">
        <Sparkles className="w-3.5 h-3.5" />
      </span>
      <div>
        <div className="flex items-center gap-2 mb-1 justify-end">
          <span className="text-[11.5px] font-bold text-foreground/70">{who}</span>
        </div>
        <div className={`rounded-2xl rounded-tr-md border ${bg} px-3.5 py-3 inline-flex items-center gap-1`}>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${dot}`}
              animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.16 }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

/* ─── reasoning streamed lines ──────────────────────── */
function ReasoningStream({
  active,
  stageIdx,
}: {
  active: boolean
  stageIdx: number
}) {
  // Lines reveal one by one once `active`
  const [shown, setShown] = useState(0)
  const linesRef = useRef(REASONING_LINES)

  useEffect(() => {
    if (!active) {
      setShown(0)
      return
    }
    setShown(0)
    const id = setInterval(() => {
      setShown((s) => Math.min(s + 1, linesRef.current.length))
    }, 360)
    return () => clearInterval(id)
  }, [active, stageIdx])

  return (
    <div className="rounded-xl bg-[#FCFAF4] border border-black/[0.06] p-3">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-foreground/50 mb-2 flex items-center gap-1.5">
        <Brain className="w-3 h-3 text-[#6B5CD6]" />
        AI reasoning
        {active && shown < REASONING_LINES.length && (
          <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] text-[#4E3FB6]">
            <Loader2 className="w-3 h-3 animate-spin" />
            streaming
          </span>
        )}
      </div>
      <ul className="space-y-1.5 font-mono text-[11px] leading-snug text-foreground/70">
        {REASONING_LINES.slice(0, shown).map((line) => (
          <motion.li
            key={line}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-start gap-1.5"
          >
            <span className="text-[#6B5CD6] shrink-0">›</span>
            <span>{line}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}

/* ─── confidence meter ─────────────────────────────── */
function ConfidenceMeter({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-foreground/50">
        Confidence
      </span>
      <div className="relative w-20 h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
        <motion.span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, #6B5CD6 0%, #5C9A70 100%)",
          }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <motion.span
        key={value}
        initial={{ opacity: 0, y: -2 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-mono text-[11px] font-bold text-[#2f5d3f] tabular-nums min-w-[28px] text-right"
      >
        {value}%
      </motion.span>
    </div>
  )
}

/* ─── signal card ──────────────────────────────────── */
function SignalCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType
  label: string
  value: string
  tone: "violet" | "blue" | "amber" | "sage"
}) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-white p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className={`w-5 h-5 rounded-md flex items-center justify-center ${TONE_BG[tone]}`}
        >
          <Icon className="w-3 h-3" />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-foreground/50">
          {label}
        </span>
      </div>
      <div className="text-[12.5px] font-bold text-foreground leading-tight truncate">
        {value}
      </div>
    </div>
  )
}

/* ─── collaboration cursors (avatars) ─────────────── */
function CollaborationCursors() {
  const people = [
    { label: "AI", gradient: "from-[#8E80E5] to-[#4E3FB6]" },
    { label: "SJ", gradient: "from-[#5C9A70] to-[#3f7a52]" },
    { label: "JK", gradient: "from-[#C5883C] to-[#8a5a1e]" },
  ]
  return (
    <div className="hidden sm:flex items-center -space-x-1.5">
      {people.map((p, i) => (
        <motion.span
          key={p.label}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 + i * 0.06 }}
          className={`relative w-5 h-5 rounded-full ring-2 ring-white text-[9px] font-bold text-white flex items-center justify-center bg-gradient-to-br ${p.gradient}`}
        >
          {p.label}
        </motion.span>
      ))}
    </div>
  )
}
