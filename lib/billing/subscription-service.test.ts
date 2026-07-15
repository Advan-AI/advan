import { describe, expect, it, vi, beforeEach } from "vitest"
import {
  createCustomerForOrg,
  startSubscription,
  changePlan,
  cancelSubscription,
} from "./subscription-service"

// ── Mock DB ───────────────────────────────────────────────────────────────────
// Controlled in-memory store; each test seeds orgStore/planStore before calling
// the service function under test.

const orgStore: Record<string, any> = {}
const planStore: Record<string, any> = {}

const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) })

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      organizations: {
        findFirst: vi.fn(({ where }: any) => {
          // where is an eq() result — extract the value from the second arg
          // Drizzle eq() returns an object; we identify the org by inspecting
          // what the caller passes. We expose a helper on the mock itself.
          return Promise.resolve(mockDb.__orgResult)
        }),
        plans: {
          findFirst: vi.fn(() => Promise.resolve(mockDb.__planResult)),
        },
      },
      plans: {
        findFirst: vi.fn(() => Promise.resolve(mockDb.__planResult)),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
}))

// Shared mutable state the mock reads from
const mockDb = {
  __orgResult: null as any,
  __planResult: null as any,
}

// ── Mock Stripe ───────────────────────────────────────────────────────────────
vi.mock("./stripe-client", () => ({
  stripe: {
    customers: {
      create: vi.fn(),
    },
    subscriptions: {
      create: vi.fn(),
      retrieve: vi.fn(),
      update: vi.fn(),
      cancel: vi.fn(),
    },
  },
}))

import { stripe } from "./stripe-client"
import { db } from "@/lib/db"

// ─────────────────────────────────────────────────────────────────────────────

const BASE_ORG = {
  id: "org-uuid-1",
  name: "Test Corp",
  slug: "test-corp",
  stripeCustomerId: null as string | null,
  stripeSubscriptionId: null as string | null,
  planId: null as string | null,
  subscriptionStatus: null as string | null,
}

const STARTER_PLAN = {
  id: "plan-uuid-starter",
  key: "starter",
  name: "Starter",
  stripePriceId: "price_starter_flat",
  stripeMeteredPriceId: "price_starter_metered",
}

const PRO_PLAN = {
  id: "plan-uuid-pro",
  key: "pro",
  name: "Pro",
  stripePriceId: "price_pro_flat",
  stripeMeteredPriceId: "price_pro_metered",
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.__orgResult = null
  mockDb.__planResult = null
})

// ── createCustomerForOrg ──────────────────────────────────────────────────────

describe("createCustomerForOrg", () => {
  it("creates a Stripe customer and persists stripeCustomerId when none exists", async () => {
    mockDb.__orgResult = { ...BASE_ORG, stripeCustomerId: null }
    vi.mocked(stripe.customers.create).mockResolvedValue({ id: "cus_new_abc" } as any)

    const result = await createCustomerForOrg("org-uuid-1")

    expect(result).toBe("cus_new_abc")
    expect(stripe.customers.create).toHaveBeenCalledOnce()
    expect(stripe.customers.create).toHaveBeenCalledWith({
      name: "Test Corp",
      email: expect.stringContaining("billing@"),
      metadata: { orgId: "org-uuid-1", slug: "test-corp" },
    })
    // db.update called to persist the new customer ID
    expect(db.update).toHaveBeenCalledOnce()
  })

  it("is idempotent: returns existing stripeCustomerId without calling Stripe", async () => {
    mockDb.__orgResult = { ...BASE_ORG, stripeCustomerId: "cus_existing_xyz" }

    const result = await createCustomerForOrg("org-uuid-1")

    expect(result).toBe("cus_existing_xyz")
    expect(stripe.customers.create).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
  })

  it("throws when the org does not exist", async () => {
    mockDb.__orgResult = null

    await expect(createCustomerForOrg("org-uuid-missing")).rejects.toThrow(
      "Organization with ID org-uuid-missing not found"
    )
  })
})

// ── startSubscription ─────────────────────────────────────────────────────────

describe("startSubscription", () => {
  it("creates a subscription with two items and a 14-day trial, then persists all fields", async () => {
    mockDb.__orgResult = { ...BASE_ORG, stripeCustomerId: "cus_existing_xyz" }
    mockDb.__planResult = STARTER_PLAN

    const now = Math.floor(Date.now() / 1000)
    const trialEnd = now + 14 * 24 * 60 * 60

    vi.mocked(stripe.subscriptions.create).mockResolvedValue({
      id: "sub_new_123",
      status: "trialing",
      trial_end: trialEnd,
      current_period_start: now,
      current_period_end: trialEnd,
    } as any)

    await startSubscription("org-uuid-1", "starter")

    expect(stripe.subscriptions.create).toHaveBeenCalledOnce()
    expect(stripe.subscriptions.create).toHaveBeenCalledWith({
      customer: "cus_existing_xyz",
      items: [
        { price: "price_starter_flat" },
        { price: "price_starter_metered" },
      ],
      trial_period_days: 14,
      trial_settings: {
        end_behavior: { missing_payment_method: "pause" },
      },
    })

    // db.update must be called to persist subscription state
    expect(db.update).toHaveBeenCalledOnce()
    const setCall = vi.mocked(db.update).mock.results[0].value.set
    expect(setCall).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeSubscriptionId: "sub_new_123",
        planId: STARTER_PLAN.id,
        subscriptionStatus: "trialing",
        trialEndsAt: expect.any(Date),
        currentPeriodStart: expect.any(Date),
        currentPeriodEnd: expect.any(Date),
      })
    )
  })

  it("calls createCustomerForOrg first when org has no stripeCustomerId", async () => {
    // First findFirst call (in startSubscription) returns org with no customer
    // Second findFirst call (inside createCustomerForOrg) also returns same org
    mockDb.__orgResult = { ...BASE_ORG, stripeCustomerId: null }
    mockDb.__planResult = STARTER_PLAN

    vi.mocked(stripe.customers.create).mockResolvedValue({ id: "cus_created_inline" } as any)
    vi.mocked(stripe.subscriptions.create).mockResolvedValue({
      id: "sub_inline_456",
      status: "trialing",
      trial_end: null,
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    } as any)

    await startSubscription("org-uuid-1", "starter")

    expect(stripe.customers.create).toHaveBeenCalledOnce()
    expect(stripe.subscriptions.create).toHaveBeenCalledOnce()
  })

  it("throws when plan key does not exist", async () => {
    mockDb.__orgResult = { ...BASE_ORG, stripeCustomerId: "cus_xyz" }
    mockDb.__planResult = null

    await expect(startSubscription("org-uuid-1", "nonexistent")).rejects.toThrow(
      "Plan with key nonexistent not found"
    )
  })
})

// ── changePlan ────────────────────────────────────────────────────────────────

describe("changePlan", () => {
  it("updates the flat and metered subscription items with create_prorations and saves new planId", async () => {
    mockDb.__orgResult = {
      ...BASE_ORG,
      stripeCustomerId: "cus_xyz",
      stripeSubscriptionId: "sub_existing_789",
      planId: STARTER_PLAN.id,
      subscriptionStatus: "active",
    }

    // First plan lookup is for the new plan; second (old plan) also resolves via planId
    // The service calls plans.findFirst twice: once for newPlan, once for oldPlan
    vi.mocked(db.query.plans.findFirst)
      .mockResolvedValueOnce(PRO_PLAN as any)   // newPlan
      .mockResolvedValueOnce(STARTER_PLAN as any) // oldPlan

    vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
      id: "sub_existing_789",
      items: {
        data: [
          { id: "si_flat_001", price: { id: "price_starter_flat" } },
          { id: "si_meter_002", price: { id: "price_starter_metered" } },
        ],
      },
    } as any)

    const now = Math.floor(Date.now() / 1000)
    vi.mocked(stripe.subscriptions.update).mockResolvedValue({
      id: "sub_existing_789",
      status: "active",
      current_period_start: now,
      current_period_end: now + 30 * 24 * 60 * 60,
    } as any)

    await changePlan("org-uuid-1", "pro")

    expect(stripe.subscriptions.update).toHaveBeenCalledOnce()
    expect(stripe.subscriptions.update).toHaveBeenCalledWith("sub_existing_789", {
      items: [
        { id: "si_flat_001", price: "price_pro_flat" },
        { id: "si_meter_002", price: "price_pro_metered" },
      ],
      proration_behavior: "create_prorations",
    })

    expect(db.update).toHaveBeenCalledOnce()
    const setCall = vi.mocked(db.update).mock.results[0].value.set
    expect(setCall).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: PRO_PLAN.id,
        subscriptionStatus: "active",
      })
    )
  })

  it("throws when org has no active subscription", async () => {
    mockDb.__orgResult = { ...BASE_ORG, stripeSubscriptionId: null }
    mockDb.__planResult = PRO_PLAN

    await expect(changePlan("org-uuid-1", "pro")).rejects.toThrow(
      "does not have an active Stripe subscription to change"
    )
  })
})

// ── cancelSubscription ────────────────────────────────────────────────────────

describe("cancelSubscription", () => {
  it("schedules cancellation at period end and sets status to 'canceling'", async () => {
    mockDb.__orgResult = {
      ...BASE_ORG,
      stripeSubscriptionId: "sub_cancel_abc",
      subscriptionStatus: "active",
    }

    vi.mocked(stripe.subscriptions.update).mockResolvedValue({
      id: "sub_cancel_abc",
      status: "active",
    } as any)

    await cancelSubscription("org-uuid-1", true)

    expect(stripe.subscriptions.update).toHaveBeenCalledWith("sub_cancel_abc", {
      cancel_at_period_end: true,
    })
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled()

    const setCall = vi.mocked(db.update).mock.results[0].value.set
    expect(setCall).toHaveBeenCalledWith({ subscriptionStatus: "canceling" })
  })

  it("cancels immediately and sets status to 'canceled'", async () => {
    mockDb.__orgResult = {
      ...BASE_ORG,
      stripeSubscriptionId: "sub_cancel_abc",
      subscriptionStatus: "active",
    }

    vi.mocked(stripe.subscriptions.cancel).mockResolvedValue({
      id: "sub_cancel_abc",
      status: "canceled",
    } as any)

    await cancelSubscription("org-uuid-1", false)

    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith("sub_cancel_abc")
    expect(stripe.subscriptions.update).not.toHaveBeenCalled()

    const setCall = vi.mocked(db.update).mock.results[0].value.set
    expect(setCall).toHaveBeenCalledWith({ subscriptionStatus: "canceled" })
  })

  it("throws when org has no subscription to cancel", async () => {
    mockDb.__orgResult = { ...BASE_ORG, stripeSubscriptionId: null }

    await expect(cancelSubscription("org-uuid-1", true)).rejects.toThrow(
      "does not have an active Stripe subscription to cancel"
    )
  })
})
