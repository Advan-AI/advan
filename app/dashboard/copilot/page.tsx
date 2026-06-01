"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import {
  Sparkles, Send, Pencil, X, Bold, Italic, List,
  Link as LinkIcon, Undo2, Redo2, CheckCircle2, Loader2, Box, BookOpen, AlertTriangle,
} from "lucide-react"
import Link from "next/link"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"

type SendState = "idle" | "sending" | "sent"

interface Citation {
  sourceId: string
  title: string
  url?: string
  snippet: string
  confidence: number
}

interface DonePayload {
  confidence: number
  hitlRequired: boolean
  hitlReason?: string
  hallucinationResult?: { isHallucination: boolean; score: number; flags: string[] }
  latencyMs?: number
}

const DEFAULT_PROMPT = "Draft a response to a customer who was overcharged on their invoice."

export default function CopilotPage() {
  const [coPilotOn, setCoPilotOn] = useState(true)
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [streamedText, setStreamedText] = useState("")
  const [editing, setEditing] = useState("")
  const [citations, setCitations] = useState<Citation[]>([])
  const [done, setDone] = useState<DonePayload | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [sendState, setSendState] = useState<SendState>("idle")
  const [error, setError] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)

  const startStream = useCallback(() => {
    if (!coPilotOn || !prompt.trim()) return

    // Reset state
    setStreamedText("")
    setCitations([])
    setDone(null)
    setError(null)
    setStreaming(true)
    esRef.current?.close()

    const url = `/api/sse?input=${encodeURIComponent(prompt)}`
    const es = new EventSource(url)
    esRef.current = es

    es.addEventListener("token", (e) => {
      const data = JSON.parse(e.data)
      setStreamedText((prev) => prev + (data.text ?? ""))
    })

    es.addEventListener("citation", (e) => {
      const data: Citation = JSON.parse(e.data)
      setCitations((prev) => [...prev, data])
    })

    es.addEventListener("done", (e) => {
      const data: DonePayload = JSON.parse(e.data)
      setDone(data)
      setEditing(streamedText || "Response generated — check sources panel.")
      setStreaming(false)
      es.close()
    })

    es.addEventListener("error", (e: any) => {
      const msg = e.data ? JSON.parse(e.data)?.message : "Stream error"
      setError(msg)
      setStreaming(false)
      es.close()
    })

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) setStreaming(false)
    }
  }, [coPilotOn, prompt, streamedText])

  // Auto-start on mount
  useEffect(() => {
    startStream()
    return () => esRef.current?.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSend() {
    if (sendState !== "idle") return
    setSendState("sending")
    setTimeout(() => setSendState("sent"), 900)
    setTimeout(() => setSendState("idle"), 3000)
  }

  const confidence = done?.confidence ?? null
  const confColor =
    confidence === null ? "text-[var(--dash-ink-faint)]"
    : confidence >= 85 ? "text-[var(--dash-sage)]"
    : confidence >= 70 ? "text-[var(--dash-amber)]"
    : "text-[var(--dash-rose)]"

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

      {/* Prompt bar */}
      <div className="mb-4 flex gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && startStream()}
          placeholder="Describe the customer issue…"
          className="flex-1 h-9 px-3 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] text-[var(--dash-ink)] placeholder:text-[var(--dash-ink-faint)] outline-none focus:border-[var(--dash-accent)]"
        />
        <button
          onClick={startStream}
          disabled={streaming}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] hover:-translate-y-px disabled:opacity-60 transition"
        >
          {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {streaming ? "Generating…" : "Generate Draft"}
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
                onClick={() => { setCoPilotOn((v) => !v); esRef.current?.close() }}
                className={`relative w-[38px] h-[21px] rounded-full transition ${coPilotOn ? "bg-[var(--dash-accent)]" : "bg-[var(--dash-ink-faint)]"}`}
              >
                <span className={`absolute top-[3px] w-[15px] h-[15px] rounded-full bg-white shadow transition-all ${coPilotOn ? "left-[3px]" : "left-[20px]"}`} />
              </button>
            </div>
          }
        >
          {/* AI Draft */}
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

            <div className="rounded-xl border dash-border bg-white p-3.5 min-h-[148px]">
              {error ? (
                <p className="text-[13px] text-[var(--dash-rose)]">{error}</p>
              ) : streaming && !streamedText ? (
                <TypingDots />
              ) : streamedText ? (
                <p className="text-[13px] leading-[1.62] text-[var(--dash-ink)] whitespace-pre-line">
                  {streamedText}
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

            {done?.hitlRequired && (
              <div className="mt-2 flex items-center gap-2 p-2.5 rounded-lg bg-[var(--dash-amber-wash)] border border-[#E5D2A8] text-[12px] text-[#5a3e1c]">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span><b>Human review required:</b> {done.hitlReason}</span>
              </div>
            )}
          </div>

          {/* Editable response */}
          <div>
            <div className="flex items-center gap-2 mb-2 text-[12px] font-bold text-[var(--dash-ink)]">
              Edit Response
              <span className="font-medium text-[var(--dash-accent-deep)] text-[11px]">You are editing</span>
            </div>

            <div className="rounded-xl border-2 border-[var(--dash-accent)] bg-white shadow-[0_0_0_3px_var(--dash-accent-wash)] overflow-hidden">
              <textarea
                value={editing}
                onChange={(e) => setEditing(e.target.value)}
                rows={9}
                className="w-full px-4 py-3.5 text-[13px] leading-[1.62] text-[var(--dash-ink)] outline-none bg-transparent resize-none"
              />
              <div className="flex items-center gap-3.5 px-3 py-2 border-t dash-border-soft bg-[var(--dash-bg)]">
                <Tool icon={<Bold className="w-[15px] h-[15px]" />} />
                <Tool icon={<Italic className="w-[15px] h-[15px]" />} />
                <span className="w-px h-3.5 dash-bg-deep" />
                <Tool icon={<List className="w-[15px] h-[15px]" />} />
                <Tool icon={<LinkIcon className="w-[15px] h-[15px]" />} />
                <span className="w-px h-3.5 dash-bg-deep" />
                <Tool icon={<Undo2 className="w-[15px] h-[15px]" />} />
                <Tool icon={<Redo2 className="w-[15px] h-[15px]" />} />
                <span className="ml-auto text-[11px] font-mono text-[var(--dash-ink-faint)]">{editing.length} chars</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setEditing(streamedText)}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border dash-border bg-transparent text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:bg-[var(--dash-bg)] transition"
              >
                <X className="w-4 h-4" /> Reset
              </button>
              <button
                onClick={() => setEditing(streamedText)}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:dash-shadow-sm transition"
              >
                <Pencil className="w-4 h-4" /> Use Draft
              </button>
              <button
                onClick={handleSend}
                disabled={sendState !== "idle" || !editing.trim()}
                className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white transition shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] ${
                  sendState === "sent"
                    ? "bg-gradient-to-br from-[#5C9A70] to-[#3f7a52]"
                    : "bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] hover:-translate-y-px"
                } disabled:opacity-60`}
              >
                {sendState === "idle" && <><Send className="w-4 h-4" /> Send Reply</>}
                {sendState === "sending" && <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>}
                {sendState === "sent" && <><CheckCircle2 className="w-4 h-4" /> Sent</>}
              </button>
            </div>
          </div>
        </DashCard>

        {/* Side: citations + meta */}
        <DashCard title="AI reasoning" icon={<Sparkles className="w-[18px] h-[18px]" />}>
          {done ? (
            <div className="rounded-lg bg-[var(--dash-bg)] p-3.5 text-[12px] leading-[1.6] text-[var(--dash-ink-soft)] font-mono">
              Confidence: <b className={confColor}>{done.confidence}%</b> ·{" "}
              {done.hitlRequired ? (
                <span className="text-[var(--dash-amber)]">HITL required</span>
              ) : (
                <span className="text-[var(--dash-sage)]">Auto-send eligible</span>
              )}
              {done.latencyMs && <> · {done.latencyMs}ms</>}
            </div>
          ) : (
            <div className="rounded-lg bg-[var(--dash-bg)] p-3.5 text-[12px] leading-[1.6] text-[var(--dash-ink-soft)] font-mono">
              {streaming ? "Analysing sources…" : "Generate a draft to see reasoning."}
            </div>
          )}

          {citations.length > 0 && (
            <div className="mt-4">
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
                    <span className="flex-1 text-[12px] font-semibold text-[var(--dash-ink)] truncate">
                      {c.title}
                    </span>
                    <span className="text-[10.5px] font-bold text-[var(--dash-sage)] dash-bg-sage-wash rounded-md px-1.5 py-0.5">
                      {c.confidence}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {done?.hallucinationResult && !done.hallucinationResult.isHallucination && (
            <div className="mt-3 flex items-center gap-1.5 text-[11.5px] text-[var(--dash-sage)] font-semibold">
              <CheckCircle2 className="w-4 h-4" /> Hallucination check passed
            </div>
          )}

          {done?.hallucinationResult?.isHallucination && (
            <div className="mt-3 flex items-start gap-1.5 text-[11.5px] text-[var(--dash-rose)] font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Possible hallucination — review before sending</span>
            </div>
          )}

          <Link
            href="/dashboard/tap-box"
            className="mt-4 inline-flex items-center gap-1 text-[12px] font-bold text-[var(--dash-accent-deep)] hover:underline"
          >
            Open full Tap Box →
          </Link>
        </DashCard>
      </div>
    </div>
  )
}

function Tool({ icon }: { icon: React.ReactNode }) {
  return (
    <button className="text-[var(--dash-ink-soft)] hover:text-[var(--dash-accent)] transition">
      {icon}
    </button>
  )
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full bg-[var(--dash-accent)]"
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
        />
      ))}
    </div>
  )
}
