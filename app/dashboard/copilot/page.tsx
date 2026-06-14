"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { useHotkeys } from "react-hotkeys-hook"
import { toast } from "sonner"
import {
  Sparkles, Send, Pencil, X, CheckCircle2, Loader2, Box, BookOpen, AlertTriangle, ThumbsDown,
} from "lucide-react"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"
import { Kbd } from "@/components/ui/kbd"
import { api } from "@/lib/api/trpc-client"
import { useCopilot } from "@/lib/copilot/store"
import { useCopilotStream } from "@/lib/copilot/use-copilot-stream"

const DEFAULT_PROMPT = "Draft a response to a customer who was overcharged on their invoice."

export default function CopilotPage() {
  const [coPilotOn, setCoPilotOn] = useState(true)
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const { start, stop } = useCopilotStream()

  // Narrow slice subscriptions — each consumer re-renders only on its own slice.
  const status = useCopilot((s) => s.status)
  const error = useCopilot((s) => s.error)
  const hitl = useCopilot((s) => s.hitl)

  const decide = api.copilot.decide.useMutation()

  const runStream = () => {
    if (!coPilotOn || !prompt.trim()) return
    start(prompt)
  }

  useEffect(() => {
    runStream()
    return stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Accept = Ctrl/Cmd+Enter. Reject = Ctrl/Cmd+Shift+Backspace.
  useHotkeys("mod+enter", () => handleDecision("accept"), { enableOnFormTags: ["TEXTAREA", "INPUT"] }, [])
  useHotkeys("mod+shift+backspace", () => handleDecision("reject"), { enableOnFormTags: ["TEXTAREA", "INPUT"] }, [])

  async function handleDecision(action: "accept" | "reject" | "modify") {
    const s = useCopilot.getState()
    if (s.status !== "ready" || !s.suggestionId || s.decision === "sending") return

    const optimistic = action === "reject" ? "rejected" : "accepted"
    s.setDecision("sending")
    try {
      await decide.mutateAsync({
        suggestionId: s.suggestionId,
        action,
        finalText: action === "reject" ? undefined : s.edited,
        hitlId: s.hitl.hitlId,
      })
      s.setDecision(optimistic)
      toast.success(action === "reject" ? "Suggestion rejected" : "Reply sent")
    } catch (err) {
      s.setDecision("none") // rollback
      toast.error(err instanceof Error ? err.message : "Decision failed")
    }
  }

  return (
    <div>
      <DashPageHeader
        eyebrow="AI Copilot"
        title="Co-pilot for support agents"
        subtitle="Real-time sourced drafts from your knowledge base. Approve, edit, or escalate — always in control."
        actions={
          <Link
            href="/dashboard/tap-box"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:dash-shadow-sm transition"
          >
            <Box className="w-4 h-4" /> Inspect with Tap Box
          </Link>
        }
      />

      <div className="mb-4 flex gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) runStream()
          }}
          placeholder="Describe the customer issue…"
          aria-label="Customer issue prompt"
          className="flex-1 h-9 px-3 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] text-[var(--dash-ink)] placeholder:text-[var(--dash-ink-faint)] outline-none focus:border-[var(--dash-accent)]"
        />
        <button
          onClick={runStream}
          disabled={status === "streaming"}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] hover:-translate-y-px disabled:opacity-60 transition"
        >
          {status === "streaming" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {status === "streaming" ? "Generating…" : "Generate Draft"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <DashCard
          title="AI Copilot"
          icon={<Sparkles className="w-[18px] h-[18px]" />}
          right={
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[var(--dash-accent-deep)] bg-[var(--dash-accent-wash)] rounded-full px-2.5 py-0.5">
                Co-Pilot Mode
              </span>
              <button
                aria-pressed={coPilotOn}
                aria-label="Toggle Co-Pilot mode"
                onClick={() => { setCoPilotOn((v) => !v); stop() }}
                className={`relative w-[38px] h-[21px] rounded-full transition ${coPilotOn ? "bg-[var(--dash-accent)]" : "bg-[var(--dash-ink-faint)]"}`}
              >
                <span className={`absolute top-[3px] w-[15px] h-[15px] rounded-full bg-white shadow transition-all ${coPilotOn ? "left-[3px]" : "left-[20px]"}`} />
              </button>
            </div>
          }
        >
          <DraftPanel error={error} coPilotOn={coPilotOn} />

          {hitl.required && (
            <div className="mt-2 flex items-center gap-2 p-2.5 rounded-lg bg-[var(--dash-amber-wash)] border border-[#E5D2A8] text-[12px] text-[#5a3e1c]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span><b>Human review required:</b> {hitl.reason}</span>
            </div>
          )}

          <EditPanel onDecision={handleDecision} />
        </DashCard>

        <ReasoningPanel />
      </div>
    </div>
  )
}

function DraftPanel({ error, coPilotOn }: { error: string | null; coPilotOn: boolean }) {
  const draft = useCopilot((s) => s.draft)
  const status = useCopilot((s) => s.status)
  const confidence = useCopilot((s) => s.confidence)
  const streaming = status === "streaming"

  const confColor =
    confidence === null ? "text-[var(--dash-ink-faint)]"
    : confidence >= 85 ? "text-[var(--dash-sage)]"
    : confidence >= 70 ? "text-[var(--dash-amber)]"
    : "text-[var(--dash-rose)]"

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2 text-[12px] font-bold text-[var(--dash-ink)]">
        Suggested Response
        <span className="font-medium text-[var(--dash-ink-faint)] text-[11px]">(AI Draft)</span>
        {confidence !== null && (
          <span className={`ml-auto text-[11px] font-bold dash-bg-sage-wash rounded-md px-2 py-0.5 ${confColor}`}>
            {confidence}% confidence
          </span>
        )}
      </div>

      <div
        className="rounded-xl border dash-border bg-white p-3.5 min-h-[148px]"
        aria-live="polite"
        aria-busy={streaming}
      >
        {error ? (
          <p className="text-[13px] text-[var(--dash-rose)]">{error}</p>
        ) : streaming && !draft ? (
          <TypingDots />
        ) : draft ? (
          <p className="text-[13px] leading-[1.62] text-[var(--dash-ink)] whitespace-pre-line">
            {draft}
            {streaming && (
              <span className="inline-block w-[8px] h-[14px] bg-[var(--dash-accent)] ml-0.5 align-middle animate-pulse" />
            )}
          </p>
        ) : (
          <p className="text-[12.5px] text-[var(--dash-ink-faint)]">
            {coPilotOn ? "Click Generate Draft to start." : "Co-Pilot is paused. Re-enable to generate a sourced reply."}
          </p>
        )}
      </div>
    </div>
  )
}

function EditPanel({ onDecision }: { onDecision: (a: "accept" | "reject" | "modify") => void }) {
  const edited = useCopilot((s) => s.edited)
  const draft = useCopilot((s) => s.draft)
  const setEdited = useCopilot((s) => s.setEdited)
  const decision = useCopilot((s) => s.decision)
  const status = useCopilot((s) => s.status)
  const ready = status === "ready"

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-[12px] font-bold text-[var(--dash-ink)]">
        Edit Response
        <span className="font-medium text-[var(--dash-accent-deep)] text-[11px]">You are editing</span>
      </div>

      <div className="rounded-xl border-2 border-[var(--dash-accent)] bg-white shadow-[0_0_0_3px_var(--dash-accent-wash)] overflow-hidden">
        <textarea
          value={edited}
          onChange={(e) => setEdited(e.target.value)}
          rows={9}
          aria-label="Editable AI response"
          className="w-full px-4 py-3.5 text-[13px] leading-[1.62] text-[var(--dash-ink)] outline-none bg-transparent resize-none"
        />
        <div className="flex items-center gap-3.5 px-3 py-2 border-t dash-border-soft bg-[var(--dash-bg)]">
          <span className="ml-auto text-[11px] font-mono text-[var(--dash-ink-faint)]">{edited.length} chars</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2.5">
        <button
          onClick={() => setEdited(draft)}
          disabled={!ready}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border dash-border bg-transparent text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:bg-[var(--dash-bg)] transition disabled:opacity-50"
        >
          <X className="w-4 h-4" /> Reset
        </button>
        <button
          onClick={() => onDecision("reject")}
          disabled={!ready || decision === "sending"}
          aria-keyshortcuts="Control+Shift+Backspace"
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] font-semibold text-[var(--dash-rose)] hover:dash-shadow-sm transition disabled:opacity-50"
        >
          <ThumbsDown className="w-4 h-4" /> Reject
        </button>
        <button
          onClick={() => onDecision("accept")}
          disabled={!ready || decision === "sending" || !edited.trim()}
          aria-keyshortcuts="Control+Enter"
          className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white transition shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] ${
            decision === "accepted"
              ? "bg-gradient-to-br from-[#5C9A70] to-[#3f7a52]"
              : "bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] hover:-translate-y-px"
          } disabled:opacity-60`}
        >
          {decision === "none" && <><Send className="w-4 h-4" /> Send Reply <Kbd className="ml-0.5">⌘↵</Kbd></>}
          {decision === "sending" && <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>}
          {decision === "accepted" && <><CheckCircle2 className="w-4 h-4" /> Sent</>}
          {decision === "rejected" && <><Pencil className="w-4 h-4" /> Rejected</>}
        </button>
      </div>
    </div>
  )
}

function ReasoningPanel() {
  const confidence = useCopilot((s) => s.confidence)
  const stage = useCopilot((s) => s.confidenceStage)
  const status = useCopilot((s) => s.status)
  const citations = useCopilot((s) => s.citations)
  const hitl = useCopilot((s) => s.hitl)
  const latencyMs = useCopilot((s) => s.latencyMs)

  const confColor =
    confidence === null ? "text-[var(--dash-ink-faint)]"
    : confidence >= 85 ? "text-[var(--dash-sage)]"
    : confidence >= 70 ? "text-[var(--dash-amber)]"
    : "text-[var(--dash-rose)]"

  return (
    <DashCard title="AI reasoning" icon={<Sparkles className="w-[18px] h-[18px]" />}>
      <div className="flex items-center gap-4 mb-3">
        <ConfidenceRing value={confidence ?? 0} provisional={stage === "retrieval"} />
        <div className="text-[12px] leading-[1.6] text-[var(--dash-ink-soft)]">
          {confidence === null ? (
            status === "streaming" ? "Analysing sources…" : "Generate a draft to see reasoning."
          ) : (
            <>
              <div className={`font-bold ${confColor}`}>{confidence}% confidence{stage === "retrieval" ? " (provisional)" : ""}</div>
              {hitl.required ? (
                <span className="text-[var(--dash-amber)]">HITL review required</span>
              ) : (
                <span className="text-[var(--dash-sage)]">Auto-send eligible</span>
              )}
              {latencyMs ? <span className="font-mono"> · {latencyMs}ms</span> : null}
            </>
          )}
        </div>
      </div>

      {citations.length > 0 && (
        <div className="mt-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-soft)] mb-2">
            Sources cited
          </div>
          <ul className="space-y-2">
            {citations.map((c) => (
              <li
                key={c.sourceId}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border dash-border-soft bg-white hover:dash-shadow-sm transition"
              >
                <span className="w-6 h-6 rounded-md dash-bg-blue-wash flex items-center justify-center">
                  <BookOpen className="w-3.5 h-3.5 text-[var(--dash-blue)]" />
                </span>
                <span className="flex-1 text-[12px] font-semibold text-[var(--dash-ink)] truncate">{c.title}</span>
                <span className="text-[10.5px] font-bold text-[var(--dash-sage)] dash-bg-sage-wash rounded-md px-1.5 py-0.5">
                  {c.confidence}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        href="/dashboard/tap-box"
        className="mt-4 inline-flex items-center gap-1 text-[12px] font-bold text-[var(--dash-accent-deep)] hover:underline"
      >
        Open full Tap Box →
      </Link>
    </DashCard>
  )
}

function ConfidenceRing({ value, provisional }: { value: number; provisional: boolean }) {
  const reduce = useReducedMotion()
  const R = 28
  const circ = 2 * Math.PI * R
  const offset = circ - (value / 100) * circ
  const color = value >= 85 ? ["#76B98C", "#4A8A60"] : value >= 70 ? ["#E5A84F", "#B07A2A"] : ["#E58080", "#A04040"]

  return (
    <div
      className="relative w-[66px] h-[66px] shrink-0"
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`AI confidence ${value} percent${provisional ? " provisional" : ""}`}
    >
      <svg width={66} height={66} viewBox="0 0 66 66" className="-rotate-90">
        <defs>
          <linearGradient id="copilot-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={color[0]} />
            <stop offset="1" stopColor={color[1]} />
          </linearGradient>
        </defs>
        <circle cx="33" cy="33" r={R} stroke="var(--dash-line)" strokeWidth="7" fill="none" />
        <motion.circle
          cx="33" cy="33" r={R}
          stroke="url(#copilot-ring)" strokeWidth="7" fill="none" strokeLinecap="round"
          strokeDasharray={circ}
          initial={false}
          animate={{ strokeDashoffset: offset, opacity: provisional ? 0.55 : 1 }}
          transition={reduce ? { duration: 0 } : { duration: 0.9, ease: [0.34, 1.2, 0.64, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[15px] font-extrabold text-[var(--dash-ink)]">
        {value}%
      </div>
    </div>
  )
}

function TypingDots() {
  const reduce = useReducedMotion()
  return (
    <div className="flex items-center gap-1 py-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full bg-[var(--dash-accent)]"
          animate={reduce ? undefined : { y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
        />
      ))}
    </div>
  )
}
