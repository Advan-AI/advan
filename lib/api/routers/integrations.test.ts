import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { eq } from "drizzle-orm"
import { appRouter } from "@/lib/api/root"
import { db } from "@/lib/db"
import { organizations, users, widgetConfigs } from "@/lib/db/schema"
import { TRPCError } from "@trpc/server"

vi.mock("@/lib/queue/queues", () => ({
  notificationQueue: { add: vi.fn() },
  embeddingQueue: { add: vi.fn() },
  hitlQueue: { add: vi.fn() },
}))

describe("integrationsRouter tenant isolation", () => {
  let orgA_Id: string
  let userA_Id: string
  let orgB_Id: string
  let userB_Id: string
  let orgB_WidgetConfigId: string

  const callerA = () =>
    appRouter.createCaller({
      user: { id: userA_Id, orgId: orgA_Id, role: "admin" },
    })

  const callerB = () =>
    appRouter.createCaller({
      user: { id: userB_Id, orgId: orgB_Id, role: "admin" },
    })

  beforeAll(async () => {
    // Org A
    const slugA = `integration-tenant-test-a-${Date.now()}`
    const [orgA] = await db
      .insert(organizations)
      .values({ name: "Org A", slug: slugA })
      .returning()
    orgA_Id = orgA.id
    const [userA] = await db
      .insert(users)
      .values({ orgId: orgA_Id, email: `agent-${slugA}@test.local`, name: "Agent A", role: "admin" })
      .returning()
    userA_Id = userA.id

    // Org B
    const slugB = `integration-tenant-test-b-${Date.now()}`
    const [orgB] = await db
      .insert(organizations)
      .values({ name: "Org B", slug: slugB })
      .returning()
    orgB_Id = orgB.id
    const [userB] = await db
      .insert(users)
      .values({ orgId: orgB_Id, email: `agent-${slugB}@test.local`, name: "Agent B", role: "admin" })
      .returning()
    userB_Id = userB.id
  })

  afterAll(async () => {
    // Cleanup
    if (orgA_Id) {
      await db.delete(widgetConfigs).where(eq(widgetConfigs.orgId, orgA_Id))
      await db.delete(users).where(eq(users.orgId, orgA_Id))
      await db.delete(organizations).where(eq(organizations.id, orgA_Id))
    }
    if (orgB_Id) {
      await db.delete(widgetConfigs).where(eq(widgetConfigs.orgId, orgB_Id))
      await db.delete(users).where(eq(users.orgId, orgB_Id))
      await db.delete(organizations).where(eq(organizations.id, orgB_Id))
    }
  })

  it("caller B creates widget config", async () => {
    const config = await callerB().integrations.createWidgetConfig()
    expect(config.orgId).toBe(orgB_Id)
    orgB_WidgetConfigId = config.id
  })

  it("caller A cannot read caller B's widget config", async () => {
    const config = await callerA().integrations.getWidgetConfig()
    expect(config).toBeNull() // Caller A doesn't have one yet
  })

  it("caller A cannot update caller B's origins", async () => {
    // Caller A tries to update using their context
    await expect(
      callerA().integrations.updateWidgetOrigins({ allowedOrigins: ["https://hacked.com"] })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Widget config not found.",
    })

    // Verify Org B wasn't affected
    const configB = await callerB().integrations.getWidgetConfig()
    expect(configB?.allowedOrigins).not.toContain("https://hacked.com")
  })

  it("caller A cannot rotate caller B's key", async () => {
    const configB1 = await callerB().integrations.getWidgetConfig()

    await expect(callerA().integrations.rotateWidgetKey()).rejects.toMatchObject({
      code: "NOT_FOUND",
    })

    const configB2 = await callerB().integrations.getWidgetConfig()
    expect(configB2?.widgetKey).toBe(configB1?.widgetKey) // Key did not change
  })

  it("caller A cannot delete caller B's config", async () => {
    await expect(callerA().integrations.deleteWidgetConfig()).rejects.toMatchObject({
      code: "NOT_FOUND",
    })

    const configB = await callerB().integrations.getWidgetConfig()
    expect(configB).not.toBeNull()
  })

  it("caller A can create and manage its own widget config", async () => {
    const configA = await callerA().integrations.createWidgetConfig()
    expect(configA.orgId).toBe(orgA_Id)
    expect(configA.widgetKey.startsWith("wk_live_")).toBe(true)

    // Conflict
    await expect(callerA().integrations.createWidgetConfig()).rejects.toMatchObject({
      code: "CONFLICT",
    })

    // Update Origins
    const updated = await callerA().integrations.updateWidgetOrigins({ allowedOrigins: ["https://example.com"] })
    expect(updated.allowedOrigins).toEqual(["https://example.com"])

    // Rotate Key
    const rotated = await callerA().integrations.rotateWidgetKey()
    expect(rotated.widgetKey).not.toBe(configA.widgetKey)

    // Delete
    await callerA().integrations.deleteWidgetConfig()
    const checkDeleted = await callerA().integrations.getWidgetConfig()
    expect(checkDeleted).toBeNull()
  })
})
