import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { eq } from "drizzle-orm"
import { appRouter } from "@/lib/api/root"
import { db } from "@/lib/db"
import {
  conversations,
  customers,
  messages,
  organizations,
  tickets,
  users,
} from "@/lib/db/schema"

const addMock = vi.fn().mockResolvedValue({ id: "mock-job-id" })

vi.mock("@/lib/queue/queues", () => ({
  notificationQueue: {
    add: (...args: unknown[]) => addMock(...args),
  },
  embeddingQueue: {
    add: vi.fn(),
  },
}))

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: "re_mock_send" }, error: null }),
    },
  })),
}))

describe("conversations.addMessage email outbound", () => {
  let orgId: string
  let userId: string
  let customerWithEmailId: string
  let customerNoEmailId: string
  let emailConversationId: string
  let emailConversationNoCustomerEmailId: string
  let chatConversationId: string

  const caller = () =>
    appRouter.createCaller({
      user: { id: userId, orgId, role: "admin" },
    })

  beforeAll(async () => {
    process.env.RESEND_API_KEY = "re_test_integration"
    process.env.EMAIL_FROM = "Support <support@mail.example.com>"
    process.env.EMAIL_INBOUND_DOMAIN = "mail.example.com"
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test"

    const slug = `email-outbound-test-${Date.now()}`
    const [org] = await db
      .insert(organizations)
      .values({ name: "Email Outbound Test Org", slug })
      .returning()
    orgId = org.id

    const [user] = await db
      .insert(users)
      .values({
        orgId,
        email: `agent-${slug}@test.local`,
        name: "Test Agent",
        role: "admin",
      })
      .returning()
    userId = user.id

    const insertedCustomers = await db
      .insert(customers)
      .values([
        {
          orgId,
          email: "customer-with-email@test.local",
          name: "Has Email",
        },
        {
          orgId,
          email: "",
          name: "No Email",
        },
      ])
      .returning()

    customerWithEmailId = insertedCustomers[0].id
    customerNoEmailId = insertedCustomers[1].id

    const insertedTickets = await db
      .insert(tickets)
      .values([
        {
          orgId,
          customerId: customerWithEmailId,
          subject: "Email ticket",
          channel: "email",
        },
        {
          orgId,
          customerId: customerNoEmailId,
          subject: "Email ticket no address",
          channel: "email",
        },
        {
          orgId,
          customerId: customerWithEmailId,
          subject: "Chat ticket",
          channel: "chat",
        },
      ])
      .returning()

    const insertedConversations = await db
      .insert(conversations)
      .values([
        {
          orgId,
          ticketId: insertedTickets[0].id,
          channel: "email",
          customerId: customerWithEmailId,
        },
        {
          orgId,
          ticketId: insertedTickets[1].id,
          channel: "email",
          customerId: customerNoEmailId,
        },
        {
          orgId,
          ticketId: insertedTickets[2].id,
          channel: "chat",
          customerId: customerWithEmailId,
        },
      ])
      .returning()

    emailConversationId = insertedConversations[0].id
    emailConversationNoCustomerEmailId = insertedConversations[1].id
    chatConversationId = insertedConversations[2].id
  })

  beforeEach(() => {
    addMock.mockClear()
  })

  afterAll(async () => {
    await db.delete(messages).where(eq(messages.conversationId, emailConversationId))
    await db.delete(messages).where(eq(messages.conversationId, emailConversationNoCustomerEmailId))
    await db.delete(messages).where(eq(messages.conversationId, chatConversationId))
    await db.delete(conversations).where(eq(conversations.orgId, orgId))
    await db.delete(tickets).where(eq(tickets.orgId, orgId))
    await db.delete(customers).where(eq(customers.orgId, orgId))
    await db.delete(users).where(eq(users.orgId, orgId))
    await db.delete(organizations).where(eq(organizations.id, orgId))
  })

  it("enqueues agent_reply when channel=email and role=agent", async () => {
    const msg = await caller().conversations.addMessage({
      conversationId: emailConversationId,
      role: "agent",
      content: "Thanks for reaching out — we're looking into this.",
    })

    expect(msg.metadata?.email?.deliveryStatus).toBe("queued")
    expect(addMock).toHaveBeenCalledTimes(1)
    expect(addMock).toHaveBeenCalledWith(
      "agent_reply",
      {
        type: "agent_reply",
        orgId,
        conversationId: emailConversationId,
        messageId: msg.id,
      },
      { jobId: msg.id },
    )
  })

  it("does not enqueue for internal agent notes on email channel", async () => {
    const msg = await caller().conversations.addMessage({
      conversationId: emailConversationId,
      role: "agent",
      content: "Internal: escalate to billing team.",
      metadata: { isInternal: true },
    })

    expect(msg.metadata?.email).toBeUndefined()
    expect(addMock).not.toHaveBeenCalled()
  })

  it("sets deliveryStatus failed immediately when customer email is missing", async () => {
    const msg = await caller().conversations.addMessage({
      conversationId: emailConversationNoCustomerEmailId,
      role: "agent",
      content: "Hello — following up on your ticket.",
    })

    expect(msg.metadata?.email).toEqual({
      deliveryStatus: "failed",
      error: "No customer email on file",
    })
    expect(addMock).not.toHaveBeenCalled()
  })

  it("does not enqueue for non-email channels", async () => {
    const msg = await caller().conversations.addMessage({
      conversationId: chatConversationId,
      role: "agent",
      content: "Chat reply only.",
    })

    expect(msg.metadata?.email).toBeUndefined()
    expect(addMock).not.toHaveBeenCalled()
  })
})
