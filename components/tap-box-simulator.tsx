"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  AlertTriangle,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  DatabaseZap,
  History,
  MessageSquare,
  Pause,
  Play,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
  Workflow,
} from "lucide-react"

type StepTone = "blue" | "violet" | "green" | "amber" | "rose"

const THRESHOLD = 85

interface WorkflowStep {
  id: string
  title: string
  subtitle: string
  confidence: number
  tone: StepTone
  engine: string
  status: string
}

interface SourceRef {
  label: string
  detail: string
  freshness: string
}

interface Scenario {
  id: string
  label: string
  question: string
  channel: string
  customer: string
  draft: string
  sources: SourceRef[]
  verifiedConfidence: number
  outcome: "resolved" | "escalated"
  steps: WorkflowStep[]
}

const SCENARIOS: Scenario[] = [
  {
    id: "webhook",
    label: "Webhook timeouts",
    customer: "Maria L.",
    channel: "Email",
    question:
      "Our production webhooks started timing out after a deploy. What setting should we check first?",
    draft:
      "Your endpoint is using the default 30 second timeout. Increase the endpoint timeout to 60 seconds for the batch payload, keep three retries enabled, and rotate the v2 signature header in the same deploy.",
    verifiedConfidence: 98,
    outcome: "resolved",
    sources: [
      { label: "Docs / Webhooks v2", detail: "Timeout defaults and retry limits", freshness: "Current" },
      { label: "KB / Signature rotation", detail: "Customer-safe migration steps", freshness: "Reviewed" },
      { label: "Ticket #4821", detail: "Prior Acme escalation with resolution", freshness: "Verified" },
    ],
    steps: [
      { id: "capture", title: "Question captured", subtitle: "Email, chat, voice, or Slack lands in one governed queue.", confidence: 24, tone: "blue", engine: "Classifying intent", status: "Inbound captured" },
      { id: "retrieve", title: "Approved knowledge retrieved", subtitle: "Only versioned docs, KB articles, and resolved tickets are eligible.", confidence: 63, tone: "violet", engine: "Approved sources matched", status: "3 citations found" },
      { id: "draft", title: "Sourced response drafted", subtitle: "The answer is composed with citations and customer context.", confidence: 88, tone: "green", engine: "Source-cited draft", status: "Draft ready" },
      { id: "verify", title: "Tap Box verifies sources & confidence", subtitle: "Inspect retrievals, reasoning, and confidence before send.", confidence: 93, tone: "green", engine: "Tap Box verified", status: "Source-cited" },
      { id: "policy", title: "Trust Engine validates policy", subtitle: "Privacy, escalation, refund, and compliance rules run before delivery.", confidence: 96, tone: "green", engine: "Policy passed", status: "Audit trail written" },
      { id: "resolve", title: "Resolved & memory synced", subtitle: "The response is sent, outcome logged, and context follows every channel.", confidence: 98, tone: "green", engine: "Resolved with trace", status: "CRM + Slack synced" },
    ],
  },
  {
    id: "refund",
    label: "Refund past policy",
    customer: "Devin R.",
    channel: "Chat",
    question:
      "I was charged twice and I want a full refund — it has been 45 days since the order.",
    draft:
      "This order is past the standard 30-day refund window, but I can see a duplicate charge on the account. I've prepared a one-time exception refund and flagged it for agent approval before anything is sent.",
    verifiedConfidence: 58,
    outcome: "escalated",
    sources: [
      { label: "Policy / Refunds v3", detail: "30-day window and exception rules", freshness: "Current" },
      { label: "Runbook / Double charge", detail: "Duplicate-charge remediation steps", freshness: "Reviewed" },
    ],
    steps: [
      { id: "capture", title: "Question captured", subtitle: "A billing request lands in the governed support queue.", confidence: 21, tone: "blue", engine: "Classifying intent: refund", status: "Inbound captured" },
      { id: "retrieve", title: "Approved knowledge retrieved", subtitle: "Refund policy v3 and the double-charge runbook are pulled.", confidence: 57, tone: "violet", engine: "Refund policy retrieved", status: "Policy matched" },
      { id: "draft", title: "Sourced response drafted", subtitle: "The order is outside the 30-day window, so an exception is required.", confidence: 62, tone: "amber", engine: "Exception detected", status: "Draft prepared" },
      { id: "verify", title: "Tap Box flags low confidence", subtitle: "Model confidence is below the 85% bar for an automated refund.", confidence: 58, tone: "amber", engine: "Confidence under 85%", status: "Below threshold" },
      { id: "escalate", title: "Routed to a human reviewer", subtitle: "Advan opens a review task with sources and a recommended action.", confidence: 58, tone: "amber", engine: "Human gate required", status: "Escalated safely" },
      { id: "resolve", title: "Resolved with human approval", subtitle: "An agent approves the exception; the decision and trace are logged.", confidence: 95, tone: "green", engine: "Human approved + logged", status: "Agent approved" },
    ],
  },
  {
    id: "privacy",
    label: "Data & training",
    customer: "Priya N.",
    channel: "Email",
    question: "Does Advan use our customer conversations to train your models?",
    draft:
      "No — your conversations are never used to train shared models. Data is tenant-isolated under your DPA, encrypted in transit and at rest, and excluded from any cross-customer training. EU data residency is available on request.",
    verifiedConfidence: 99,
    outcome: "resolved",
    sources: [
      { label: "DPA / Data handling", detail: "Processing terms and retention", freshness: "Current" },
      { label: "Security whitepaper", detail: "Encryption and isolation controls", freshness: "Reviewed" },
      { label: "Policy / Model training", detail: "No cross-tenant training guarantee", freshness: "Verified" },
    ],
    steps: [
      { id: "capture", title: "Question captured", subtitle: "A security question is routed into the governed queue.", confidence: 27, tone: "blue", engine: "Classifying intent: security", status: "Inbound captured" },
      { id: "retrieve", title: "Approved knowledge retrieved", subtitle: "The data processing addendum and security docs are pulled.", confidence: 71, tone: "violet", engine: "Approved sources matched", status: "DPA + security docs" },
      { id: "draft", title: "Sourced response drafted", subtitle: "A precise, policy-backed answer is composed.", confidence: 90, tone: "green", engine: "Source-cited draft", status: "Draft ready" },
      { id: "verify", title: "Tap Box verifies sources & confidence", subtitle: "Every claim maps to an approved source.", confidence: 95, tone: "green", engine: "Tap Box verified", status: "Source-cited" },
      { id: "policy", title: "Trust Engine validates policy", subtitle: "Privacy and disclosure rules run before delivery.", confidence: 97, tone: "green", engine: "Policy passed", status: "Audit trail written" },
      { id: "resolve", title: "Resolved & memory synced", subtitle: "The answer is sent and logged with its full reasoning trace.", confidence: 99, tone: "green", engine: "Resolved with trace", status: "Logged + synced" },
    ],
  },
]

const TRUST_CHECKS = [
  { label: "Approved knowledge retrieval", value: "passed", icon: DatabaseZap },
  { label: "Hallucination prevention", value: "grounded", icon: ShieldCheck },
  { label: "Policy validation", value: "passed", icon: ClipboardCheck },
  { label: "Human approval gate", value: "conditional", icon: UserCheck },
  { label: "Audit trail generation", value: "recording", icon: History },
]

const CHANNEL_MEMORY = ["Email", "Chat", "Voice", "Slack"]

const toneClasses: Record<StepTone, { chip: string; icon: string; soft: string; border: string }> = {
  blue: { chip: "bg-[#e6eff7] text-[#214e7b]", icon: "bg-[#e6eff7] text-[#214e7b]", soft: "bg-[#f2f7fb]", border: "border-[#b8cfe3]" },
  violet: { chip: "bg-[#ece9fb] text-[#4e3fb6]", icon: "bg-[#ece9fb] text-[#4e3fb6]", soft: "bg-[#f6f4ff]", border: "border-[#c9c0ef]" },
  green: { chip: "bg-[#e5f3ed] text-[#166b5f]", icon: "bg-[#e5f3ed] text-[#166b5f]", soft: "bg-[#f1faf6]", border: "border-[#b8dece]" },
  amber: { chip: "bg-[#fbefd8] text-[#85561d]", icon: "bg-[#fbefd8] text-[#85561d]", soft: "bg-[#fff8ec]", border: "border-[#e7c988]" },
  rose: { chip: "bg-[#f6e3e1] text-[#853b38]", icon: "bg-[#f6e3e1] text-[#853b38]", soft: "bg-[#fff4f3]", border: "border-[#e7bdb9]" },
}

export function TapBoxSimulator() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id)
  const [stepIndex, setStepIndex] = useState(0)
  const [running, setRunning] = useState(true)

  const scenario = useMemo(
    () => SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0],
    [scenarioId],
  )
  const steps = scenario.steps
  const step = steps[Math.min(stepIndex, steps.length - 1)]
  const draftIndex = useMemo(() => steps.findIndex((s) => s.id === "draft"), [steps])
  const verifyIndex = useMemo(() => steps.findIndex((s) => s.id === "verify"), [steps])
  const belowThreshold = step.confidence < THRESHOLD

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setStepIndex((current) => (current + 1) % steps.length)
    }, 2400)
    return () => window.clearInterval(id)
  }, [running, steps.length])

  function selectScenario(id: string) {
    setScenarioId(id)
    setStepIndex(0)
    setRunning(true)
  }

  return (
    <div className="relative mx-auto w-full max-w-[760px]">
      <div className="overflow-hidden rounded-[1.75rem] border border-black/[0.08] bg-white/86 shadow-[0_30px_90px_-45px_rgba(23,26,23,0.55)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3 border-b border-black/[0.07] bg-[#fbfcf8]/85 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#be6a6a]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#c5883c]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#197869]" />
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-foreground/52">
            <Workflow className="h-3.5 w-3.5" aria-hidden />
            advan / trust-engine / support-workflow
          </div>
          <button
            type="button"
            onClick={() => setRunning((value) => !value)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[11px] font-bold text-foreground/65 transition hover:bg-black/[0.03]"
            aria-label={running ? "Pause demo" : "Play demo"}
          >
            {running ? <Pause className="h-3 w-3" aria-hidden /> : <Play className="h-3 w-3" aria-hidden />}
            {running ? "Pause" : "Play"}
          </button>
        </div>

        {/* Interactive scenario picker */}
        <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.07] bg-white/55 px-4 py-3 sm:px-5">
          <span className="mr-1 inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-foreground/45">
            <Sparkles className="h-3 w-3 text-[#4e3fb6]" aria-hidden />
            Try a question
          </span>
          <div role="tablist" aria-label="Choose a support scenario" className="flex flex-wrap gap-1.5">
            {SCENARIOS.map((s) => {
              const active = s.id === scenarioId
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectScenario(s.id)}
                  className={`relative rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                    active
                      ? "text-white"
                      : "border border-black/[0.08] bg-white text-foreground/65 hover:text-foreground hover:border-black/15"
                  }`}
                >
                  {active ? (
                    <motion.span
                      layoutId="tapbox-scenario-pill"
                      className="absolute inset-0 -z-10 rounded-full bg-[#171a17]"
                      transition={{ type: "spring", stiffness: 360, damping: 30 }}
                    />
                  ) : null}
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid bg-black/[0.045] lg:grid-cols-[1.05fr_0.95fr]">
          <ConversationPane scenario={scenario} step={step} stepIndex={stepIndex} draftIndex={draftIndex} verifyIndex={verifyIndex} belowThreshold={belowThreshold} />
          <TrustEnginePane scenario={scenario} step={step} stepIndex={stepIndex} belowThreshold={belowThreshold} />
        </div>

        <div className="grid border-t border-black/[0.07] bg-[#fbfcf8]/78 sm:grid-cols-4">
          {[
            ["42%", "Faster resolution"],
            ["78%", "Fewer escalations"],
            ["92%", "Source-cited"],
            ["50%", "Less repetition"],
          ].map(([value, label], index) => (
            <div
              key={label}
              className={`px-4 py-3 ${index !== 0 ? "sm:border-l border-black/[0.06]" : ""} ${
                index >= 2 ? "border-t sm:border-t-0 border-black/[0.06]" : ""
              }`}
            >
              <div className="text-lg font-semibold tracking-tight text-[#171a17]">{value}</div>
              <div className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-foreground/50">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.45, duration: 0.45 }}
        className="absolute -left-2 -top-3 hidden rounded-full border border-[#197869]/25 bg-[#eef8f4] px-3 py-1.5 text-[11px] font-bold text-[#146457] shadow-lg sm:inline-flex sm:items-center sm:gap-1.5"
      >
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        Trust Engine active
      </motion.div>
    </div>
  )
}

function ConversationPane({
  scenario,
  step,
  stepIndex,
  draftIndex,
  verifyIndex,
  belowThreshold,
}: {
  scenario: Scenario
  step: WorkflowStep
  stepIndex: number
  draftIndex: number
  verifyIndex: number
  belowThreshold: boolean
}) {
  return (
    <div className="bg-white/68 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-foreground/48">
            Live support conversation
          </div>
          <div className="mt-1 text-sm font-semibold text-[#171a17]">{scenario.label}</div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${toneClasses[step.tone].chip}`}>
          {step.status}
        </span>
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="wait">
          <ChatRow
            key={scenario.id}
            label={scenario.customer}
            meta={scenario.channel}
            text={scenario.question}
          />
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {stepIndex >= 1 ? (
            <motion.div
              key={`${scenario.id}-draft`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.32 }}
              className="rounded-2xl rounded-tr-md border border-[#c9c0ef] bg-[#f6f4ff] p-3.5"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#4e3fb6] text-white">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                </span>
                <div>
                  <div className="text-xs font-bold text-[#171a17]">Advan AI draft</div>
                  <div className="text-[10.5px] font-mono text-[#4e3fb6]">
                    {stepIndex < draftIndex ? "retrieving sources" : "source-cited response"}
                  </div>
                </div>
              </div>
              <TypedDraft key={`${scenario.id}-typed`} text={scenario.draft} active={stepIndex >= draftIndex} />
              {stepIndex >= verifyIndex ? <CitationStrip sources={scenario.sources} /> : null}
            </motion.div>
          ) : (
            <TypingPlaceholder key="typing" />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {belowThreshold && stepIndex >= 1 ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="rounded-xl border border-[#e7c988] bg-[#fff8ec] px-3.5 py-3"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#85561d]" aria-hidden />
                <div>
                  <div className="text-[12.5px] font-bold text-[#5b3c16]">Escalated before send</div>
                  <div className="text-[11.5px] leading-relaxed text-[#6e4b1d]/78">
                    Confidence is below the {THRESHOLD}% threshold, so the AI creates a human review
                    task with sources and a recommended response.
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <MemorySync active={stepIndex >= scenario.steps.length - 1} />
      </div>
    </div>
  )
}

function TrustEnginePane({
  scenario,
  step,
  stepIndex,
  belowThreshold,
}: {
  scenario: Scenario
  step: WorkflowStep
  stepIndex: number
  belowThreshold: boolean
}) {
  const tone = toneClasses[step.tone]
  return (
    <div className="bg-[#fbfcf8]/90 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#146457]">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Trust Engine
          </div>
          <AnimatePresence mode="wait">
            <motion.h3
              key={step.title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className="mt-1 text-lg font-semibold tracking-tight text-[#171a17]"
            >
              {step.title}
            </motion.h3>
          </AnimatePresence>
        </div>
        <ConfidenceRing value={step.confidence} danger={belowThreshold} />
      </div>

      <p className="min-h-[42px] text-sm leading-6 text-foreground/62">{step.subtitle}</p>

      <div className="mt-4 rounded-2xl border border-black/[0.07] bg-white p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-foreground/50">
            Confidence threshold
          </span>
          <span className="font-mono text-[11px] font-bold text-foreground/58">
            {step.confidence}% / {THRESHOLD}%
          </span>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-black/[0.07]">
          <motion.span
            className={`absolute inset-y-0 left-0 rounded-full ${
              belowThreshold ? "bg-[#c5883c]" : "bg-[#197869]"
            }`}
            animate={{ width: `${step.confidence}%` }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          />
          <span
            className="absolute inset-y-[-3px] w-px bg-[#171a17]/70"
            style={{ left: `${THRESHOLD}%` }}
          />
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11.5px] font-medium">
          {belowThreshold ? (
            <>
              <UserCheck className="h-3.5 w-3.5 text-[#85561d]" aria-hidden />
              <span className="text-[#85561d]">Route to human reviewer</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-[#166b5f]" aria-hidden />
              <span className="text-[#166b5f]">Eligible for approved workflow</span>
            </>
          )}
        </div>
      </div>

      <ol className="mt-4 space-y-2">
        {TRUST_CHECKS.map((check, index) => {
          const active = index <= stepIndex
          return (
            <motion.li
              key={check.label}
              animate={{ opacity: active ? 1 : 0.45 }}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${active ? `${tone.soft} ${tone.border}` : "border-black/[0.06] bg-white"}`}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${active ? tone.icon : "bg-black/[0.04] text-foreground/38"}`}>
                <check.icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 text-[12px] font-semibold text-foreground/74">
                {check.label}
              </span>
              <span className="rounded-md bg-white/72 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/48">
                {active ? check.value : "queued"}
              </span>
            </motion.li>
          )
        })}
      </ol>

      <TapBoxInspector scenario={scenario} />
    </div>
  )
}

function TapBoxInspector({ scenario }: { scenario: Scenario }) {
  const [open, setOpen] = useState(false)
  const aboveThreshold = scenario.verifiedConfidence >= THRESHOLD
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="tapbox-details"
        data-testid="tapbox-toggle"
        className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-[#197869]/20 bg-[#eef8f4] px-3.5 py-3 text-left transition hover:border-[#197869]/36 hover:bg-[#e5f3ed]"
      >
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#146457]">
            <Brain className="h-4 w-4" aria-hidden />
          </span>
          <span>
            <span className="block text-[12.5px] font-bold text-[#173f38]">
              Tap Box verification
            </span>
            <span className="block text-[11px] text-[#146457]/72">
              Inspect sources, confidence, and reasoning
            </span>
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-[#146457] transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id="tapbox-details"
            data-testid="tapbox-details"
            initial={{ height: 0, opacity: 0, y: -6 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -6 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-2xl border border-black/[0.07] bg-white p-4">
              <div className="flex items-center gap-4">
                <ConfidenceRing value={scenario.verifiedConfidence} danger={!aboveThreshold} />
                <div>
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.15em] text-foreground/48">
                    Confidence score
                  </div>
                  <p
                    className="mt-1 text-2xl font-semibold tracking-tight text-[#171a17]"
                    data-testid="confidence-score"
                  >
                    {scenario.verifiedConfidence}
                    <span className="text-base text-foreground/42">%</span>
                  </p>
                  <p className="text-xs leading-relaxed text-foreground/58">
                    {aboveThreshold
                      ? "Above threshold. Policy can approve automated send."
                      : "Below threshold. Human approval required before send."}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.15em] text-foreground/48">
                  Source citations
                </div>
                <div className="grid gap-2" data-testid="source-badges">
                  {scenario.sources.map((source) => (
                    <span
                      key={source.label}
                      className="flex items-start gap-2 rounded-xl border border-black/[0.06] bg-[#fbfcf8] px-3 py-2 text-left"
                    >
                      <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#4e3fb6]" aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-[12px] font-bold text-foreground/78">
                          {source.label}
                        </span>
                        <span className="block text-[11px] text-foreground/54">{source.detail}</span>
                      </span>
                      <span className="ml-auto rounded-md bg-[#e5f3ed] px-1.5 py-0.5 text-[10px] font-bold text-[#166b5f]">
                        {source.freshness}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function ChatRow({
  label,
  meta,
  text,
}: {
  label: string
  meta: string
  text: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.3 }}
      className="flex items-start gap-2.5"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f6e3e1] text-[#853b38]">
        <User className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-bold text-foreground/75">{label}</span>
          <span className="text-[10px] font-mono text-foreground/42">{meta}</span>
        </div>
        <div className="rounded-2xl rounded-tl-md border border-black/[0.07] bg-[#fff7f6] px-3.5 py-3 text-[13px] leading-6 text-foreground/78">
          {text}
        </div>
      </div>
    </motion.div>
  )
}

function TypingPlaceholder() {
  return (
    <div className="ml-10 inline-flex items-center gap-1.5 rounded-full border border-black/[0.07] bg-white px-3 py-2">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="h-1.5 w-1.5 rounded-full bg-[#4e3fb6]"
          animate={{ y: [0, -4, 0], opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: index * 0.14 }}
        />
      ))}
      <span className="ml-1 text-[11px] font-medium text-foreground/48">AI waiting for sources</span>
    </div>
  )
}

function TypedDraft({ text, active }: { text: string; active: boolean }) {
  const [count, setCount] = useState(active ? text.length : 0)

  useEffect(() => {
    if (!active) {
      setCount(0)
      return
    }
    setCount(0)
    const id = window.setInterval(() => {
      setCount((value) => {
        if (value >= text.length) {
          window.clearInterval(id)
          return value
        }
        return value + 5
      })
    }, 38)
    return () => window.clearInterval(id)
  }, [active, text])

  return (
    <p className="min-h-[96px] text-[13px] leading-6 text-[#302c55]">
      {active ? text.slice(0, count) : "Retrieving approved knowledge..."}
      {active && count < text.length ? <span className="animate-pulse">|</span> : null}
    </p>
  )
}

function CitationStrip({ sources }: { sources: SourceRef[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-black/[0.08] pt-2.5">
      {sources.map((source) => (
        <span
          key={source.label}
          className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10.5px] font-bold text-[#4e3fb6] ring-1 ring-[#c9c0ef]"
        >
          <BookOpen className="h-3 w-3" aria-hidden />
          {source.label}
        </span>
      ))}
    </div>
  )
}

function MemorySync({ active }: { active: boolean }) {
  return (
    <div className="rounded-xl border border-black/[0.07] bg-white px-3.5 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Send className="h-3.5 w-3.5 text-[#197869]" aria-hidden />
        <span className="text-[12px] font-bold text-foreground/70">
          Cross-channel memory sync
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {CHANNEL_MEMORY.map((channel, index) => (
          <motion.span
            key={channel}
            animate={{
              opacity: active || index === 0 ? 1 : 0.45,
              y: active ? [0, -1, 0] : 0,
            }}
            transition={{ duration: 0.7, delay: index * 0.08 }}
            className={`rounded-lg px-2 py-1.5 text-center text-[10.5px] font-bold ${
              active || index === 0 ? "bg-[#e5f3ed] text-[#166b5f]" : "bg-black/[0.04] text-foreground/42"
            }`}
          >
            {channel}
          </motion.span>
        ))}
      </div>
    </div>
  )
}

function ConfidenceRing({ value, danger }: { value: number; danger: boolean }) {
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  const color = danger ? "#c5883c" : "#197869"

  return (
    <div className="relative h-14 w-14 shrink-0" role="img" aria-label={`Confidence ${value}%`}>
      <svg className="-rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={radius} fill="none" stroke="rgba(23,26,23,0.08)" strokeWidth="4" />
        <motion.circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeWidth="4"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-[11px] font-bold tabular-nums ${danger ? "text-[#85561d]" : "text-[#166b5f]"}`}>
          {value}
        </span>
      </div>
    </div>
  )
}
