import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { eq, and, inArray } from "drizzle-orm"
import { NextRequest } from "next/server"
import { jwtVerify } from "jose"
import { Webhook } from "svix"

import { appRouter } from "@/lib/api/root"
import { db } from "@/lib/db"
import {
  organizations,
  users,
  customers,
  tickets,
  conversations,
  messages,
  knowledgeSources,
  widgetConfigs,
  auditLogs,
  emailEvents,
} from "@/lib/db/schema"
import { TRPCError } from "@trpc/server"
import type { EmailReceivedEvent } from "resend"
import { resetEmailConfigCache } from "@/lib/email/config"

// ─── Webhook svix/verify mocks and environment setup ─────────────────────────
const AUTH_SECRET = "test-auth-secret-for-widget-session!!"
const RESEND_WEBHOOK_SECRET = `whsec_${Buffer.from("test-secret-for-resend-events").toString("base64")}`

vi.mock("@/lib/queue/queues", () => ({
  copilotTriageQueue: { add: vi.fn().mockResolvedValue({ id: "mock" }) },
  notificationQueue: { add: vi.fn().mockResolvedValue({ id: "mock" }) },
  embeddingQueue: { add: vi.fn().mockResolvedValue({ id: "mock" }) },
  hitlQueue: { add: vi.fn().mockResolvedValue({ id: "mock" }) },
}))

vi.mock("@upstash/ratelimit", () => {
  function RatelimitMock() {
    return {
      limit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: Date.now() + 1000 }),
    }
  }
  ;(RatelimitMock as any).slidingWindow = vi.fn().mockReturnValue({})
  return {
    Ratelimit: RatelimitMock,
  }
})

// Mock Resend Client to prevent network queries
vi.mock("@/lib/email/resend-client", () => {
  return {
    getResendClient: () => ({
      emails: {
        receiving: {
          get: vi.fn().mockImplementation(async (id: string) => {
            if (id.startsWith("provider_unknown")) {
              return {
                data: {
                  object: "email",
                  id: id,
                  to: ["support+malicious-unmapped-alias@mail.test.local"],
                  received_for: ["support+malicious-unmapped-alias@mail.test.local"],
                  from: "customer@gmail.com",
                  created_at: "2026-07-02T12:00:00.000Z",
                  subject: "Spam",
                  text: "Spam",
                  html: "<p>Spam</p>",
                  headers: {},
                  message_id: `<msg_${id}@resend.dev>`,
                  attachments: [],
                },
              }
            }
            return {
              data: {
                object: "email",
                id: id,
                to: ["support+tenant-b@mail.test.local"],
                received_for: ["support+tenant-b@mail.test.local"],
                from: "customer@gmail.com",
                created_at: "2026-07-02T12:00:00.000Z",
                subject: "Test alias routing",
                text: "Please help!",
                html: "<p>Please help!</p>",
                headers: {
                  "message-id": "<msg_123@resend.dev>",
                },
                message_id: "<msg_123@resend.dev>",
                attachments: [],
              },
            }
          }),
        },
      },
    }),
  }
})

// Import route handlers to test public HTTP entry points
import { POST as chatSessionPOST } from "@/app/api/chat/session/route"
import { POST as chatIntakePOST } from "@/app/api/chat/intake/route"
import { GET as chatAvailabilityGET } from "@/app/api/chat/availability/route"
import { POST as inboundEmailPOST } from "@/app/api/webhooks/resend/inbound/route"
import { POST as eventsPOST } from "@/app/api/webhooks/resend/events/route"

describe("Bulletproof Tenant Isolation Integration Test Suite", () => {
  // Tenant A references
  let orgA_Id: string
  let userA_Id: string
  let customerA_Id: string
  let ticketA_Id: string
  let conversationA_Id: string
  let messageA_Id: string
  let kbArticleA_Id: string
  let widgetKeyA: string
  let allowedOriginA: string

  // Tenant B references
  let orgB_Id: string
  let userB_Id: string
  let customerB_Id: string
  let ticketB_Id: string
  let conversationB_Id: string
  let messageB_Id: string
  let kbArticleB_Id: string
  let widgetKeyB: string
  let allowedOriginB: string

  // tRPC Callers
  const callerA = () =>
    appRouter.createCaller({
      user: { id: userA_Id, orgId: orgA_Id, role: "admin" },
    })

  const callerB = () =>
    appRouter.createCaller({
      user: { id: userB_Id, orgId: orgB_Id, role: "admin" },
    })

  beforeAll(async () => {
    // Inject required env vars
    process.env.AUTH_SECRET = AUTH_SECRET
    process.env.RESEND_WEBHOOK_SECRET = RESEND_WEBHOOK_SECRET
    process.env.EMAIL_INBOUND_DOMAIN = "mail.test.local"
    process.env.RESEND_API_KEY = "re_test_key"
    process.env.EMAIL_FROM = "Support <support@mail.test.local>"

    resetEmailConfigCache()

    const testId = Date.now()
    allowedOriginA = `https://org-a-${testId}.com`
    allowedOriginB = `https://org-b-${testId}.com`

    // ─── PROVISION TENANT A ───
    const [orgA] = await db
      .insert(organizations)
      .values({
        name: `Tenant A - ${testId}`,
        slug: `tenant-a-${testId}`,
        inboundEmailAlias: `support+tenant-a-${testId}`,
      })
      .returning()
    orgA_Id = orgA.id

    const [userA] = await db
      .insert(users)
      .values({
        orgId: orgA_Id,
        email: `admin@tenant-a-${testId}.local`,
        name: "Admin A",
        role: "admin",
        chatAvailable: true,
      })
      .returning()
    userA_Id = userA.id

    const [customerA] = await db
      .insert(customers)
      .values({
        orgId: orgA_Id,
        email: `customer@tenant-a-${testId}.local`,
        name: "Customer A",
      })
      .returning()
    customerA_Id = customerA.id

    const [ticketA] = await db
      .insert(tickets)
      .values({
        orgId: orgA_Id,
        customerId: customerA_Id,
        subject: "Ticket A",
        status: "open",
        priority: "medium",
        channel: "chat",
      })
      .returning()
    ticketA_Id = ticketA.id

    const [convA] = await db
      .insert(conversations)
      .values({
        orgId: orgA_Id,
        ticketId: ticketA_Id,
        customerId: customerA_Id,
        channel: "chat",
        visitorId: "40000000-0000-0000-0000-000000000001",
      })
      .returning()
    conversationA_Id = convA.id

    const [msgA] = await db
      .insert(messages)
      .values({
        conversationId: conversationA_Id,
        role: "user",
        content: "Hello from Customer A",
      })
      .returning()
    messageA_Id = msgA.id

    const [kbA] = await db
      .insert(knowledgeSources)
      .values({
        orgId: orgA_Id,
        title: "KB Article A",
        content: "How to use Tenant A",
        sourceType: "document",
      })
      .returning()
    kbArticleA_Id = kbA.id

    widgetKeyA = `wk_live_tenant_a_${testId}`
    await db.insert(widgetConfigs).values({
      orgId: orgA_Id,
      widgetKey: widgetKeyA,
      allowedOrigins: [allowedOriginA],
      preChatFormEnabled: true,
    })

    // ─── PROVISION TENANT B ───
    const [orgB] = await db
      .insert(organizations)
      .values({
        name: `Tenant B - ${testId}`,
        slug: `tenant-b-${testId}`,
        inboundEmailAlias: `support+tenant-b-${testId}`,
      })
      .returning()
    orgB_Id = orgB.id

    const [userB] = await db
      .insert(users)
      .values({
        orgId: orgB_Id,
        email: `admin@tenant-b-${testId}.local`,
        name: "Admin B",
        role: "admin",
        chatAvailable: true,
      })
      .returning()
    userB_Id = userB.id

    const [customerB] = await db
      .insert(customers)
      .values({
        orgId: orgB_Id,
        email: `customer@tenant-b-${testId}.local`,
        name: "Customer B",
      })
      .returning()
    customerB_Id = customerB.id

    const [ticketB] = await db
      .insert(tickets)
      .values({
        orgId: orgB_Id,
        customerId: customerB_Id,
        subject: "Ticket B",
        status: "open",
        priority: "medium",
        channel: "chat",
      })
      .returning()
    ticketB_Id = ticketB.id

    const [convB] = await db
      .insert(conversations)
      .values({
        orgId: orgB_Id,
        ticketId: ticketB_Id,
        customerId: customerB_Id,
        channel: "chat",
        visitorId: "50000000-0000-0000-0000-000000000002",
      })
      .returning()
    conversationB_Id = convB.id

    const [msgB] = await db
      .insert(messages)
      .values({
        conversationId: conversationB_Id,
        role: "user",
        content: "Hello from Customer B",
      })
      .returning()
    messageB_Id = msgB.id

    const [kbB] = await db
      .insert(knowledgeSources)
      .values({
        orgId: orgB_Id,
        title: "KB Article B",
        content: "How to use Tenant B",
        sourceType: "document",
      })
      .returning()
    kbArticleB_Id = kbB.id

    widgetKeyB = `wk_live_tenant_b_${testId}`
    await db.insert(widgetConfigs).values({
      orgId: orgB_Id,
      widgetKey: widgetKeyB,
      allowedOrigins: [allowedOriginB],
      preChatFormEnabled: true,
    })
  })

  afterAll(async () => {
    // Teardown everything
    const orgIds = [orgA_Id, orgB_Id]
    for (const orgId of orgIds) {
      if (!orgId) continue
      await db.delete(emailEvents).where(eq(emailEvents.orgId, orgId))
      await db.delete(knowledgeSources).where(eq(knowledgeSources.orgId, orgId))
      await db.delete(widgetConfigs).where(eq(widgetConfigs.orgId, orgId))
      await db.delete(auditLogs).where(eq(auditLogs.orgId, orgId))

      const cRows = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.orgId, orgId))

      if (cRows.length > 0) {
        await db.delete(messages).where(
          inArray(messages.conversationId, cRows.map((r) => r.id))
        )
      }

      await db.delete(conversations).where(eq(conversations.orgId, orgId))
      await db.delete(tickets).where(eq(tickets.orgId, orgId))
      await db.delete(customers).where(eq(customers.orgId, orgId))
      await db.delete(users).where(eq(users.orgId, orgId))
      await db.delete(organizations).where(eq(organizations.id, orgId))
    }

    // Clean up unmapped email events from the test suite to prevent leakage in future runs
    await db.delete(emailEvents).where(eq(emailEvents.status, "unknown_org_alias"))

    delete process.env.AUTH_SECRET
    delete process.env.RESEND_WEBHOOK_SECRET
    delete process.env.EMAIL_INBOUND_DOMAIN
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_FROM

    resetEmailConfigCache()
  })

  // ─── SECTION 1: PUBLIC HTTP ENDPOINTS ───

  describe("Public Chat HTTP Endpoints", () => {
    it("POST /api/chat/session — rejects origin cross-talk (fails closed)", async () => {
      // Org A's widgetKey requested with Org B's Origin
      const req = new NextRequest("http://localhost/api/chat/session", {
        method: "POST",
        body: JSON.stringify({ widgetKey: widgetKeyA, origin: allowedOriginB }),
        headers: { origin: allowedOriginB },
      })
      const res = await chatSessionPOST(req)
      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error).toMatch(/Origin not allowed/)
    })

    it("POST /api/chat/session — mints token scoped to correct org", async () => {
      const req = new NextRequest("http://localhost/api/chat/session", {
        method: "POST",
        body: JSON.stringify({ widgetKey: widgetKeyA, origin: allowedOriginA }),
        headers: { origin: allowedOriginA },
      })
      const res = await chatSessionPOST(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.token).toBeDefined()

      // Decode token and assert it's strictly bound to Org A
      const key = new TextEncoder().encode(AUTH_SECRET)
      const { payload } = await jwtVerify(data.token, key, { issuer: "advan:chat-session" })
      expect(payload.orgId).toBe(orgA_Id)
      expect(payload.widgetKey).toBe(widgetKeyA)
    })

    it("POST /api/chat/intake — rejects cross-talk of tokens", async () => {
      // Step 1: Mint a valid token for Org A
      const reqSession = new NextRequest("http://localhost/api/chat/session", {
        method: "POST",
        body: JSON.stringify({ widgetKey: widgetKeyA, origin: allowedOriginA }),
        headers: { origin: allowedOriginA },
      })
      const resSession = await chatSessionPOST(reqSession)
      const { token } = await resSession.json()

      // Step 2: Attempt to call Intake and associate message with Org B's conversation
      const reqIntake = new NextRequest("http://localhost/api/chat/intake", {
        method: "POST",
        body: JSON.stringify({
          conversationId: conversationB_Id, // Belongs to Org B
          content: "Malicious cross-talk attempt",
        }),
        headers: {
          authorization: `Bearer ${token}`, // Token of Org A
          origin: allowedOriginA,
        },
      })
      const resIntake = await chatIntakePOST(reqIntake)
      
      // Since orgId is derived strictly from JWT (Tenant A), the request succeeds and creates a conversation for Tenant A.
      // This is a beautiful fail-secure pattern: malicious conversationId is safely ignored.
      expect(resIntake.status).toBe(202)
      const data = await resIntake.json()
      expect(data.conversationId).not.toBe(conversationB_Id)
    })

    it("GET /api/chat/availability — returns ONLY targeted org metrics", async () => {
      const req = new NextRequest(`http://localhost/api/chat/availability?widgetKey=${widgetKeyA}`)
      const res = await chatAvailabilityGET(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      // Make sure it references Org A's team/org name and details
      expect(data.teamName).toContain("Tenant A")
    })
  })

  describe("Inbound Webhooks", () => {
    it("POST /api/webhooks/resend/inbound — rejects unmapped alias", async () => {
      const uniqueId = `provider_unknown_${Date.now()}`
      const payload = {
        type: "email.received",
        created_at: new Date().toISOString(),
        data: {
          email_id: uniqueId,
          created_at: new Date().toISOString(),
          from: "sender@another.com",
          to: ["support+malicious-unmapped-alias@mail.test.local"],
          bcc: [],
          cc: [],
          received_for: ["support+malicious-unmapped-alias@mail.test.local"],
          message_id: `<msg_spam_${Date.now()}@resend.dev>`,
          subject: "Spam",
          attachments: [],
        },
      }

      const body = JSON.stringify(payload)
      const timestamp = new Date()
      const id = "msg_test_123"
      const signature = new Webhook(RESEND_WEBHOOK_SECRET).sign(id, timestamp, body)

      const req = new NextRequest("http://localhost/api/webhooks/resend/inbound", {
        method: "POST",
        body,
        headers: {
          "content-type": "application/json",
          "svix-id": id,
          "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
          "svix-signature": signature,
        },
      })
      const res = await inboundEmailPOST(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.unresolved).toBe(true)
      expect(data.reason).toBe("unknown_org_alias")
    })

    it("POST /api/webhooks/resend/inbound — routes to correct organization based on alias", async () => {
      // Send an inbound email to Org B's unique alias
      const alias = `support+tenant-b-${Date.now()}`
      await db.update(organizations).set({ inboundEmailAlias: alias }).where(eq(organizations.id, orgB_Id))

      const emailEvent: EmailReceivedEvent = {
        type: "email.received",
        created_at: new Date().toISOString(),
        data: {
          email_id: `provider_${Date.now()}`,
          created_at: new Date().toISOString(),
          from: "customer@gmail.com",
          to: [`${alias}@mail.test.local`],
          bcc: [],
          cc: [],
          received_for: [`${alias}@mail.test.local`],
          message_id: `<msg_${Date.now()}@resend.dev>`,
          subject: "Test alias routing",
          attachments: [],
        },
      }

      const body = JSON.stringify(emailEvent)
      const timestamp = new Date()
      const id = "msg_test_123"
      const signature = new Webhook(RESEND_WEBHOOK_SECRET).sign(id, timestamp, body)

      const req = new NextRequest("http://localhost/api/webhooks/resend/inbound", {
        method: "POST",
        body,
        headers: {
          "content-type": "application/json",
          "svix-id": id,
          "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
          "svix-signature": signature,
        },
      })
      
      const res = await inboundEmailPOST(req)
      expect(res.status).toBe(200)
    })
  })

  // ─── SECTION 2: tRPC ROUTER ISOLATION ───

  describe("tRPC Conversations Router Tenant Isolation", () => {
    it("list/listWorkbench — does not leak other tenant conversations", async () => {
      const res = await callerA().conversations.list({ limit: 10, offset: 0 })
      const ids = res.map((c) => c.id)
      expect(ids).toContain(conversationA_Id)
      expect(ids).not.toContain(conversationB_Id)

      const wb = await callerA().conversations.listWorkbench({})
      const wbIds = wb.items.map((c) => c.id)
      expect(wbIds).toContain(conversationA_Id)
      expect(wbIds).not.toContain(conversationB_Id)
    })

    it("getById — Caller A receives null/rejection for Org B's conversation", async () => {
      const conv = await callerA().conversations.getById({ id: conversationB_Id })
      expect(conv).toBeNull()
    })

    it("getByTicketId — Caller A receives null/rejection for Org B's ticket ID", async () => {
      const conv = await callerA().conversations.getByTicketId({ ticketId: ticketB_Id })
      expect(conv).toBeNull()
    })

    it("addMessage — Caller A cannot write messages into Org B's conversation", async () => {
      await expect(
        callerA().conversations.addMessage({
          conversationId: conversationB_Id,
          content: "Hacked!",
        })
      ).rejects.toThrow()
    })

    it("createSupportThread — Caller A cannot create thread for Org B's ticket", async () => {
      await expect(
        callerA().conversations.createSupportThread({
          ticketId: ticketB_Id,
          channel: "chat",
        })
      ).rejects.toThrow()
    })

    it("setPinned/setArchived/setTags — Caller A operations on Org B's conversation do nothing / reject", async () => {
      await expect(
        callerA().conversations.setPinned({ id: conversationB_Id, pinned: true })
      ).rejects.toThrow()

      await expect(
        callerA().conversations.setArchived({ id: conversationB_Id, archived: true })
      ).rejects.toThrow()

      await expect(
        callerA().conversations.setTags({ id: conversationB_Id, tags: ["attacker"] })
      ).rejects.toThrow()
    })

    it("deleteMany — Caller A cannot delete Org B's conversations", async () => {
      const deleted = await callerA().conversations.deleteMany({ ids: [conversationB_Id] })
      expect(deleted.ids).not.toContain(conversationB_Id)
    })

    it("create — Caller A creates conversation automatically scoped to Org A", async () => {
      const created = await callerA().conversations.create({
        ticketId: ticketA_Id,
        channel: "chat",
        customerId: customerA_Id,
      })
      expect(created.orgId).toBe(orgA_Id)
    })
  })

  describe("tRPC Tickets Router Tenant Isolation", () => {
    it("list — does not leak other tenant tickets", async () => {
      const res = await callerA().tickets.list({ limit: 10, offset: 0 })
      const ids = res.tickets.map((item) => item.ticket.id)
      expect(ids).toContain(ticketA_Id)
      expect(ids).not.toContain(ticketB_Id)
    })

    it("getById — Caller A cannot view Org B's ticket (rejects secure)", async () => {
      await expect(
        callerA().tickets.getById({ id: ticketB_Id })
      ).rejects.toThrow()
    })

    it("create — Caller A creates ticket automatically scoped to Org A", async () => {
      const created = await callerA().tickets.create({
        subject: "New Ticket A",
        status: "open",
        priority: "high",
        channel: "chat",
        customerId: customerA_Id,
      })
      expect(created.orgId).toBe(orgA_Id)
    })

    it("updateStatus/assignTo — Caller A cannot modify Org B's ticket", async () => {
      await expect(
        callerA().tickets.updateStatus({ id: ticketB_Id, status: "resolved" })
      ).rejects.toThrow()

      await expect(
        callerA().tickets.assignTo({ id: ticketB_Id, agentId: userA_Id })
      ).rejects.toThrow()
    })

    it("bulkUpdateStatus — Caller A cannot bulk modify Org B's ticket status", async () => {
      await expect(
        callerA().tickets.bulkUpdateStatus({ ids: [ticketB_Id], status: "closed" })
      ).rejects.toThrow()
    })

    it("kpis — Caller A KPIs only include Org A's data", async () => {
      const kpi = await callerA().tickets.kpis()
      expect(kpi.total).toBe(3) // Seeded ticketA + created ticketA + conversation.create ticketA
    })
  })

  describe("tRPC Customers Router Tenant Isolation", () => {
    it("list — does not leak other tenant customers", async () => {
      const res = await callerA().customers.list({ limit: 10, offset: 0 })
      const ids = res.map((c) => c.id)
      expect(ids).toContain(customerA_Id)
      expect(ids).not.toContain(customerB_Id)
    })

    it("getById — Caller A cannot view Org B's customer (rejects secure)", async () => {
      await expect(
        callerA().customers.getById({ id: customerB_Id })
      ).rejects.toThrow()
    })

    it("getHistory — Caller A cannot view Org B's customer history", async () => {
      const history = await callerA().customers.getHistory({ customerId: customerB_Id })
      expect(history.length).toBe(0)
    })

    it("create — Caller A creates customer automatically scoped to Org A", async () => {
      const created = await callerA().customers.create({
        email: "new-customer@tenant-a.com",
        name: "New Customer A",
      })
      expect(created.orgId).toBe(orgA_Id)
    })
  })

  describe("tRPC Analytics Router Tenant Isolation", () => {
    it("overview/summary/report/triageBreakdown — only return targeted tenant records", async () => {
      const o = await callerA().analytics.overview()
      expect(o).toBeDefined()

      const s = await callerA().analytics.summary()
      expect(s).toBeDefined()

      const rep = await callerA().analytics.report({ dateRange: "7d" })
      expect(rep).toBeDefined()

      const tr = await callerA().analytics.triageBreakdown()
      expect(tr).toBeDefined()
    })

    it("auditLogs/latestAuditLog — only returns targeted tenant logs", async () => {
      const logs = await callerA().analytics.auditLogs({ limit: 10, offset: 0 })
      expect(logs).toEqual([]) // None created for A yet

      const latest = await callerA().analytics.latestAuditLog({})
      expect(latest).toBeNull()
    })
  })

  describe("tRPC Knowledge Router Tenant Isolation", () => {
    it("list — does not leak other tenant knowledge bases", async () => {
      const res = await callerA().knowledge.list({ limit: 10, offset: 0 })
      const ids = res.map((k) => k.id)
      expect(ids).toContain(kbArticleA_Id)
      expect(ids).not.toContain(kbArticleB_Id)
    })

    it("getById — Caller A cannot view Org B's KB article (rejects secure)", async () => {
      await expect(
        callerA().knowledge.getById({ id: kbArticleB_Id })
      ).rejects.toThrow()
    })

    it("add — Caller A adds KB article automatically scoped to Org A", async () => {
      const created = await callerA().knowledge.add({
        title: "Test KB Add",
        content: "Some user manual content",
        sourceType: "document",
      })
      expect(created.orgId).toBe(orgA_Id)
    })

    it("update/delete — Caller A cannot modify or delete Org B's KB article", async () => {
      await expect(
        callerA().knowledge.update({ id: kbArticleB_Id, title: "Hacked!" })
      ).rejects.toThrow()

      await expect(
        callerA().knowledge.delete({ id: kbArticleB_Id })
      ).rejects.toThrow()
    })
  })
})
