"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles,
  Send,
  Pencil,
  X,
  Bold,
  Italic,
  List,
  Link as LinkIcon,
  Undo2,
  Redo2,
  CheckCircle2,
  Loader2,
  Box,
} from "lucide-react"
import Link from "next/link"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"

const DRAFT_FULL = `Hi Jenna,

I'm sorry to hear about the overcharge. I've reviewed your invoice and found an extra add-on charge for premium reports that was applied incorrectly.

I've issued a refund for $49.00, and you'll see it back on your statement within 3–5 business days.

Let me know if you need anything else — happy to help.`

type SendState = "idle" | "sending" | "sent"

export default function CopilotPage() {
  const [coPilotOn, setCoPilotOn] = useState(true)
  const [typedDraft, setTypedDraft] = useState("")
  const [editing, setEditing] = useState(DRAFT_FULL)
  const [sendState, setSendState] = useState<SendState>("idle")

  // Type out the suggested draft character by character
  useEffect(() => {
    setTypedDraft("")
    if (!coPilotOn) return
    let i = 0
    const id = setInterval(() => {
      i += 2
      setTypedDraft(DRAFT_FULL.slice(0, i))
      if (i >= DRAFT_FULL.length) clearInterval(id)
    }, 12)
    return () => clearInterval(id)
  }, [coPilotOn])

  function handleSend() {
    if (sendState !== "idle") return
    setSendState("sending")
    setTimeout(() => setSendState("sent"), 900)
    setTimeout(() => setSendState("idle"), 3000)
  }

  return (
    <div>
      <DashPageHeader
        eyebrow="AI Copilot"
        title="Co-pilot for support agents"
        subtitle="Watch the AI draft a sourced, on-policy reply in real time. Approve, edit, or cancel — your team stays in control."
        actions={
          <Link
            href="/dashboard/tap-box"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:dash-shadow-sm transition"
          >
            <Box className="w-4 h-4" /> Inspect with Tap Box
          </Link>
        }
      />

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
                onClick={() => setCoPilotOn((v) => !v)}
                className={`relative w-[38px] h-[21px] rounded-full transition ${
                  coPilotOn ? "bg-[var(--dash-accent)]" : "bg-[var(--dash-ink-faint)]"
                }`}
              >
                <span
                  className={`absolute top-[3px] w-[15px] h-[15px] rounded-full bg-white shadow transition-all ${
                    coPilotOn ? "left-[3px]" : "left-[20px]"
                  }`}
                />
              </button>
            </div>
          }
        >
          {/* Suggested Response */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2 text-[12px] font-bold text-[var(--dash-ink)]">
              Suggested Response
              <span className="font-medium text-[var(--dash-ink-faint)] text-[11px]">(AI Draft)</span>
              <span className="ml-auto text-[11px] font-bold text-[var(--dash-sage)] dash-bg-sage-wash rounded-md px-2 py-0.5">
                92% confidence
              </span>
            </div>

            <div className="rounded-xl border dash-border bg-white p-3.5 min-h-[148px]">
              {coPilotOn ? (
                typedDraft ? (
                  <p className="text-[13px] leading-[1.62] text-[var(--dash-ink)] whitespace-pre-line">
                    {typedDraft}
                    {typedDraft.length < DRAFT_FULL.length && (
                      <span className="inline-block w-[8px] h-[14px] bg-[var(--dash-accent)] ml-0.5 align-middle animate-pulse" />
                    )}
                  </p>
                ) : (
                  <TypingDots />
                )
              ) : (
                <p className="text-[12.5px] text-[var(--dash-ink-faint)]">
                  Co-Pilot is paused. Re-enable it to let Advan draft a sourced reply.
                </p>
              )}
            </div>
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
                <span className="ml-auto text-[11px] font-mono text-[var(--dash-ink-faint)]">
                  {editing.length} chars
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setEditing(DRAFT_FULL)}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border dash-border bg-transparent text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:bg-[var(--dash-bg)] transition"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
              <button
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:dash-shadow-sm transition"
              >
                <Pencil className="w-4 h-4" /> Edit Response
              </button>
              <button
                onClick={handleSend}
                disabled={sendState !== "idle"}
                className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white transition shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] ${
                  sendState === "sent"
                    ? "bg-gradient-to-br from-[#5C9A70] to-[#3f7a52]"
                    : "bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] hover:-translate-y-px"
                }`}
              >
                {sendState === "idle" && <><Send className="w-4 h-4" /> Send Reply</>}
                {sendState === "sending" && <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>}
                {sendState === "sent" && <><CheckCircle2 className="w-4 h-4" /> Sent</>}
              </button>
            </div>
          </div>
        </DashCard>

        {/* Side: reasoning + sources teaser */}
        <DashCard
          title="AI reasoning"
          icon={<Sparkles className="w-[18px] h-[18px]" />}
        >
          <div className="rounded-lg bg-[var(--dash-bg)] p-3.5 text-[12px] leading-[1.6] text-[var(--dash-ink-soft)] font-mono">
            Matched intent to <b className="text-[var(--dash-accent-deep)] font-semibold">Overcharge — Billing</b> (98%).
            Retrieved 3 relevant sources. Cross-checked policy and past tickets. Refund eligibility <b className="text-[var(--dash-accent-deep)] font-semibold">confirmed</b>.
          </div>

          <div className="mt-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--dash-ink-soft)] mb-2">
              Sources cited
            </div>
            <ul className="space-y-2">
              {[
                { name: "Docs / Billing Overcharges", score: "98%" },
                { name: "KB / Refunds Process Guide", score: "95%" },
                { name: "Help Center / Add-on Charges", score: "90%" },
              ].map((s) => (
                <li
                  key={s.name}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border dash-border-soft bg-white hover:dash-shadow-sm transition"
                >
                  <span className="w-6 h-6 rounded-md dash-bg-blue-wash flex items-center justify-center text-[10px] font-bold text-[var(--dash-blue)]">
                    DC
                  </span>
                  <span className="flex-1 text-[12px] font-semibold text-[var(--dash-ink)] truncate">
                    {s.name}
                  </span>
                  <span className="text-[10.5px] font-bold text-[var(--dash-sage)] dash-bg-sage-wash rounded-md px-1.5 py-0.5">
                    {s.score}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <Link
            href="/dashboard/tap-box"
            className="mt-4 inline-flex items-center gap-1 text-[12px] font-bold text-[var(--dash-accent-deep)] hover:underline"
          >
            Open full Tap Box transparency panel →
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
