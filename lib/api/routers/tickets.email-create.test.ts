import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { and, eq } from "drizzle-orm"
import { appRouter } from "@/lib/api/root"
import { db } from "@/lib/db"
import { conversations, customers, organizations, tickets, users } from "@/lib/db/schema"

vi.mock("@/lib/queue/queues", () => ({
  notificationQueue: {
    add: vi.fn(),
  },
  embeddingQueue: {
    add: vi.fn(),
  },
}))

describe("tickets.create email validation", () => {
  let orgId: string
  let userId: string
  let customerNoEmailId: string

  const caller = () =>
    appRouter.createCaller({
      user: { id: userId, orgId, role: "admin" },
    })

  beforeAll(async () => {
    const slug = `email-ticket-create-test-${Date.now()}`
    const [org] = await db
      .insert(organizations)
      .values({ name: "Email Ticket Create Test Org", slug })
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

    const [customer] = await db
      .insert(customers)
      .values({
        orgId,
        email: "",
        name: "No Email Customer",
      })
      .returning()
    customerNoEmailId = customer.id
  })

  afterAll(async () => {
    if (!orgId) return
    await db.delete(conversations).where(eq(conversations.orgId, orgId))
    await db.delete(tickets).where(eq(tickets.orgId, orgId))
    await db.delete(customers).where(eq(customers.orgId, orgId))
    await db.delete(users).where(eq(users.orgId, orgId))
    await db.delete(organizations).where(eq(organizations.id, orgId))
  })

  it("rejects email-channel tickets without a customer", async () => {
    const subject = "Email ticket without customer"

    await expect(
      caller().tickets.create({
        subject,
        channel: "email",
        priority: "medium",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Email tickets require a customer with a valid email address.",
    })

    const created = await db.query.tickets.findFirst({
      where: and(eq(tickets.orgId, orgId), eq(tickets.subject, subject)),
    })
    expect(created).toBeUndefined()
  })

  it("rejects email-channel tickets when the selected customer has no email", async () => {
    const subject = "Email ticket without customer email"

    await expect(
      caller().tickets.create({
        subject,
        channel: "email",
        priority: "medium",
        customerId: customerNoEmailId,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Email tickets require a customer with a valid email address.",
    })

    const created = await db.query.tickets.findFirst({
      where: and(eq(tickets.orgId, orgId), eq(tickets.subject, subject)),
    })
    expect(created).toBeUndefined()
  })
})
