"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, X } from "lucide-react"

interface Step {
  id: string
  title: string
  hint: string
}

const STEPS: Step[] = [
  { id: "helpdesk", title: "Connect your helpdesk", hint: "Zendesk synced · 2-way" },
  { id: "kb", title: "Import knowledge base", hint: "1,204 articles embedded" },
  { id: "threshold", title: "Set confidence threshold", hint: "Below it, a human reviews first" },
  { id: "policy", title: "Configure policy gates", hint: "Refunds, PII, legal intents" },
  { id: "team", title: "Invite your team", hint: "Reviewers get approval rights" },
]

const DEFAULT_COMPLETED = ["helpdesk", "kb"]
const STORAGE_KEY = "advan.onboarding.v1"

/**
 * Activation checklist on the dashboard Overview. Persists completion +
 * dismissal per org in localStorage (move to org_settings when wired).
 */
export function OnboardingChecklist({ org = "acme" }: { org?: string }) {
  const storageKey = `${STORAGE_KEY}.${org}`
  const [completed, setCompleted] = useState<string[]>(DEFAULT_COMPLETED)
  const [dismissed, setDismissed] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const saved = JSON.parse(raw) as { completedSteps?: string[]; dismissed?: boolean }
        if (saved.completedSteps) setCompleted(saved.completedSteps)
        if (saved.dismissed) setDismissed(true)
      }
    } catch {
      /* ignore malformed storage */
    }
    setHydrated(true)
  }, [storageKey])

  function persist(next: { completedSteps: string[]; dismissed: boolean }) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      /* ignore quota / private mode */
    }
  }

  function toggleStep(id: string) {
    setCompleted((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
      persist({ completedSteps: next, dismissed })
      return next
    })
  }

  function dismiss() {
    setDismissed(true)
    persist({ completedSteps: completed, dismissed: true })
  }

  // Avoid a flash of the wrong state before localStorage is read.
  if (!hydrated || dismissed) return null

  const done = completed.length
  const pct = Math.round((done / STEPS.length) * 100)

  return (
    <AnimatePresence>
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        aria-label="Onboarding checklist"
        className="mb-5 rounded-2xl border p-5 bg-[var(--dash-raised)] shadow-[0_10px_30px_-18px_rgba(107,92,214,0.5)]"
        style={{ borderColor: "rgba(107,92,214,0.25)" }}
      >
        <div className="flex flex-wrap items-start gap-4 justify-between">
          <div>
            <h2 className="text-[16px] font-bold tracking-tight text-[var(--dash-ink)]">
              Finish setting up your Trust Engine
            </h2>
            <p className="mt-0.5 text-[13px] text-[var(--dash-ink-soft)]">
              {done} of {STEPS.length} steps complete — go live when all gates are configured.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-[150px] h-2 rounded-full bg-black/[0.06] overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, #6B5CD6, #5C9A70)" }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span className="font-mono text-[12px] font-bold text-[var(--dash-accent-deep)] w-9 text-right">
              {pct}%
            </span>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss checklist"
              className="text-[var(--dash-ink-faint)] hover:text-[var(--dash-ink)] transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-px rounded-xl overflow-hidden bg-[#E7DFCD] [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          {STEPS.map((step) => {
            const isDone = completed.includes(step.id)
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => toggleStep(step.id)}
                className="group text-left bg-[var(--dash-card)] hover:bg-[rgba(107,92,214,0.04)] transition p-3.5 flex items-start gap-2.5"
              >
                <span
                  className={`mt-0.5 w-[18px] h-[18px] shrink-0 rounded-full flex items-center justify-center border transition ${
                    isDone
                      ? "bg-[var(--dash-sage)] border-[var(--dash-sage)]"
                      : "border-[var(--dash-line)] group-hover:border-[var(--dash-accent)]"
                  }`}
                >
                  {isDone && <Check className="w-3 h-3 text-white" />}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-[12.5px] font-semibold leading-tight ${
                      isDone
                        ? "line-through text-[var(--dash-ink-faint)]"
                        : "text-[var(--dash-ink)]"
                    }`}
                  >
                    {step.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[var(--dash-ink-soft)] leading-snug">
                    {step.hint}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </motion.section>
    </AnimatePresence>
  )
}
