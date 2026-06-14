"use client"

import React from "react"
import { Brain, BookOpen, Banknote, PhoneCall, ShieldCheck, Sparkles, UserCheck } from "lucide-react"
import { SectionHeader } from "@/components/section-primitives"
import { OrchestrationConsole } from "./orchestration/orchestration-console"
import { AgentDef, Edge } from "./orchestration/types"

/* ─── Static Proof-of-Concept Data ─────────────────────── */
const AGENTS: AgentDef[] = [
  {
    id: "triage",
    label: "Triage",
    role: "Intent classifier",
    icon: Brain,
    tone: "violet",
    x: 40,
    y: 190,
    memory: ["Detects intent in 60ms", "98% routing accuracy"],
  },
  {
    id: "knowledge",
    label: "Knowledge",
    role: "Docs · KB · Tickets",
    icon: BookOpen,
    tone: "blue",
    x: 270,
    y: 50,
    memory: ["Vector search across 12k docs", "Source-cited retrieval"],
  },
  {
    id: "billing",
    label: "Billing Specialist",
    role: "Invoice + refund logic",
    icon: Banknote,
    tone: "amber",
    x: 270,
    y: 190,
    memory: ["Reads from Stripe + ERP", "Applies refund policy v2.3"],
  },
  {
    id: "voice",
    label: "Voice Agent",
    role: "Call transcription",
    icon: PhoneCall,
    tone: "sage",
    x: 270,
    y: 330,
    memory: ["Real-time STT", "Sentiment + tone capture"],
  },
  {
    id: "policy",
    label: "Policy Guard",
    role: "Compliance + redaction",
    icon: ShieldCheck,
    tone: "rose",
    x: 500,
    y: 190,
    memory: ["SOC 2 + GDPR rules", "Blocks unsafe sends"],
  },
  {
    id: "composer",
    label: "Composer",
    role: "Draft & send reply",
    icon: Sparkles,
    tone: "violet",
    x: 700,
    y: 100,
    memory: ["Personalizes tone", "Tracks CSAT outcomes"],
  },
  {
    id: "human",
    label: "Human-in-loop",
    role: "Agent approval",
    icon: UserCheck,
    tone: "amber",
    x: 700,
    y: 290,
    memory: ["Approves edge cases", "Edits AI drafts inline"],
  },
]

const STAGES = [
  {
    states: { triage: "thinking" },
    edges: [] as Edge[],
    banner: "Inbound · Maria Lopez · Email",
    log: { who: "triage",  tone: "info", message: "Received inbound · classifying intent" },
  },
  {
    states: { triage: "resolved", knowledge: "processing", billing: "processing" },
    edges: [
      { from: "triage", to: "knowledge" },
      { from: "triage", to: "billing" },
    ] as Edge[],
    banner: "Routed to Knowledge + Billing in parallel",
    log: { who: "triage", tone: "ok", message: "Intent = Billing/Overcharge · delegating to 2 agents" },
  },
  {
    states: { triage: "resolved", knowledge: "resolved", billing: "resolved", policy: "thinking" },
    edges: [
      { from: "billing", to: "policy" },
      { from: "knowledge", to: "policy" },
    ] as Edge[],
    banner: "Policy Guard reviewing draft",
    log: { who: "billing", tone: "ok", message: "Refund eligibility confirmed · $49.00 within policy" },
  },
  {
    states: { triage: "resolved", knowledge: "resolved", billing: "resolved", policy: "resolved", composer: "resolved" },
    edges: [{ from: "policy", to: "composer" }] as Edge[],
    banner: "Resolved · sent · CSAT 5★",
    log: { who: "composer", tone: "ok", message: "Reply sent · ticket #TK-84219 resolved in 12s" },
  },
] as any[]

export function OrchestrationSection() {
  return (
    <section id="orchestration" className="relative py-14 lg:py-20 bg-[#FBFBFB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Agent Orchestration"
          title={
            <>
              An AI ops center where specialists{" "}
              <span className="text-gradient-brand">collaborate in real time</span>
            </>
          }
          lede="Watch Advan’s autonomous agents triage, retrieve, gate, and escalate — coordinated by a policy-aware orchestrator with a human always one click away."
        />

        <div className="mt-8">
          <OrchestrationConsole 
            agents={AGENTS} 
            stages={STAGES} 
            initialStats={{ handled: 1284, p95: 3.6, success: 98.4 }} 
          />
        </div>
      </div>
    </section>
  )
}
