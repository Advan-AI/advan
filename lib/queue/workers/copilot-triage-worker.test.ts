/**
 * Integration tests for copilot-triage-worker.
 *
 * LLM calls (complaint classifier + draft generation) are injected via the
 * `deps` parameter — no real LLM or Redis connection is needed.  The DB is
 * real; tests create and clean up their own fixture data.
 *
 * LATENCY NOTES
 * ─────────────
 * The timings below reflect DB-only latency (LLM calls mocked).
 * Expected production overhead per processTriageJob call:
 *   • Complaint classifier:  +150–600 ms  (Anthropic Haiku / local Ollama)
 *   • Draft generation:      +500–4000 ms (Ollama variable; Anthropic ~500 ms)
 *   • DB round-trips:        ~50–250 ms   (matches what tests measure)
 *   • Total realistic range: 700 ms – 5 s
 *
 * The 5-second target (Prompt 3) is achievable when:
 *   a) Running Anthropic for both calls (fastest path), OR
 *   b) Running both LLM calls in parallel (already done via Promise.all), AND
 *   c) The Ollama model is loaded into GPU memory (cold-start adds > 10 s).
 * If Ollama cold-start is the bottleneck, pre-warm the model at worker start.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { and, count, eq } from "drizzle-orm"
import type { Job } from "bullmq"
import { db } from "@/lib/db"

// Prevent BullMQ Queue construction from connecting to Redis.
// The worker itself is exercised by calling processTriageJob() directly.
vi.mock("@/lib/queue/queues", () => ({
  copilotTriageQueue: { add: vi.fn().mockResolvedValue({ id: "mock-triage" }) },
  notificationQueue: { add: vi.fn().mockResolvedValue({ id: "mock-notify" }) },
  embeddingQueue: { add: vi.fn() },
}))

// Suppress realtime pub/sub — not relevant in DB integration tests.
vi.mock("@/lib/realtime/event-bus", () => ({
  publishHitlNew: vi.fn().mockResolvedValue(undefined),
  publishHitlResolved: vi.fn().mockResolvedValue(undefined),
  publishChatAgentReply: vi.fn().mockResolvedValue(undefined),
  publishChatTriagePending: vi.fn().mockResolvedValue(undefined),
}))
import {
  auditLogs,
  conversations,
  customers,
  hitlQueue,
  messages,
  organizations,
  tickets,
} from "@/lib/db/schema"
import { processTriageJob, type TriageDeps } from "./copilot-triage-worker"
import type { CopilotTriageJob } from "../queues"
import type { ComplaintClassification } from "@/lib/governance/complaint-classifier"
import type { DraftResult } from "./copilot-triage-worker"

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function fakeJob(data: CopilotTriageJob): Job<CopilotTriageJob> {
  return { data } as Job<CopilotTriageJob>
}

function makeClassifier(result: ComplaintClassification): TriageDeps["classifier"] {
  return async () => result
}

function makeDraftGenerator(result: DraftResult): TriageDeps["draftGenerator"] {
  return async () => result
}

const COMPLAINT_CLASSIFICATION: ComplaintClassification = {
  isComplaint: true,
  severity: "high",
  sentiment: "negative",
  reasoning: "Customer reports repeated shipping failure and demands a refund.",
}

const NON_COMPLAINT_CLASSIFICATION: ComplaintClassification = {
  isComplaint: false,
  severity: "low",
  sentiment: "neutral",
  reasoning: "Customer is asking a routine informational question.",
}

const HIGH_CONFIDENCE_DRAFT: DraftResult = {
  finalText: "Our business hours are Monday–Friday, 9 am–5 pm EST.",
  confidence: 92,
  auditLogId: "", // filled in per test
  policyPassed: true,
  citations: [],
}

const LOW_CONFIDENCE_DRAFT: DraftResult = {
  finalText: "I'll look into this for you.",
  confidence: 60,
  auditLogId: "",
  policyPassed: true,
  citations: [],
}

// ─── DB fixtures ──────────────────────────────────────────────────────────────

let orgId: string
let customerId: string
let ticketId: string
let conversationId: string

async function insertTestMessage(content: string) {
  const [msg] = await db
    .insert(messages)
    .values({ conversationId, role: "user", content })
    .returning()
  return msg
}

async function insertTestAuditLog(orgId: string, ticketId: string) {
  const [row] = await db
    .insert(auditLogs)
    .values({
      orgId,
      ticketId,
      input: "test input",
      output: "test output",
      metadata: {
        confidence: 92,
        citations: [],
        policyChecks: [],
        latencyMs: 100,
        model: "test",
      },
    })
    .returning()
  return row
}

beforeAll(async () => {
  const slug = `triage-test-${Date.now()}`

  const [org] = await db
    .insert(organizations)
    .values({ name: "Triage Test Org", slug })
    .returning()
  orgId = org.id

  const [customer] = await db
    .insert(customers)
    .values({ orgId, email: "triage-customer@test.local", name: "Triage Customer" })
    .returning()
  customerId = customer.id

  const [ticket] = await db
    .insert(tickets)
    .values({ orgId, customerId, subject: "Triage test ticket", channel: "chat" })
    .returning()
  ticketId = ticket.id

  const [conv] = await db
    .insert(conversations)
    .values({ orgId, ticketId, channel: "chat", customerId })
    .returning()
  conversationId = conv.id
})

afterAll(async () => {
  if (!orgId) return
  await db.delete(auditLogs).where(eq(auditLogs.orgId, orgId))
  await db.delete(hitlQueue).where(eq(hitlQueue.orgId, orgId))
  await db.delete(messages).where(eq(messages.conversationId, conversationId))
  await db.delete(conversations).where(eq(conversations.orgId, orgId))
  await db.delete(tickets).where(eq(tickets.orgId, orgId))
  await db.delete(customers).where(eq(customers.orgId, orgId))
  await db.delete(organizations).where(eq(organizations.id, orgId))
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("processTriageJob — complaint message", () => {
  it(
    "never auto-sends a complaint regardless of confidence; routes to HITL with [COMPLAINT] prefix",
    async () => {
      const msg = await insertTestMessage(
        "this is the third time my order hasn't shipped, I want a refund"
      )
      const auditLog = await insertTestAuditLog(orgId, ticketId)

      const deps: TriageDeps = {
        classifier: makeClassifier(COMPLAINT_CLASSIFICATION),
        draftGenerator: makeDraftGenerator({
          ...HIGH_CONFIDENCE_DRAFT,
          auditLogId: auditLog.id,
        }),
      }

      const t0 = performance.now()
      await processTriageJob(fakeJob({ orgId, ticketId, conversationId, messageId: msg.id }), deps)
      const elapsed = performance.now() - t0

      console.log(`\n  [latency] Complaint path (mocked LLM, DB-only): ${elapsed.toFixed(0)} ms`)

      // ── Must NOT auto-send ──────────────────────────────────────────────────
      const agentMessages = await db
        .select()
        .from(messages)
        .where(and(eq(messages.conversationId, conversationId), eq(messages.role, "agent")))

      expect(agentMessages).toHaveLength(0)

      // ── Must create a HITL row with [COMPLAINT] prefix ─────────────────────
      const hitlRow = await db.query.hitlQueue.findFirst({
        where: and(eq(hitlQueue.orgId, orgId), eq(hitlQueue.ticketId, ticketId)),
      })
      expect(hitlRow).toBeTruthy()
      expect(hitlRow!.reason).toMatch(/\[COMPLAINT\]/i)
      expect(hitlRow!.draftOutput).toBe(HIGH_CONFIDENCE_DRAFT.finalText)

      // ── Must stamp triage decision on the customer message ─────────────────
      const refreshed = await db.query.messages.findFirst({
        where: eq(messages.id, msg.id),
      })
      expect(refreshed!.metadata?.triage?.decision).toBe("hitl_complaint")
      expect(refreshed!.metadata?.triage?.isComplaint).toBe(true)
      expect(refreshed!.metadata?.triage?.confidence).toBe(HIGH_CONFIDENCE_DRAFT.confidence)
      expect(refreshed!.metadata?.triage?.auditLogId).toBe(auditLog.id)

      // ── Must update the audit log with source=auto_triage ──────────────────
      const updatedAudit = await db.query.auditLogs.findFirst({
        where: eq(auditLogs.id, auditLog.id),
      })
      expect(updatedAudit!.metadata.source).toBe("auto_triage")
      expect(updatedAudit!.metadata.complaintClassification?.isComplaint).toBe(true)

      // ── Latency gate ───────────────────────────────────────────────────────
      // DB-only portion must be well under 5 s. With real LLMs expect 1–5 s total.
      expect(elapsed).toBeLessThan(5000)
    }
  )
})

describe("processTriageJob — high-confidence non-complaint", () => {
  it(
    "auto-sends the draft and writes an auditLogs row with source=auto_triage",
    async () => {
      const msg = await insertTestMessage("what are your business hours")
      const auditLog = await insertTestAuditLog(orgId, ticketId)

      const deps: TriageDeps = {
        classifier: makeClassifier(NON_COMPLAINT_CLASSIFICATION),
        draftGenerator: makeDraftGenerator({
          ...HIGH_CONFIDENCE_DRAFT,
          auditLogId: auditLog.id,
        }),
      }

      const t0 = performance.now()
      await processTriageJob(fakeJob({ orgId, ticketId, conversationId, messageId: msg.id }), deps)
      const elapsed = performance.now() - t0

      console.log(`\n  [latency] Auto-send path (mocked LLM, DB-only): ${elapsed.toFixed(0)} ms`)

      // ── Must insert an agent reply ──────────────────────────────────────────
      const agentMessages = await db
        .select()
        .from(messages)
        .where(and(eq(messages.conversationId, conversationId), eq(messages.role, "agent")))

      expect(agentMessages.length).toBeGreaterThan(0)
      const reply = agentMessages[agentMessages.length - 1]
      expect(reply.content).toBe(HIGH_CONFIDENCE_DRAFT.finalText)

      // ── Triage decision must be auto_send (not HITL) ──────────────────────
      // The HITL table may have rows from the complaint test; we check the
      // message's own triage decision as the authoritative source.

      // ── Audit log must be stamped ──────────────────────────────────────────
      const updatedAudit = await db.query.auditLogs.findFirst({
        where: eq(auditLogs.id, auditLog.id),
      })
      expect(updatedAudit!.metadata.source).toBe("auto_triage")
      expect(updatedAudit!.metadata.complaintClassification?.isComplaint).toBe(false)

      // ── Message triage metadata ────────────────────────────────────────────
      const refreshed = await refreshedMessage(msg.id)
      expect(refreshed!.metadata?.triage?.decision).toBe("auto_send")
      expect(refreshed!.metadata?.triage?.confidence).toBe(92)
      expect(refreshed!.metadata?.triage?.isComplaint).toBe(false)

      // ── Latency gate ───────────────────────────────────────────────────────
      expect(elapsed).toBeLessThan(5000)
    }
  )
})

describe("processTriageJob — low confidence non-complaint", () => {
  it("routes to HITL (not auto-send) when confidence is below 85", async () => {
    const msg = await insertTestMessage("I am not sure about something with my account")
    const auditLog = await insertTestAuditLog(orgId, ticketId)

    const hitlBefore = await db
      .select({ n: count() })
      .from(hitlQueue)
      .where(eq(hitlQueue.orgId, orgId))

    const deps: TriageDeps = {
      classifier: makeClassifier(NON_COMPLAINT_CLASSIFICATION),
      draftGenerator: makeDraftGenerator({ ...LOW_CONFIDENCE_DRAFT, auditLogId: auditLog.id }),
    }

    await processTriageJob(fakeJob({ orgId, ticketId, conversationId, messageId: msg.id }), deps)

    const hitlAfter = await db
      .select({ n: count() })
      .from(hitlQueue)
      .where(eq(hitlQueue.orgId, orgId))

    expect(hitlAfter[0].n).toBeGreaterThan(hitlBefore[0].n)

    const refreshed = await refreshedMessage(msg.id)
    expect(refreshed!.metadata?.triage?.decision).toBe("hitl_low_confidence")
  })
})

describe("processTriageJob — idempotency", () => {
  it("is a no-op if the message already has a triage decision (BullMQ redelivery guard)", async () => {
    const msg = await insertTestMessage("duplicate job test message")

    // Pre-stamp a triage decision directly on the message
    await db
      .update(messages)
      .set({
        metadata: {
          triage: {
            decision: "auto_send",
            confidence: 91,
            isComplaint: false,
            auditLogId: "pre-existing-id",
            classifiedAt: new Date().toISOString(),
          },
        },
      })
      .where(eq(messages.id, msg.id))

    const hitlBefore = await db
      .select({ n: count() })
      .from(hitlQueue)
      .where(eq(hitlQueue.orgId, orgId))

    const agentMsgsBefore = await db
      .select({ n: count() })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.role, "agent")))

    // Deps that throw if called — proves the classifier/draft were not invoked
    const deps: TriageDeps = {
      classifier: async () => {
        throw new Error("classifier must not be called on duplicate job")
      },
      draftGenerator: async () => {
        throw new Error("draftGenerator must not be called on duplicate job")
      },
    }

    const t0 = performance.now()
    await processTriageJob(fakeJob({ orgId, ticketId, conversationId, messageId: msg.id }), deps)
    const elapsed = performance.now() - t0

    console.log(`\n  [latency] Idempotency no-op (single DB read): ${elapsed.toFixed(0)} ms`)

    // No new HITL rows
    const hitlAfter = await db
      .select({ n: count() })
      .from(hitlQueue)
      .where(eq(hitlQueue.orgId, orgId))
    expect(hitlAfter[0].n).toBe(hitlBefore[0].n)

    // No new agent messages
    const agentMsgsAfter = await db
      .select({ n: count() })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.role, "agent")))
    expect(agentMsgsAfter[0].n).toBe(agentMsgsBefore[0].n)

    // DB-only idempotency check should be very fast
    expect(elapsed).toBeLessThan(500)
  })
})

// ─── Helper ───────────────────────────────────────────────────────────────────

async function refreshedMessage(messageId: string) {
  return db.query.messages.findFirst({ where: eq(messages.id, messageId) })
}
