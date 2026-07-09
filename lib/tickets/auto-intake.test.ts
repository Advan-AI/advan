import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"

// Prevent BullMQ from trying to connect to Redis during unit tests.
vi.mock("@/lib/queue/queues", () => ({
  copilotTriageQueue: { add: vi.fn().mockResolvedValue({ id: "mock-triage-job" }) },
  notificationQueue: { add: vi.fn() },
  embeddingQueue: { add: vi.fn() },
}))

import {
  conversations,
  customers,
  messages,
  organizations,
  tickets,
} from "@/lib/db/schema"
import { resolveOrCreateIntake } from "./auto-intake"

describe("resolveOrCreateIntake", () => {
  let orgId: string
  let customerAId: string
  let customerBId: string
  let existingTicketId: string
  let existingConversationId: string

  beforeAll(async () => {
    const slug = `auto-intake-test-${Date.now()}`
    const [org] = await db
      .insert(organizations)
      .values({ name: "Auto Intake Test Org", slug })
      .returning()
    orgId = org.id

    const insertedCustomers = await db
      .insert(customers)
      .values([
        {
          orgId,
          email: "customer-a@test.local",
          name: "Customer A",
        },
        {
          orgId,
          email: "customer-b@test.local",
          name: "Customer B",
        },
      ])
      .returning()

    customerAId = insertedCustomers[0].id
    customerBId = insertedCustomers[1].id

    const [ticket] = await db
      .insert(tickets)
      .values({
        orgId,
        customerId: customerAId,
        subject: "Existing open ticket",
        channel: "email",
        status: "open",
      })
      .returning()
    existingTicketId = ticket.id

    const [conversation] = await db
      .insert(conversations)
      .values({
        orgId,
        ticketId: existingTicketId,
        channel: "email",
        customerId: customerAId,
      })
      .returning()
    existingConversationId = conversation.id
  })

  afterAll(async () => {
    if (!orgId) return
    await db.delete(conversations).where(eq(conversations.orgId, orgId))
    await db.delete(tickets).where(eq(tickets.orgId, orgId))
    await db.delete(customers).where(eq(customers.orgId, orgId))
    await db.delete(organizations).where(eq(organizations.id, orgId))
  })

  it("reuses an existing open ticket for the same customer and channel", async () => {
    const result = await resolveOrCreateIntake({
      orgId,
      channel: "email",
      customerIdentifier: { email: "CUSTOMER-A@test.local" },
      content: "Following up on the same issue",
    })

    expect(result.isNewTicket).toBe(false)
    expect(result.ticketId).toBe(existingTicketId)
    expect(result.conversationId).toBe(existingConversationId)

    const message = await db.query.messages.findFirst({
      where: eq(messages.id, result.messageId),
    })
    expect(message?.content).toBe("Following up on the same issue")
  })

  it("creates a new ticket and conversation when no open ticket exists", async () => {
    await db
      .update(tickets)
      .set({ status: "resolved" })
      .where(and(eq(tickets.orgId, orgId), eq(tickets.customerId, customerBId)))

    const result = await resolveOrCreateIntake({
      orgId,
      channel: "email",
      customerIdentifier: { email: "customer-b@test.local" },
      content: "I need help with a new issue",
    })

    expect(result.isNewTicket).toBe(true)

    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, result.ticketId),
    })
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, result.conversationId),
    })

    expect(ticket?.customerId).toBe(customerBId)
    expect(ticket?.channel).toBe("email")
    expect(conversation?.ticketId).toBe(result.ticketId)
    expect(conversation?.customerId).toBe(customerBId)
  })

  it("does not merge two different customers on the same channel", async () => {
    const resultA = await resolveOrCreateIntake({
      orgId,
      channel: "chat",
      customerIdentifier: { email: "customer-a@test.local" },
      content: "Customer A chat message",
    })

    const resultB = await resolveOrCreateIntake({
      orgId,
      channel: "chat",
      customerIdentifier: { email: "customer-b@test.local" },
      content: "Customer B chat message",
    })

    expect(resultA.ticketId).not.toBe(resultB.ticketId)
    expect(resultA.conversationId).not.toBe(resultB.conversationId)

    const ticketA = await db.query.tickets.findFirst({
      where: eq(tickets.id, resultA.ticketId),
    })
    const ticketB = await db.query.tickets.findFirst({
      where: eq(tickets.id, resultB.ticketId),
    })

    expect(ticketA?.customerId).toBe(customerAId)
    expect(ticketB?.customerId).toBe(customerBId)
  })
})
