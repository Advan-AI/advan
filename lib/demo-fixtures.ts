/**
 * Shared demo fixtures for the audit ticker (sign-in trust panel + dashboard
 * audit trail card) and the human review queue. Replace with live data when
 * the HITL Temporal signal and audit stream are wired.
 */

export type AuditTone = "sage" | "violet" | "amber" | "blue" | "rose"

export interface AuditEvent {
  tag: string
  tone: AuditTone
  text: string
}

export const auditEvents: AuditEvent[] = [
  { tag: "SENT", tone: "sage", text: "Reply to Maria L. · 2 sources · 96%" },
  { tag: "PASS", tone: "violet", text: "Policy gate · refund intent · TK-84221" },
  { tag: "HUMAN", tone: "amber", text: "Low confidence 71% → routed to J. Cole" },
  { tag: "SOURCE", tone: "blue", text: "KB article v2.4 cited · webhook timeout" },
  { tag: "PII", tone: "rose", text: "Redacted 2 fields before send · TK-84228" },
  { tag: "SENT", tone: "sage", text: "Reply to Tom B. · 3 sources · 94%" },
]

export interface QueueItem {
  id: string
  initials: string
  name: string
  company: string
  confidence: number
  ticket: string
  summary: string
  citation: string
}

export const queueItems: QueueItem[] = [
  {
    id: "q1",
    initials: "MK",
    name: "Marcus Kim",
    company: "Brightline",
    confidence: 74,
    ticket: "TK-84231",
    summary: "Refund request exceeds auto-approve limit — draft ready for review",
    citation: "Refund policy §2.1",
  },
  {
    id: "q2",
    initials: "SA",
    name: "Sofia Alvarez",
    company: "Nordic SaaS",
    confidence: 68,
    ticket: "TK-84233",
    summary: "Contract termination clause question — legal intent detected",
    citation: "MSA template v4",
  },
  {
    id: "q3",
    initials: "JW",
    name: "James Wu",
    company: "Vantage Health",
    confidence: 79,
    ticket: "TK-84236",
    summary: "HIPAA data export request — draft held for reviewer sign-off",
    citation: "Compliance runbook",
  },
]
