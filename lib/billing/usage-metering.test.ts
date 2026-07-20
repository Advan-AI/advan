import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { organizations, plans, usageEvents, users } from "@/lib/db/schema"
import { stripe } from "./stripe-client"
import { assertSeatLimit } from "./subscription-service"
import { reportUsageToStripe } from "./usage-reporter"

// Mock the Stripe SDK
vi.mock("@/lib/billing/stripe-client", () => {
  return {
    stripe: {
      subscriptions: {
        retrieve: vi.fn(),
      },
      subscriptionItems: {
        createUsageRecord: vi.fn(),
      },
    },
  }
})

describe("Usage Metering, Seat Constraints and Reports", () => {
  let testOrgId: string
  let testPlanId: string
  const userIds: string[] = []

  beforeEach(async () => {
    // 1. Seed a test plan with seat limit of 2 and dynamic metered price
    const [plan] = await db
      .insert(plans)
      .values({
        key: "test_metered_pkg",
        name: "Test Metered Plan",
        seatLimit: 2,
        includedMessages: 100,
        monthlyPriceCents: 5000,
        stripePriceId: "price_flat_metered_test",
        stripeMeteredPriceId: "price_metered_test_id",
        active: true,
      })
      .returning()

    testPlanId = plan.id

    // 2. Seed a test organization
    const [org] = await db
      .insert(organizations)
      .values({
        name: "Metered Analytics Corp",
        slug: `metered-analytics-${Date.now()}`,
        stripeCustomerId: "cus_metered_test_123",
        stripeSubscriptionId: "sub_metered_test_456",
        planId: plan.id,
        subscriptionStatus: "active",
      })
      .returning()

    testOrgId = org.id

    vi.clearAllMocks()
  })

  afterEach(async () => {
    // 3. Clean up seeded records
    if (userIds.length > 0) {
      await db.delete(users).where(inArray(users.id, userIds))
      userIds.length = 0
    }
    await db.delete(organizations).where(eq(organizations.id, testOrgId))
    await db.delete(plans).where(eq(plans.id, testPlanId))
    await db.delete(usageEvents).where(eq(usageEvents.orgId, testOrgId))
  })

  describe("assertSeatLimit", () => {
    it("allows adding members within the configured seat limit bounds, and blocks once limit is reached", async () => {
      // 1 member
      const [u1] = await db
        .insert(users)
        .values({
          orgId: testOrgId,
          email: "u1@metered.test.local",
          role: "member",
        })
        .returning()
      userIds.push(u1.id)

      // With 1 member, we have NOT reached the limit of 2, so we can add more
      await expect(assertSeatLimit(testOrgId)).resolves.not.toThrow()

      // 2 members (exactly at seat limit of 2)
      const [u2] = await db
        .insert(users)
        .values({
          orgId: testOrgId,
          email: "u2@metered.test.local",
          role: "member",
        })
        .returning()
      userIds.push(u2.id)

      // With 2 members, we have reached the limit of 2, so further additions are blocked
      await expect(assertSeatLimit(testOrgId)).rejects.toThrow(
        "Seat limit reached (2 seats). Please upgrade your plan to add more seats."
      )
    })
  })

  describe("reportUsageToStripe", () => {
    it("accumulates events correctly, reports the aggregate to Stripe, and locks them to prevent duplicate submission", async () => {
      // Mock Stripe returns
      const mockStripeSubscription = {
        id: "sub_metered_test_456",
        items: {
          data: [
            { id: "item_flat_123", price: { id: "price_flat_metered_test" } },
            { id: "item_metered_789", price: { id: "price_metered_test_id" } }, // Metered item
          ],
        },
      }

      const mockStripeUsageRecord = {
        id: "mrec_stripe_rec_999",
        quantity: 3,
      }

      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(mockStripeSubscription as any)
      vi.mocked(stripe.subscriptionItems.createUsageRecord).mockResolvedValue(mockStripeUsageRecord as any)

      // Seed 3 unreported usage events
      await db.insert(usageEvents).values([
        { orgId: testOrgId, type: "ai_message", quantity: 1 },
        { orgId: testOrgId, type: "ai_message", quantity: 1 },
        { orgId: testOrgId, type: "ai_message", quantity: 1 },
      ])

      // ────────────────────────────────────────────────────────────────────────
      // Run 1: First usage reporting sweep
      // ────────────────────────────────────────────────────────────────────────
      const run1Results = await reportUsageToStripe()

      // Assert correct reporting output
      expect(run1Results[testOrgId]).toBe(3)

      // Verify Stripe Client was called correctly
      expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_metered_test_456")
      expect(stripe.subscriptionItems.createUsageRecord).toHaveBeenCalledWith(
        "item_metered_789",
        expect.objectContaining({
          quantity: 3,
          action: "increment",
        })
      )

      // Verify events in local database have been marked with stripeUsageRecordId
      const eventsInDb = await db.query.usageEvents.findMany({
        where: eq(usageEvents.orgId, testOrgId),
      })
      expect(eventsInDb).toHaveLength(3)
      for (const e of eventsInDb) {
        expect(e.stripeUsageRecordId).toBe("mrec_stripe_rec_999")
      }

      // ────────────────────────────────────────────────────────────────────────
      // Run 2: Second reporting sweep (no new events added)
      // ────────────────────────────────────────────────────────────────────────
      vi.clearAllMocks()
      const run2Results = await reportUsageToStripe()

      // Assert that nothing was processed for this org
      expect(run2Results[testOrgId]).toBeUndefined()

      // Verify Stripe Client was NOT called again for this organization
      expect(stripe.subscriptionItems.createUsageRecord).not.toHaveBeenCalled()
    })
  })
})
