import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { eq } from "drizzle-orm"
import { appRouter } from "@/lib/api/root"
import { db } from "@/lib/db"
import { organizations, plans, users } from "@/lib/db/schema"
import { stripe } from "@/lib/billing/stripe-client"

// Mock stripe SDK
vi.mock("@/lib/billing/stripe-client", () => {
  return {
    stripe: {
      billingPortal: {
        sessions: {
          create: vi.fn(),
        },
      },
      invoices: {
        list: vi.fn(),
      },
      subscriptions: {
        retrieve: vi.fn(),
        update: vi.fn(),
      },
    },
  }
})

// Mock changePlan from subscription service to avoid network or database complex dependency
vi.mock("@/lib/billing/subscription-service", () => {
  return {
    changePlan: vi.fn().mockResolvedValue({ id: "mock_sub" }),
  }
})

describe("billingRouter procedures", () => {
  let testOrgId: string
  let testUserId: string
  let testPlanId: string

  const caller = () =>
    appRouter.createCaller({
      user: { id: testUserId, orgId: testOrgId, role: "admin" },
    })

  let createdPlan = false

  beforeAll(async () => {
    // 1. Get or insert test plan
    let plan = await db.query.plans.findFirst({
      where: eq(plans.key, "starter"),
    })

    if (!plan) {
      const [insertedPlan] = await db
        .insert(plans)
        .values({
          key: "starter",
          name: "Starter Plan",
          seatLimit: 2,
          includedMessages: 500,
          monthlyPriceCents: 4900,
          stripePriceId: "price_flat_starter_test",
          stripeMeteredPriceId: "price_meter_starter_test",
          active: true,
        })
        .returning()
      plan = insertedPlan
      createdPlan = true
    }
    testPlanId = plan.id

    // 2. Insert test organization
    const [org] = await db
      .insert(organizations)
      .values({
        name: "Test Billing Org",
        slug: `test-billing-${Date.now()}`,
        stripeCustomerId: "cus_billing_test",
        stripeSubscriptionId: "sub_billing_test",
        planId: plan.id,
        subscriptionStatus: "active",
      })
      .returning()
    testOrgId = org.id

    // 3. Insert test admin user
    const [user] = await db
      .insert(users)
      .values({
        orgId: testOrgId,
        email: `admin-billing-${Date.now()}@test.local`,
        name: "Billing Admin",
        role: "admin",
      })
      .returning()
    testUserId = user.id
  })

  afterAll(async () => {
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId))
    }
    if (testOrgId) {
      await db.delete(organizations).where(eq(organizations.id, testOrgId))
    }
    if (testPlanId && createdPlan) {
      await db.delete(plans).where(eq(plans.id, testPlanId))
    }
  })

  it("getBillingInfo returns formatted subscription, seat count, and overage metrics", async () => {
    const info = await caller().billing.getBillingInfo()
    expect(info.currentPlan?.key).toBe("starter")
    expect(info.seatsUsed).toBe(1)
    expect(info.messagesUsed).toBe(0)
    expect(info.overageCostCents).toBe(0)
  })

  it("listPlans returns active plans listed in price order", async () => {
    const plans = await caller().billing.listPlans()
    expect(plans.length).toBeGreaterThanOrEqual(1)
    expect(plans.find((p) => p.key === "starter")).toBeDefined()
  })

  it("getPortalSession creates and returns a Stripe portal URL", async () => {
    vi.mocked(stripe.billingPortal.sessions.create).mockResolvedValue({
      id: "pts_123",
      url: "https://stripe.com/portal/test-pts_123",
    } as any)

    const res = await caller().billing.getPortalSession()
    expect(res.url).toBe("https://stripe.com/portal/test-pts_123")
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_billing_test",
      })
    )
  })

  it("getInvoiceHistory pulls list of customer invoices from Stripe", async () => {
    vi.mocked(stripe.invoices.list).mockResolvedValue({
      data: [
        {
          id: "in_abc",
          number: "INV-0001",
          total: 4900,
          status: "paid",
          created: 1700000000,
          invoice_pdf: "https://stripe.com/pdf/invoice_abc",
        },
      ],
    } as any)

    const history = await caller().billing.getInvoiceHistory()
    expect(history).toHaveLength(1)
    expect(history[0].id).toBe("in_abc")
    expect(history[0].number).toBe("INV-0001")
    expect(history[0].total).toBe(4900)
    expect(history[0].status).toBe("paid")
    expect(history[0].pdfUrl).toBe("https://stripe.com/pdf/invoice_abc")
  })
})
