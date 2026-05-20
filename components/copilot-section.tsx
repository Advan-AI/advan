"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Users,
  Sparkles,
  CheckCircle2,
  ThumbsUp,
  Edit3,
  User,
  Send,
  Pencil,
} from "lucide-react"
import { SectionHeader } from "@/components/section-primitives"

const BENEFITS = [
  { icon: CheckCircle2, label: "Suggested replies in-line, never auto-sent on sensitive intents" },
  { icon: Edit3, label: "Agents edit, approve, or rewrite — every decision feeds the model" },
  { icon: ThumbsUp, label: "Confidence + sources surfaced before send, not after" },
]

/* ─── conversation script ─────────────────────────────── */
type Role = "customer" | "ai" | "agent"
type ConvoStep =
  | { role: Role; text: string; delay: number }
  | { role: "typing"; actor: Role; delay: number }
  | { role: "action"; label: string; type: "approve" | "edit"; delay: number }
  | { role: "status"; text: string; delay: number }

const SCRIPT: ConvoStep[] = [
  { role: "customer", text: "Our webhooks stopped after we rotated API keys. Anything we missed?", delay: 0 },
  { role: "typing", actor: "ai", delay: 900 },
  {
    role: "ai",
    text: "Signature rotation invalidates the old secret. Re-sign middleware with the v2 header and accept both keys for 24h. Want the snippet?",
    delay: 2200,
  },
  { role: "action", label: "Editing response…", type: "edit", delay: 3400 },
  {
    role: "agent",
    text: "Great catch by Advan. Also check that your retry logic is using the new secret — old retries may still be hitting the v1 endpoint.",
    delay: 4600,
  },
  { role: "action", label: "Approved & sent", type: "approve", delay: 5800 },
  { role: "status", text: "Ticket resolved · 12s · CSAT: ★★★★★", delay: 6600 },
]

const TOTAL_DURATION = 8000 // loop every 8s

/* ─── component ──────────────────────────────────────── */
export function CopilotSection() {
  return (
    <section id="copilot" className="relative py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
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
              lede="Advan drafts the answer, surfaces sources and confidence, then hands control to your agent. One click to approve, one keystroke to rewrite."
            />
            <ul className="mt-8 space-y-3">
              {BENEFITS.map((b, i) => (
                <motion.li
                  key={b.label}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.1 + i * 0.07 }}
                  className="flex items-start gap-3 text-sm text-foreground/75"
                >
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center shrink-0">
                    <b.icon className="w-3 h-3 text-cyan-600" />
                  </span>
                  {b.label}
                </motion.li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7 }}
            className="relative"
          >
            <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-cyan-500/10 to-violet-500/10 blur-3xl" aria-hidden />
            <LiveConversation />
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/* ─── animated live conversation ──────────────────────── */
function LiveConversation() {
  const [tick, setTick] = useState(0)
  const startRef = useRef<number>(Date.now())

  // advance tick every 100ms so children re-check their delay gates
  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Date.now() - startRef.current
      if (elapsed >= TOTAL_DURATION) {
        startRef.current = Date.now()
        setTick(0)
      } else {
        setTick(elapsed)
      }
    }, 80)
    return () => clearInterval(id)
  }, [])

  const elapsed = tick

  // which steps are visible
  const visible = SCRIPT.filter((s) => elapsed >= s.delay)

  const hasTyping = visible.some((s) => {
    if (s.role !== "typing") return false
    // typing only shows if next message isn't visible yet
    const idx = SCRIPT.indexOf(s)
    const next = SCRIPT[idx + 1]
    return !next || elapsed < next.delay
  })

  return (
    <div
      data-testid="copilot-live"
      className="rounded-2xl glass-strong overflow-hidden shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)]"
    >
      {/* window chrome */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/[0.06]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-foreground/40">
          <Users className="w-3 h-3" />
          Ticket #4912 · Co-pilot active
        </div>
        <CollaborationAvatars />
      </div>

      {/* messages */}
      <div className="p-4 space-y-3 min-h-[300px]">
        <AnimatePresence initial={false}>
          {visible.map((step, i) => {
            if (step.role === "typing") return null // handled separately

            if (step.role === "action") {
              return (
                <motion.div
                  key={`action-${i}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex justify-center"
                >
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium ${
                      step.type === "approve"
                        ? "bg-emerald-400/10 border border-emerald-400/25 text-emerald-200"
                        : "bg-amber-400/10 border border-amber-400/25 text-amber-200"
                    }`}
                  >
                    {step.type === "approve" ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <Pencil className="w-3 h-3" />
                    )}
                    {step.label}
                  </span>
                </motion.div>
              )
            }

            if (step.role === "status") {
              return (
                <motion.div
                  key={`status-${i}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="flex justify-center"
                >
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400/10 border border-cyan-400/25 px-3 py-1 text-[11px] font-medium text-cyan-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-300" />
                    {step.text}
                  </span>
                </motion.div>
              )
            }

            return (
              <ChatBubble
                key={`msg-${i}`}
                role={step.role}
                text={step.text}
              />
            )
          })}

          {/* typing indicator */}
          {hasTyping && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-2"
            >
              <AiAvatar />
              <TypingDots />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* metrics footer */}
      <div className="border-t border-black/[0.06] px-4 py-3 grid grid-cols-3 gap-2">
        {[
          { label: "Avg resolve", value: "11s" },
          { label: "CSAT", value: "+22pts" },
          { label: "Escalations", value: "−47%" },
        ].map((m) => (
          <div key={m.label} className="text-center">
            <div className="text-[10px] text-foreground/40 uppercase tracking-wider">{m.label}</div>
            <div className="text-sm font-semibold text-foreground">{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChatBubble({ role, text }: { role: Role; text: string }) {
  const isCustomer = role === "customer"
  const isAi = role === "ai"
  const isAgent = role === "agent"

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`flex items-start gap-2.5 ${isCustomer ? "" : "flex-row-reverse"}`}
    >
      {isCustomer && <CustomerAvatar />}
      {isAi && <AiAvatar />}
      {isAgent && <AgentAvatar />}

      <div className="max-w-[75%]">
        <div
          className={`text-xs font-medium mb-1 ${
            isCustomer ? "text-foreground/50" : "text-right text-foreground/50"
          }`}
        >
          {isCustomer ? "Maria · Acme Corp" : isAi ? "Advan AI" : "Jordan (agent)"}
        </div>
        <div
          className={`rounded-2xl px-3 py-2.5 text-xs leading-relaxed ${
            isCustomer
              ? "rounded-tl-md bg-black/[0.04] border border-black/[0.06] text-foreground/85"
              : isAi
              ? "rounded-tr-md bg-gradient-to-br from-cyan-500/[0.1] to-blue-500/[0.06] border border-cyan-500/20 text-foreground/90"
              : "rounded-tr-md bg-gradient-to-br from-violet-500/[0.1] to-blue-500/[0.06] border border-violet-500/20 text-foreground/90"
          }`}
        >
          {text}
          {isAi && (
            <div className="mt-2.5 flex items-center gap-2 border-t border-black/[0.06] pt-2">
              <button
                type="button"
                className="rounded-full bg-foreground text-background px-2.5 py-0.5 text-[10px] font-semibold hover:bg-foreground/90 transition-colors inline-flex items-center gap-1"
              >
                <CheckCircle2 className="w-2.5 h-2.5" />
                Approve
              </button>
              <button
                type="button"
                className="rounded-full glass px-2.5 py-0.5 text-[10px] font-medium text-foreground/70 hover:text-foreground inline-flex items-center gap-1"
              >
                <Pencil className="w-2.5 h-2.5" />
                Edit
              </button>
              <span className="ml-auto text-[10px] font-mono text-cyan-600">94%</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function CustomerAvatar() {
  return (
    <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-amber-400/30 to-orange-500/30 border border-white/10 flex items-center justify-center">
      <User className="w-3.5 h-3.5 text-amber-200" />
    </div>
  )
}

function AiAvatar() {
  return (
    <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-cyan-400/40 to-blue-500/40 border border-cyan-300/20 flex items-center justify-center shadow-[0_0_12px_rgba(34,211,238,0.3)]">
      <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
    </div>
  )
}

function AgentAvatar() {
  return (
    <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-violet-400/30 to-blue-500/30 border border-violet-300/20 flex items-center justify-center">
      <Send className="w-3 h-3 text-violet-200" />
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 rounded-2xl rounded-tl-md bg-gradient-to-br from-cyan-500/[0.08] to-blue-500/[0.04] border border-cyan-300/15 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-cyan-300"
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.18,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  )
}

function CollaborationAvatars() {
  const colors = ["from-cyan-400/40 to-blue-500/40", "from-violet-400/30 to-blue-500/30"]
  const labels = ["AI", "JD"]
  return (
    <div className="flex items-center -space-x-2">
      {colors.map((c, i) => (
        <div
          key={i}
          className={`w-6 h-6 rounded-full bg-gradient-to-br ${c} border border-black/20 flex items-center justify-center text-[9px] font-bold text-foreground ring-2 ring-background`}
        >
          {labels[i]}
        </div>
      ))}
      <span className="ml-3 text-[10px] text-emerald-500 font-mono">● live</span>
    </div>
  )
}
