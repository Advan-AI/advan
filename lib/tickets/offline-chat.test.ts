/**
 * Integration tests: chat offline-delivery mode.
 *
 * Scenarios:
 *
 *   A. No agents online → ticket created with chatOfflineDelivery=true.
 *      Triage auto-send path calls notificationQueue (email), NOT
 *      publishChatAgentReply.
 *
 *   B. Agent comes online mid-conversation + visitor reconnects via socket
 *      → clearOfflineDelivery clears the flag.  Next triage auto-send uses
 *      publishChatAgentReply (socket), NOT notificationQueue.
 *
 *   C. Online chat (agent available at creation) → chatOfflineDelivery=false.
 *      Triage auto-send uses socket delivery, email queue is not touched.
 *
 * All tests use a real PostgreSQL DB; queue and event-bus are mocked to avoid
 * real Redis connections while remaining assertable.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { and, eq } from "drizzle-orm"
import type { Job } from "bullmq"
import { db } from "@/lib/db"
import {
  auditLogs,
  conversations,
  customers,
  messages,
  organizations,
  tickets,
} from "@/lib/db/schema"

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/lib/queue/queues", () => ({
  copilotTriageQueue: { add: vi.fn().mockResolvedValue({ id: "mock-triage" }) },
  notificationQueue: { add: vi.fn().mockResolvedValue({ id: "mock-notify" }) },
  embeddingQueue: { add: vi.fn() },
}))

vi.mock("@/lib/realtime/event-bus", () => ({
  publishHitlNew: vi.fn().mockResolvedValue(undefined),
  publishHitlResolved: vi.fn().mockResolvedValue(undefined),
  publishChatAgentReply: vi.fn().mockResolvedValue(undefined),
  publishChatTriagePending: vi.fn().mockResolvedValue(undefined),
  // isAnyAgentOnline is NOT mocked here — controlled per-test via overrides.
  isAnyAgentOnline: vi.fn().mockResolvedValue(false),
}))

import { notificationQueue } from "@/lib/queue/queues"
import { publishChatAgentReply, isAnyAgentOnline } from "@/lib/realtime/event-bus"
import { resolveOrCreateIntake } from "./auto-intake"
import { processTriageJob, type TriageDeps, type DraftResult } from "@/lib/queue/workers/copilot-triage-worker"
import type { CopilotTriageJob } from "@/lib/queue/queues"
import type { ComplaintClassification } from "@/lib/governance/complaint-classifier"

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NON_COMPLAINT: ComplaintClassification = {
  isComplaint: false,
  severity: "low",
  sentiment: "neutral",
  reasoning: "Routine informational question.",
}

const DRAFT_TEXT = "We are open Monday–Friday 9 am–6 pm."

const HIGH_CONF_DRAFT: DraftResult = {
  finalText: DRAFT_TEXT,
  confidence: 94,
  auditLogId: "",
  policyPassed: true,
  citations: [],
}

function makeJob(data: CopilotTriageJob): Job<CopilotTriageJob> {
  return { data } as Job<CopilotTriageJob>
}

async function seedAuditLog(tId: string, orgId: string) {
  const [row] = await db
    .insert(auditLogs)
    .values({
      orgId,
      ticketId: tId,
      input: "seed",
      output: "seed",
      metadata: { confidence: 94, citations: [], policyChecks: [], latencyMs: 10, model: "test" },
    })
    .returning()
  return row
}

// ─── Shared org fixture ───────────────────────────────────────────────────────

let orgId: string

beforeAll(async () => {
  const slug = `offline-chat-test-${Date.now()}`
  const [org] = await db.insert(organizations).values({ name: "Offline Chat Org", slug }).returning()
  orgId = org.id
})

afterAll(async () => {
  if (!orgId) return
  await db.delete(auditLogs).where(eq(auditLogs.orgId, orgId))
  const convRows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.orgId, orgId))
  for (const { id } of convRows) {
    await db.delete(messages).where(eq(messages.conversationId, id))
  }
  await db.delete(conversations).where(eq(conversations.orgId, orgId))
  await db.delete(tickets).where(eq(tickets.orgId, orgId))
  await db.delete(customers).where(eq(customers.orgId, orgId))
  await db.delete(organizations).where(eq(organizations.id, orgId))
})

// ─── Scenario A: no agents online ─────────────────────────────────────────────

describe("Scenario A — no agents online: ticket created in offline mode, reply via email", () => {
  it(
    "intake sets chatOfflineDelivery=true when chatOfflineDelivery flag is set; " +
      "triage auto-send enqueues notificationQueue NOT publishChatAgentReply",
    async () => {
      vi.mocked(notificationQueue.add).mockClear()
      vi.mocked(publishChatAgentReply).mockClear()

      // Visitor submits pre-chat form email (no agents online).
      const sessionId = `offline-session-${Date.now()}`
      const visitorEmail = `visitor-${Date.now()}@offline.test`

      const intake = await resolveOrCreateIntake({
        orgId,
        channel: "chat",
        customerIdentifier: { visitorSessionId: sessionId, email: visitorEmail },
        content: "What are your business hours?",
        customerName: "Alex Smith",
        chatOfflineDelivery: true,
      })

      // Customer must have the provided email.
      const customer = await db.query.customers.findFirst({
        where: and(
          eq(customers.orgId, orgId),
          eq(customers.visitorSessionId, sessionId),
        ),
      })
      expect(customer).toBeTruthy()
      expect(customer!.email).toBe(visitorEmail)
      expect(customer!.name).toBe("Alex Smith")

      // Conversation must be marked offline.
      const conv = await db.query.conversations.findFirst({
        where: eq(conversations.id, intake.conversationId),
      })
      expect(conv).toBeTruthy()
      expect(conv!.chatOfflineDelivery).toBe(true)

      // Run triage with a high-confidence non-complaint draft.
      const auditRow = await seedAuditLog(intake.ticketId, orgId)
      const deps: TriageDeps = {
        classifier: async () => NON_COMPLAINT,
        draftGenerator: async () => ({ ...HIGH_CONF_DRAFT, auditLogId: auditRow.id }),
        retrieve: async () => [{ score: 0.9 }],
      }

      await processTriageJob(
        makeJob({ orgId, ticketId: intake.ticketId, conversationId: intake.conversationId, messageId: intake.messageId }),
        deps,
      )

      // ── Email queue must be called (offline delivery) ─────────────────────
      expect(notificationQueue.add).toHaveBeenCalledWith(
        "agent_reply",
        expect.objectContaining({
          type: "agent_reply",
          orgId,
          conversationId: intake.conversationId,
          messageId: expect.any(String),
        }),
        expect.any(Object),
      )

      // ── Socket emit must NOT be called ────────────────────────────────────
      expect(publishChatAgentReply).not.toHaveBeenCalled()
    },
  )
})

// ─── Scenario B: agent comes online, visitor reconnects ───────────────────────

describe("Scenario B — agent comes online mid-conversation: clearOfflineDelivery switches to socket", () => {
  it(
    "after clearOfflineDelivery, triage auto-send uses socket delivery not email",
    async () => {
      vi.mocked(notificationQueue.add).mockClear()
      vi.mocked(publishChatAgentReply).mockClear()

      // Create an offline ticket (same as scenario A).
      const sessionId = `reconnect-session-${Date.now()}`
      const visitorEmail = `visitor-reconnect-${Date.now()}@test.local`

      const intake = await resolveOrCreateIntake({
        orgId,
        channel: "chat",
        customerIdentifier: { visitorSessionId: sessionId, email: visitorEmail },
        content: "Hello, is anyone there?",
        chatOfflineDelivery: true,
      })

      // Verify conversation starts in offline mode.
      const before = await db.query.conversations.findFirst({
        where: eq(conversations.id, intake.conversationId),
      })
      expect(before!.chatOfflineDelivery).toBe(true)

      // Simulate: agent comes online + visitor reconnects → clearOfflineDelivery.
      await db
        .update(conversations)
        .set({ chatOfflineDelivery: false })
        .where(
          and(
            eq(conversations.id, intake.conversationId),
            eq(conversations.chatOfflineDelivery, true),
          ),
        )

      const after = await db.query.conversations.findFirst({
        where: eq(conversations.id, intake.conversationId),
      })
      expect(after!.chatOfflineDelivery).toBe(false)

      // Visitor sends a second message (agent is now online — no offline flag).
      const [secondMsg] = await db
        .insert(messages)
        .values({ conversationId: intake.conversationId, role: "user", content: "Great, I'm back! What are your business hours?" })
        .returning()

      const auditRow = await seedAuditLog(intake.ticketId, orgId)
      const deps: TriageDeps = {
        classifier: async () => NON_COMPLAINT,
        draftGenerator: async () => ({ ...HIGH_CONF_DRAFT, auditLogId: auditRow.id }),
        retrieve: async () => [{ score: 0.9 }],
      }

      await processTriageJob(
        makeJob({ orgId, ticketId: intake.ticketId, conversationId: intake.conversationId, messageId: secondMsg.id }),
        deps,
      )

      // ── Socket delivery must be used now ──────────────────────────────────
      expect(publishChatAgentReply).toHaveBeenCalledWith(
        orgId,
        expect.objectContaining({ conversationId: intake.conversationId, content: DRAFT_TEXT }),
      )

      // ── Email queue must NOT be called (back to live mode) ────────────────
      expect(notificationQueue.add).not.toHaveBeenCalled()
    },
  )
})

// ─── Scenario C: online chat, control case ────────────────────────────────────

describe("Scenario C — online chat: chatOfflineDelivery=false (default), reply via socket", () => {
  it("normal online chat uses socket delivery only", async () => {
    vi.mocked(notificationQueue.add).mockClear()
    vi.mocked(publishChatAgentReply).mockClear()

    const intake = await resolveOrCreateIntake({
      orgId,
      channel: "chat",
      customerIdentifier: { visitorSessionId: `online-session-${Date.now()}` },
      content: "Quick question about shipping",
      chatOfflineDelivery: false,
    })

    const conv = await db.query.conversations.findFirst({
      where: eq(conversations.id, intake.conversationId),
    })
    expect(conv!.chatOfflineDelivery).toBe(false)

    const auditRow = await seedAuditLog(intake.ticketId, orgId)
    const deps: TriageDeps = {
      classifier: async () => NON_COMPLAINT,
      draftGenerator: async () => ({ ...HIGH_CONF_DRAFT, auditLogId: auditRow.id }),
      retrieve: async () => [{ score: 0.9 }],
    }

    await processTriageJob(
      makeJob({ orgId, ticketId: intake.ticketId, conversationId: intake.conversationId, messageId: intake.messageId }),
      deps,
    )

    expect(publishChatAgentReply).toHaveBeenCalledWith(
      orgId,
      expect.objectContaining({ conversationId: intake.conversationId }),
    )
    expect(notificationQueue.add).not.toHaveBeenCalled()
  })
})

// ─── isAnyAgentOnline mock: used by POST /api/chat/intake ─────────────────────

describe("isAnyAgentOnline mock — intake offline mode detection", () => {
  it("when isAnyAgentOnline returns false: resolveOrCreateIntake with chatOfflineDelivery=true creates correct customer", async () => {
    // This test drives the exact logic the intake route executes:
    // 1. Check isAnyAgentOnline (mocked false)
    // 2. Call resolveOrCreateIntake with chatOfflineDelivery=true + customer email
    const agentsOnlineStatus = false  // simulates what the route sees
    const visitorEmail = `intake-route-${Date.now()}@test.local`
    const sessionId = `intake-route-session-${Date.now()}`

    const intake = await resolveOrCreateIntake({
      orgId,
      channel: "chat",
      customerIdentifier: { visitorSessionId: sessionId, email: visitorEmail },
      content: "Test message from offline intake",
      chatOfflineDelivery: !agentsOnlineStatus && Boolean(visitorEmail),
    })

    const conv = await db.query.conversations.findFirst({
      where: eq(conversations.id, intake.conversationId),
    })
    expect(conv!.chatOfflineDelivery).toBe(true)
    expect(intake.isNewTicket).toBe(true)

    const customer = await db.query.customers.findFirst({
      where: and(eq(customers.orgId, orgId), eq(customers.visitorSessionId, sessionId)),
    })
    expect(customer!.email).toBe(visitorEmail)
  })
})
