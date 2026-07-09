/**
 * Integration tests: chat as a first-class pipeline channel.
 *
 * Verifies that:
 *   1. resolveOrCreateIntake enqueues the exact same CopilotTriageJob shape
 *      for chat as it does for email — the triage worker must be channel-agnostic.
 *   2. rapid-fire chat messages from the same visitor session thread into the
 *      same ticket/conversation rather than creating two separate tickets.
 *   3. A high-confidence non-complaint chat message results in both an auditLogs
 *      row (source="auto_triage") AND a publishChatAgentReply call with the
 *      correct conversationId and content — verifying the centralized delivery
 *      hook in insertAgentMessage covers the auto-triage path.
 *   4. An email message in the same org does NOT trigger publishChatAgentReply —
 *      confirming channel isolation at the insertAgentMessage level.
 *
 * Real PostgreSQL DB, mocked Redis / event-bus.
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
}))

import { copilotTriageQueue } from "@/lib/queue/queues"
import { publishChatAgentReply } from "@/lib/realtime/event-bus"
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

const DRAFT_TEXT = "Our store is open Monday–Friday 9 am–6 pm."

const HIGH_CONF_DRAFT: DraftResult = {
  finalText: DRAFT_TEXT,
  confidence: 93,
  auditLogId: "", // filled per test
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
      input: "seed input",
      output: "seed output",
      metadata: { confidence: 90, citations: [], policyChecks: [], latencyMs: 100, model: "test" },
    })
    .returning()
  return row
}

// ─── Shared org fixture ───────────────────────────────────────────────────────

let orgId: string

beforeAll(async () => {
  const slug = `chat-channel-test-${Date.now()}`
  const [org] = await db.insert(organizations).values({ name: "Chat Channel Test Org", slug }).returning()
  orgId = org.id
})

afterAll(async () => {
  if (!orgId) return
  // Clean up in FK-safe order.
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

// ─── Test 1: same job shape for chat and email ────────────────────────────────

describe("resolveOrCreateIntake — job shape", () => {
  it("enqueues the exact same CopilotTriageJob fields for chat as for email", async () => {
    vi.mocked(copilotTriageQueue.add).mockClear()

    // Email intake
    const emailResult = await resolveOrCreateIntake({
      orgId,
      channel: "email",
      customerIdentifier: { email: `email-job-test-${Date.now()}@test.local` },
      content: "Hello from email",
    })

    const emailCall = vi.mocked(copilotTriageQueue.add).mock.calls[0]
    expect(emailCall).toBeDefined()
    const [emailJobName, emailJobData, emailJobOpts] = emailCall!
    expect(emailJobName).toMatch(/^triage-/)
    expect(emailJobData).toMatchObject({
      orgId,
      ticketId: emailResult.ticketId,
      conversationId: emailResult.conversationId,
      messageId: emailResult.messageId,
    })
    expect(emailJobOpts).toMatchObject({ jobId: `triage-${emailResult.messageId}` })

    vi.mocked(copilotTriageQueue.add).mockClear()

    // Chat intake
    const chatResult = await resolveOrCreateIntake({
      orgId,
      channel: "chat",
      customerIdentifier: { visitorSessionId: `session-job-test-${Date.now()}` },
      content: "Hello from chat",
    })

    const chatCall = vi.mocked(copilotTriageQueue.add).mock.calls[0]
    expect(chatCall).toBeDefined()
    const [chatJobName, chatJobData, chatJobOpts] = chatCall!

    // Job name format must match email path.
    expect(chatJobName).toMatch(/^triage-/)

    // Job payload must carry the same four fields.
    expect(chatJobData).toMatchObject({
      orgId,
      ticketId: chatResult.ticketId,
      conversationId: chatResult.conversationId,
      messageId: chatResult.messageId,
    })
    expect(chatJobOpts).toMatchObject({ jobId: `triage-${chatResult.messageId}` })

    // Structural parity: both job objects have the same keys.
    expect(Object.keys(chatJobData as object).sort()).toEqual(
      Object.keys(emailJobData as object).sort()
    )
  })
})

// ─── Test 2: rapid-fire idempotency ──────────────────────────────────────────

describe("resolveOrCreateIntake — rapid-fire chat messages", () => {
  it("threads both messages into the same ticket when same visitorSessionId is used", async () => {
    const sessionId = `rapid-fire-${Date.now()}`

    const first = await resolveOrCreateIntake({
      orgId,
      channel: "chat",
      customerIdentifier: { visitorSessionId: sessionId },
      content: "First message — visitor opens chat",
    })

    const second = await resolveOrCreateIntake({
      orgId,
      channel: "chat",
      customerIdentifier: { visitorSessionId: sessionId },
      content: "Second message — visitor types immediately after",
    })

    // Both messages must land in the same ticket and conversation.
    expect(second.ticketId).toBe(first.ticketId)
    expect(second.conversationId).toBe(first.conversationId)
    // Each call inserts a distinct message row.
    expect(second.messageId).not.toBe(first.messageId)
    // Only the first call creates a new ticket.
    expect(first.isNewTicket).toBe(true)
    expect(second.isNewTicket).toBe(false)
  })

  it("stamps visitorSessionId on the newly created conversation for socket reconnect", async () => {
    const sessionId = `reconnect-session-${Date.now()}`

    const result = await resolveOrCreateIntake({
      orgId,
      channel: "chat",
      customerIdentifier: { visitorSessionId: sessionId },
      content: "Can I reconnect to this chat?",
    })

    const conv = await db.query.conversations.findFirst({
      where: eq(conversations.id, result.conversationId),
    })
    expect(conv!.visitorSessionId).toBe(sessionId)
  })
})

// ─── Test 3: socket emit via insertAgentMessage ───────────────────────────────

describe("processTriageJob (chat) — auditLogs row + publishChatAgentReply", () => {
  it(
    "auto-send path writes auditLogs row AND calls publishChatAgentReply with correct conversationId and content",
    async () => {
      vi.mocked(publishChatAgentReply).mockClear()

      // Create a chat intake so we have a real DB ticket + conversation + message.
      const sessionId = `triage-session-${Date.now()}`
      const intake = await resolveOrCreateIntake({
        orgId,
        channel: "chat",
        customerIdentifier: { visitorSessionId: sessionId },
        content: "What are your opening hours?",
      })

      // Seed an audit log (normally created by the SuggestionService).
      const auditRow = await seedAuditLog(intake.ticketId, orgId)

      const deps: TriageDeps = {
        classifier: async () => NON_COMPLAINT,
        draftGenerator: async () => ({ ...HIGH_CONF_DRAFT, auditLogId: auditRow.id }),
      }

      await processTriageJob(
        makeJob({
          orgId,
          ticketId: intake.ticketId,
          conversationId: intake.conversationId,
          messageId: intake.messageId,
        }),
        deps,
      )

      // ── auditLogs row stamped with source=auto_triage ─────────────────────
      const updatedAudit = await db.query.auditLogs.findFirst({
        where: eq(auditLogs.id, auditRow.id),
      })
      expect(updatedAudit).toBeTruthy()
      expect(updatedAudit!.metadata.source).toBe("auto_triage")
      expect(updatedAudit!.metadata.complaintClassification?.isComplaint).toBe(false)

      // ── agent message inserted ────────────────────────────────────────────
      const agentMsgs = await db
        .select()
        .from(messages)
        .where(
          and(eq(messages.conversationId, intake.conversationId), eq(messages.role, "agent")),
        )
      expect(agentMsgs.length).toBeGreaterThanOrEqual(1)
      expect(agentMsgs[agentMsgs.length - 1].content).toBe(DRAFT_TEXT)

      // ── publishChatAgentReply called via insertAgentMessage ───────────────
      // This verifies the centralized delivery hook: the triage worker does NOT
      // call publishChatAgentReply directly — insertAgentMessage does it for all
      // agent messages on chat conversations, covering both auto-triage and
      // human agent paths.
      expect(publishChatAgentReply).toHaveBeenCalledTimes(1)
      expect(publishChatAgentReply).toHaveBeenCalledWith(
        orgId,
        expect.objectContaining({
          conversationId: intake.conversationId,
          content: DRAFT_TEXT,
          messageId: expect.any(String),
        }),
      )
    },
  )

  it("email channel auto-send does NOT call publishChatAgentReply", async () => {
    vi.mocked(publishChatAgentReply).mockClear()

    const emailCustomer = await db
      .insert(customers)
      .values({ orgId, email: `email-nochat-${Date.now()}@test.local` })
      .returning()
      .then((r) => r[0])

    const emailTicket = await db
      .insert(tickets)
      .values({ orgId, customerId: emailCustomer.id, subject: "Email test ticket", channel: "email" })
      .returning()
      .then((r) => r[0])

    const emailConv = await db
      .insert(conversations)
      .values({ orgId, ticketId: emailTicket.id, channel: "email", customerId: emailCustomer.id })
      .returning()
      .then((r) => r[0])

    const emailMsg = await db
      .insert(messages)
      .values({ conversationId: emailConv.id, role: "user", content: "Email question" })
      .returning()
      .then((r) => r[0])

    const auditRow = await seedAuditLog(emailTicket.id, orgId)

    const deps: TriageDeps = {
      classifier: async () => NON_COMPLAINT,
      draftGenerator: async () => ({ ...HIGH_CONF_DRAFT, auditLogId: auditRow.id }),
    }

    await processTriageJob(
      makeJob({
        orgId,
        ticketId: emailTicket.id,
        conversationId: emailConv.id,
        messageId: emailMsg.id,
      }),
      deps,
    )

    // Email conversations must never trigger the chat realtime event.
    expect(publishChatAgentReply).not.toHaveBeenCalled()
  })
})
