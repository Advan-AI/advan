/**
 * Focused integration tests for getTriageBreakdown().
 *
 * Critical invariant being verified:
 *   A complaint-origin auto-triage audit log (source="auto_triage",
 *   complaintClassification.isComplaint=true) must NEVER be counted as an
 *   auto-resolved message in reporting.  The triage worker enforces this in
 *   the decision gate, but this test locks it down at the analytics layer so
 *   any future regression in the reporting query is caught before it reaches
 *   the dashboard.
 *
 * Fixtures create their own org so tests are fully isolated.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  auditLogs,
  conversations,
  customers,
  messages,
  organizations,
  tickets,
} from "@/lib/db/schema"
import { getTriageBreakdown } from "./triage-breakdown"

// ─── Fixture helpers ──────────────────────────────────────────────────────────

let orgId: string
let conversationId: string
let emailConversationId: string

/**
 * Insert a user message that has been stamped with triage metadata by the
 * triage worker — this is the source of truth for the breakdown query.
 */
async function insertTriagedMessage(opts: {
  conversationId: string
  content: string
  decision: "auto_send" | "hitl_complaint" | "hitl_low_confidence"
  isComplaint: boolean
  confidence?: number
}) {
  const [msg] = await db
    .insert(messages)
    .values({
      conversationId: opts.conversationId,
      role: "user",
      content: opts.content,
      metadata: {
        triage: {
          decision: opts.decision,
          isComplaint: opts.isComplaint,
          confidence: opts.confidence ?? 90,
          auditLogId: "test-audit-placeholder",
          classifiedAt: new Date().toISOString(),
        },
      },
    })
    .returning()
  return msg
}

/**
 * Insert an audit log exactly as the triage worker writes it for a complaint
 * that was sent to HITL review.  Returns the inserted row so callers can
 * assert on the stored metadata directly.
 */
async function insertComplaintAuditLog(opts: {
  ticketId: string
  input?: string
}) {
  const [row] = await db
    .insert(auditLogs)
    .values({
      orgId,
      ticketId: opts.ticketId,
      input: opts.input ?? "I demand a refund — this is completely unacceptable",
      output: "I understand your frustration. I am escalating this to a specialist.",
      metadata: {
        confidence: 88,
        citations: [],
        policyChecks: [],
        latencyMs: 1400,
        model: "claude-haiku",
        source: "auto_triage",
        complaintClassification: {
          isComplaint: true,
          severity: "high",
          sentiment: "negative",
          reasoning: "Customer demands a refund with strong negative sentiment.",
        },
      },
    })
    .returning()
  return row
}

// ─── DB fixtures ──────────────────────────────────────────────────────────────

let ticketId: string

beforeAll(async () => {
  const slug = `triage-report-test-${Date.now()}`

  const [org] = await db
    .insert(organizations)
    .values({ name: "Triage Report Test Org", slug })
    .returning()
  orgId = org.id

  const [customer] = await db
    .insert(customers)
    .values({ orgId, email: `breakdown-${Date.now()}@test.local`, name: "Report Customer" })
    .returning()

  const [ticket] = await db
    .insert(tickets)
    .values({ orgId, customerId: customer.id, subject: "Report test ticket", channel: "chat" })
    .returning()
  ticketId = ticket.id

  const [conv] = await db
    .insert(conversations)
    .values({ orgId, ticketId: ticket.id, channel: "chat", customerId: customer.id })
    .returning()
  conversationId = conv.id

  // A second conversation on a different channel so we can verify channel breakdown.
  const [emailTicket] = await db
    .insert(tickets)
    .values({ orgId, customerId: customer.id, subject: "Email report test ticket", channel: "email" })
    .returning()

  const [emailConv] = await db
    .insert(conversations)
    .values({ orgId, ticketId: emailTicket.id, channel: "email", customerId: customer.id })
    .returning()
  emailConversationId = emailConv.id
})

afterAll(async () => {
  if (!orgId) return
  await db.delete(auditLogs).where(eq(auditLogs.orgId, orgId))
  await db.delete(messages).where(eq(messages.conversationId, conversationId))
  await db.delete(messages).where(eq(messages.conversationId, emailConversationId))
  await db.delete(conversations).where(eq(conversations.orgId, orgId))
  await db.delete(tickets).where(eq(tickets.orgId, orgId))
  await db.delete(customers).where(eq(customers.orgId, orgId))
  await db.delete(organizations).where(eq(organizations.id, orgId))
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("getTriageBreakdown — complaint invariant", () => {
  it(
    "complaint-origin message (hitl_complaint) is never counted as auto-resolved, even when draft confidence was high",
    async () => {
      // Complaint message — model was 91% confident, but it was still routed to HITL.
      // This simulates the exact triage worker behaviour.
      await insertTriagedMessage({
        conversationId,
        content: "This is absolutely unacceptable — I've been waiting 2 weeks for my refund!",
        decision: "hitl_complaint",
        isComplaint: true,
        confidence: 91,
      })

      // Non-complaint message auto-resolved for contrast.
      await insertTriagedMessage({
        conversationId,
        content: "What are your store hours on weekends?",
        decision: "auto_send",
        isComplaint: false,
        confidence: 94,
      })

      const breakdown = await getTriageBreakdown(orgId)

      // ── Core invariant: complaints must never appear in auto-resolved ────────
      expect(breakdown.byType.complaint.autoResolved).toBe(0)
      expect(breakdown.byType.complaint.escalated).toBeGreaterThanOrEqual(1)

      // ── Non-complaints can be auto-resolved ──────────────────────────────────
      expect(breakdown.byType.nonComplaint.autoResolved).toBeGreaterThanOrEqual(1)

      // ── Total is the sum of both buckets ─────────────────────────────────────
      expect(breakdown.total).toBe(
        breakdown.byType.complaint.total + breakdown.byType.nonComplaint.total
      )

      // ── autoResolved count must equal non-complaint auto-resolved only ───────
      // (since complaints contribute 0 to autoResolved)
      expect(breakdown.autoResolved).toBe(breakdown.byType.nonComplaint.autoResolved)
    }
  )
})

describe("getTriageBreakdown — audit log source cross-check", () => {
  it(
    "an audit log with source=auto_triage and complaintClassification.isComplaint=true corresponds to an escalated message, not an auto-send",
    async () => {
      // Insert the audit log the triage worker would have written for this complaint.
      const auditLog = await insertComplaintAuditLog({ ticketId })

      // Verify the audit log is correctly stored with auto_triage source.
      expect(auditLog.metadata.source).toBe("auto_triage")
      expect(auditLog.metadata.complaintClassification?.isComplaint).toBe(true)

      // Insert the corresponding triage-stamped customer message.
      await insertTriagedMessage({
        conversationId,
        content: "I demand a refund — this is completely unacceptable",
        decision: "hitl_complaint",
        isComplaint: true,
        confidence: 88,
      })

      const breakdown = await getTriageBreakdown(orgId)

      // The auto_triage complaint audit log must not contribute to auto-resolved.
      expect(breakdown.byType.complaint.autoResolved).toBe(0)

      // Complaints are accounted for in the escalated bucket.
      expect(breakdown.byType.complaint.escalated).toBeGreaterThanOrEqual(1)
    }
  )
})

describe("getTriageBreakdown — channel breakdown", () => {
  it("correctly segregates auto vs escalated counts per channel", async () => {
    // Email channel: one auto-send, one complaint escalation.
    await insertTriagedMessage({
      conversationId: emailConversationId,
      content: "When does my subscription renew?",
      decision: "auto_send",
      isComplaint: false,
      confidence: 95,
    })
    await insertTriagedMessage({
      conversationId: emailConversationId,
      content: "Your service is a scam and I am contacting my bank!",
      decision: "hitl_complaint",
      isComplaint: true,
      confidence: 90,
    })

    const breakdown = await getTriageBreakdown(orgId)

    const emailChannel = breakdown.byChannel.find((ch) => ch.channel === "email")
    expect(emailChannel).toBeDefined()

    // Email channel: complaints must be in escalated, not auto
    // (may have other messages from prior tests within the same org fixture,
    //  so we assert the directional invariant rather than exact counts)
    expect(emailChannel!.autoResolved).toBeLessThanOrEqual(emailChannel!.total)
    expect(emailChannel!.escalated).toBeGreaterThanOrEqual(1)

    // Overall auto-rate must be strictly less than 100% because complaints exist.
    expect(breakdown.autoRate).toBeLessThan(100)
  })
})

describe("getTriageBreakdown — empty org", () => {
  it("returns zero totals when no messages have been triaged", async () => {
    // Create an isolated org with no triage activity.
    const [emptyOrg] = await db
      .insert(organizations)
      .values({ name: "Empty Triage Org", slug: `empty-triage-${Date.now()}` })
      .returning()

    try {
      const breakdown = await getTriageBreakdown(emptyOrg.id)
      expect(breakdown.total).toBe(0)
      expect(breakdown.autoResolved).toBe(0)
      expect(breakdown.escalated).toBe(0)
      expect(breakdown.autoRate).toBe(0)
      expect(breakdown.byChannel).toHaveLength(0)
      expect(breakdown.byType.complaint.total).toBe(0)
      expect(breakdown.byType.nonComplaint.total).toBe(0)
    } finally {
      await db.delete(organizations).where(eq(organizations.id, emptyOrg.id))
    }
  })
})
