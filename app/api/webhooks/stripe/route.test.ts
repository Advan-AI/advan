import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { organizations, plans, stripeEvents } from "@/lib/db/schema"
import { stripe } from "@/lib/billing/stripe-client"
import { POST } from "./route"
import { getResendClient } from "@/lib/email/resend-client"

// Mock the Stripe SDK constructEvent
vi.mock("@/lib/billing/stripe-client", () => {
  return {
    stripe: {
      webhooks: {
        constructEvent: vi.fn(),
      },
    },
  }
})

// Mock the Resend email client and configuration
vi.mock("@/lib/email/resend-client", () => {
  const sendFn = vi.fn().mockResolvedValue({ data: { id: "msg_dunning_123" } })
  return {
    getResendClient: vi.fn().mockReturnValue({
      emails: {
        send: sendFn,
      },
    }),
  }
})

vi.mock("@/lib/email/config", () => {
  return {
    requireEmailConfig: vi.fn().mockReturnValue({
      apiKey: "re_mock_api_key",
      from: "Advan Billing <billing@mail.test.local>",
    }),
  }
})

describe("Stripe Webhooks Endpoint API Route", () => {
  let testOrgId: string
  let starterPlanId: string
  let proPlanId: string

  beforeEach(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret"

    // 1. Seed two test plans (Starter + Pro)
    const [starter] = await db
      .insert(plans)
      .values({
        key: "starter_pkg",
        name: "Starter Pkg",
        seatLimit: 2,
        includedMessages: 500,
        monthlyPriceCents: 4900,
        stripePriceId: "price_flat_starter_test",
        stripeMeteredPriceId: "price_metered_starter_test",
        active: true,
      })
      .returning()

    const [pro] = await db
      .insert(plans)
      .values({
        key: "pro_pkg",
        name: "Pro Pkg",
        seatLimit: 5,
        includedMessages: 2000,
        monthlyPriceCents: 14900,
        stripePriceId: "price_flat_pro_test",
        stripeMeteredPriceId: "price_metered_pro_test",
        active: true,
      })
      .returning()

    starterPlanId = starter.id
    proPlanId = pro.id

    // 2. Seed a test organization with Stripe Customer ID
    const [org] = await db
      .insert(organizations)
      .values({
        name: "Webhook Sync Corp",
        slug: `webhook-sync-${Date.now()}`,
        stripeCustomerId: "cus_webhook_test_888",
        planId: starter.id,
        subscriptionStatus: "active",
      })
      .returning()

    testOrgId = org.id

    vi.clearAllMocks()
  })

  afterEach(async () => {
    // 3. Clear database test artifacts
    await db.delete(organizations).where(eq(organizations.id, testOrgId))
    await db.delete(plans).where(eq(plans.id, starterPlanId))
    await db.delete(plans).where(eq(plans.id, proPlanId))
    await db.delete(stripeEvents)
  })

  const makeWebhookRequest = (body: string) => {
    return new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body,
      headers: {
        "stripe-signature": "t=123,v1=abc",
      },
    })
  }

  describe("customer.subscription.updated", () => {
    it("successfully syncs status, period boundaries, and switches plan if price changed", async () => {
      const mockEvent = {
        id: "evt_sub_upd_001",
        type: "customer.subscription.updated",
        data: {
          object: {
            customer: "cus_webhook_test_888",
            status: "active",
            trial_end: null,
            current_period_start: 1770000000,
            current_period_end: 1772592000,
            items: {
              data: [
                { price: { id: "price_flat_pro_test" } }, // Price indicates they upgraded to Pro plan
              ],
            },
          },
        },
      }

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as any)

      const req = makeWebhookRequest(JSON.stringify(mockEvent))
      const res = await POST(req)

      expect(res.status).toBe(200)

      // Verify DB was correctly modified to Pro plan details
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, testOrgId),
      })
      expect(org?.subscriptionStatus).toBe("active")
      expect(org?.planId).toBe(proPlanId) // Plan Swapped!
      expect(org?.currentPeriodStart).toEqual(new Date(1770000000 * 1000))
      expect(org?.currentPeriodEnd).toEqual(new Date(1772592000 * 1000))
    })
  })

  describe("customer.subscription.deleted", () => {
    it("marks the localized subscription state as canceled", async () => {
      const mockEvent = {
        id: "evt_sub_del_002",
        type: "customer.subscription.deleted",
        data: {
          object: {
            customer: "cus_webhook_test_888",
            status: "canceled",
          },
        },
      }

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as any)

      const req = makeWebhookRequest(JSON.stringify(mockEvent))
      const res = await POST(req)

      expect(res.status).toBe(200)

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, testOrgId),
      })
      expect(org?.subscriptionStatus).toBe("canceled")
    })
  })

  describe("invoice.payment_failed", () => {
    it("sets subscription to past_due locally and fires off a dunning notification", async () => {
      const mockEvent = {
        id: "evt_inv_fail_003",
        type: "invoice.payment_failed",
        data: {
          object: {
            customer: "cus_webhook_test_888",
            subscription: "sub_test_invoice_failed",
          },
        },
      }

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as any)

      const req = makeWebhookRequest(JSON.stringify(mockEvent))
      const res = await POST(req)

      expect(res.status).toBe(200)

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, testOrgId),
      })
      expect(org?.subscriptionStatus).toBe("past_due")

      // Verify Resend send mock was fired
      const resendInstance = getResendClient()
      expect(resendInstance.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: `billing@${org?.slug}.advan.ai`,
          subject: expect.stringContaining("Payment Failed"),
        })
      )
    })
  })

  describe("invoice.paid", () => {
    it("recovers and clears past_due status back to active upon payment confirmation", async () => {
      // Set org status to past_due manually first
      await db
        .update(organizations)
        .set({ subscriptionStatus: "past_due" })
        .where(eq(organizations.id, testOrgId))

      const mockEvent = {
        id: "evt_inv_paid_004",
        type: "invoice.paid",
        data: {
          object: {
            customer: "cus_webhook_test_888",
          },
        },
      }

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as any)

      const req = makeWebhookRequest(JSON.stringify(mockEvent))
      const res = await POST(req)

      expect(res.status).toBe(200)

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, testOrgId),
      })
      expect(org?.subscriptionStatus).toBe("active")
    })
  })

  describe("Idempotency: Redelivered Events", () => {
    it("guarantees single-processing execution on duplicate event redeliveries", async () => {
      const mockEvent = {
        id: "evt_idempotent_999",
        type: "customer.subscription.deleted",
        data: {
          object: {
            customer: "cus_webhook_test_888",
            status: "canceled",
          },
        },
      }

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as any)

      // First delivery
      const req1 = makeWebhookRequest(JSON.stringify(mockEvent))
      const res1 = await POST(req1)
      expect(res1.status).toBe(200)

      // Check DB was updated to canceled
      let org = await db.query.organizations.findFirst({
        where: eq(organizations.id, testOrgId),
      })
      expect(org?.subscriptionStatus).toBe("canceled")

      // Re-activate org status in DB to detect if the redelivery triggers modification again
      await db
        .update(organizations)
        .set({ subscriptionStatus: "active" })
        .where(eq(organizations.id, testOrgId))

      // Second identical delivery
      const req2 = makeWebhookRequest(JSON.stringify(mockEvent))
      const res2 = await POST(req2)
      expect(res2.status).toBe(200)

      // Confirm duplicate status was flagged in response
      const data2 = await res2.json()
      expect(data2.duplicate).toBe(true)

      // Assert local status remained 'active' because processing was skipped!
      org = await db.query.organizations.findFirst({
        where: eq(organizations.id, testOrgId),
      })
      expect(org?.subscriptionStatus).toBe("active")
    })
  })
})
