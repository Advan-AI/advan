import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"
import { eq } from "drizzle-orm"
import { appRouter } from "@/lib/api/root"
import { db } from "@/lib/db"
import { organizations, users, knowledgeSources, workflows } from "@/lib/db/schema"
import { TRPCError } from "@trpc/server"

vi.mock("@/lib/queue/queues", () => ({
  notificationQueue: { add: vi.fn() },
  embeddingQueue: { add: vi.fn() },
  hitlQueue: { add: vi.fn() },
}))

describe("Graceful Degradation for Billing Inactive states", () => {
  let orgId: string
  let userId: string
  let createdSourceId: string | null = null
  let createdWorkflowId: string | null = null

  const getCaller = () =>
    appRouter.createCaller({
      user: { id: userId, orgId, role: "admin" },
    })

  beforeEach(async () => {
    // 1. Create a test organization and user
    const slug = `degradation-test-${Date.now()}`
    const [org] = await db
      .insert(organizations)
      .values({
        name: "Degradation Org",
        slug,
        subscriptionStatus: "active", // start as active
      })
      .returning()
    orgId = org.id

    const [user] = await db
      .insert(users)
      .values({
        orgId,
        email: `admin@${slug}.local`,
        name: "Admin User",
        role: "admin",
      })
      .returning()
    userId = user.id
  })

  afterEach(async () => {
    // Clean up created resources
    if (createdSourceId) {
      await db.delete(knowledgeSources).where(eq(knowledgeSources.id, createdSourceId))
      createdSourceId = null
    }
    if (createdWorkflowId) {
      await db.delete(workflows).where(eq(workflows.id, createdWorkflowId))
      createdWorkflowId = null
    }
    await db.delete(users).where(eq(users.id, userId))
    await db.delete(organizations).where(eq(organizations.id, orgId))
  })

  describe("when subscriptionStatus is 'active'", () => {
    it("permits reads and writes normally for knowledge and workflows", async () => {
      const caller = getCaller()

      // 1. Write KB
      const source = await caller.knowledge.add({
        title: "Test Guide",
        content: "Some rich test guide content here.",
        sourceType: "document",
      })
      expect(source.id).toBeDefined()
      createdSourceId = source.id

      // 2. Read KB
      const list = await caller.knowledge.list({})
      expect(list.length).toBeGreaterThanOrEqual(1)

      // 3. Write Workflow
      const workflow = await caller.orchestration.saveWorkflow({
        name: "Test Flow",
        description: "Degradation verification workflow",
        definition: {
          schemaVersion: 1,
          nodes: [],
          edges: [],
        },
      })
      expect(workflow.id).toBeDefined()
      createdWorkflowId = workflow.id

      // 4. Read Workflows
      const workflowsList = await caller.orchestration.getWorkflows()
      expect(workflowsList.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe("when subscriptionStatus is 'past_due' (graceful degradation)", () => {
    beforeEach(async () => {
      // Set the subscription status to past_due
      await db
        .update(organizations)
        .set({ subscriptionStatus: "past_due" })
        .where(eq(organizations.id, orgId))
    })

    it("allows reads but blocks write mutations with FORBIDDEN errors for knowledge base", async () => {
      const caller = getCaller()

      // 1. Reads should succeed (Graceful degradation!)
      const list = await caller.knowledge.list({})
      expect(list).toBeDefined()

      // 2. Writes should fail with FORBIDDEN TRPC Error
      await expect(
        caller.knowledge.add({
          title: "Locked Guide",
          content: "This content should never be saved.",
          sourceType: "document",
        })
      ).rejects.toThrowError(/Billing subscription is past due or canceled/)

      // 3. Updates should fail
      await expect(
        caller.knowledge.update({
          id: "00000000-0000-0000-0000-000000000000",
          title: "New Title",
          content: "New Content",
          sourceType: "document",
        })
      ).rejects.toThrowError(/Billing subscription is past due or canceled/)

      // 4. Deletes should fail
      await expect(
        caller.knowledge.delete({
          id: "00000000-0000-0000-0000-000000000000",
        })
      ).rejects.toThrowError(/Billing subscription is past due or canceled/)
    })

    it("allows reads but blocks write mutations with FORBIDDEN errors for workflows", async () => {
      const caller = getCaller()

      // 1. Reads should succeed (Graceful degradation!)
      const list = await caller.orchestration.getWorkflows()
      expect(list).toBeDefined()

      // 2. Writes should fail with FORBIDDEN TRPC Error
      await expect(
        caller.orchestration.saveWorkflow({
          name: "Locked Flow",
          definition: {
            schemaVersion: 1,
            nodes: [],
            edges: [],
          },
        })
      ).rejects.toThrowError(/Billing subscription is past due or canceled/)

      // 3. Activation should fail
      await expect(
        caller.orchestration.setWorkflowActive({
          id: "00000000-0000-0000-0000-000000000000",
          isActive: true,
        })
      ).rejects.toThrowError(/Billing subscription is past due or canceled/)

      // 4. Deletes should fail
      await expect(
        caller.orchestration.deleteWorkflow({
          id: "00000000-0000-0000-0000-000000000000",
        })
      ).rejects.toThrowError(/Billing subscription is past due or canceled/)
    })
  })

  describe("when subscriptionStatus is 'canceled' (graceful degradation)", () => {
    beforeEach(async () => {
      // Set the subscription status to canceled
      await db
        .update(organizations)
        .set({ subscriptionStatus: "canceled" })
        .where(eq(organizations.id, orgId))
    })

    it("blocks writes completely for canceled workspaces", async () => {
      const caller = getCaller()

      await expect(
        caller.knowledge.add({
          title: "Locked Guide",
          content: "This content should never be saved.",
          sourceType: "document",
        })
      ).rejects.toThrowError(/Billing subscription is past due or canceled/)

      await expect(
        caller.orchestration.saveWorkflow({
          name: "Locked Flow",
          definition: {
            schemaVersion: 1,
            nodes: [],
            edges: [],
          },
        })
      ).rejects.toThrowError(/Billing subscription is past due or canceled/)
    })
  })
})
