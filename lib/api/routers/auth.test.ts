import { afterAll, describe, expect, it, vi } from "vitest"
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

vi.mock("@/lib/billing/subscription-service", () => ({
  createCustomerForOrg: vi.fn().mockResolvedValue("cus_mock_auth_test"),
  startSubscription: vi.fn().mockResolvedValue({ id: "sub_mock_auth_test" }),
}))

describe("authRouter signup path", () => {
  let createdOrgId: string | undefined
  const caller = appRouter.createCaller({})

  afterAll(async () => {
    if (createdOrgId) {
      await db.delete(widgetConfigs).where(eq(widgetConfigs.orgId, createdOrgId))
      await db.delete(users).where(eq(users.orgId, createdOrgId))
      await db.delete(organizations).where(eq(organizations.id, createdOrgId))
    }
  })

  it("successfully signs up a new organization and provisions everything in a transaction", async () => {
    const slug = `auth-signup-test-${Date.now()}`
    const result = await caller.auth.signup({
      orgName: "Sign Up Test Corp",
      orgSlug: slug,
      adminName: "Jane Test Admin",
      adminEmail: `admin@${slug}.local`,
      password: "securePassword123!",
    })

    expect(result.success).toBe(true)
    expect(result.orgId).toBeDefined()
    expect(result.userId).toBeDefined()
    createdOrgId = result.orgId

    // Assert organization exists and has default email alias
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, result.orgId),
    })
    expect(org).toBeDefined()
    expect(org?.name).toBe("Sign Up Test Corp")
    expect(org?.slug).toBe(slug)
    expect(org?.inboundEmailAlias).toBe(`support+${slug}`)

    // Assert admin user was created with correct fields
    const admin = await db.query.users.findFirst({
      where: eq(users.id, result.userId),
    })
    expect(admin).toBeDefined()
    expect(admin?.orgId).toBe(result.orgId)
    expect(admin?.email).toBe(`admin@${slug}.local`)
    expect(admin?.name).toBe("Jane Test Admin")
    expect(admin?.role).toBe("admin")
    expect(admin?.passwordHash).toBeDefined()
    expect(admin?.passwordHash).not.toBeNull()

    // Assert default widget config was created and is locked (allowedOrigins starts empty)
    const widgetConfig = await db.query.widgetConfigs.findFirst({
      where: eq(widgetConfigs.orgId, result.orgId),
    })
    expect(widgetConfig).toBeDefined()
    expect(widgetConfig?.orgId).toBe(result.orgId)
    expect(widgetConfig?.widgetKey).toMatch(/^wk_live_[a-f0-9]{32}$/)
    expect(widgetConfig?.allowedOrigins).toEqual([])
    expect(widgetConfig?.preChatFormEnabled).toBe(true)
  })

  it("fails when signing up with an already existing slug", async () => {
    if (!createdOrgId) {
      throw new Error("Previous test did not create an organization to test conflict")
    }
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, createdOrgId),
    })
    const slug = org!.slug

    await expect(
      caller.auth.signup({
        orgName: "Conflict Slug Corp",
        orgSlug: slug,
        adminName: "Conflict Admin",
        adminEmail: `another-admin@${slug}.local`,
        password: "securePassword123!",
      })
    ).rejects.toThrow(/subdomain\/slug already exists/)
  })

  it("fails when signing up with an already registered user email", async () => {
    if (!createdOrgId) {
      throw new Error("Previous test did not create an organization to test conflict")
    }
    const admin = await db.query.users.findFirst({
      where: eq(users.orgId, createdOrgId),
    })
    const email = admin!.email

    await expect(
      caller.auth.signup({
        orgName: "Conflict Email Corp",
        orgSlug: `different-slug-${Date.now()}`,
        adminName: "Conflict Admin",
        adminEmail: email,
        password: "securePassword123!",
      })
    ).rejects.toThrow(/email address is already registered/)
  })
})

describe("authRouter onboarding path", () => {
  it("successfully detects and completes onboarding for pending Google users", async () => {
    // 1. Setup pending org + user
    const pendingSlug = `pending-test-${Date.now()}`
    const [org] = await db
      .insert(organizations)
      .values({
        name: "Pending Onboarding",
        slug: pendingSlug,
      })
      .returning()

    const [user] = await db
      .insert(users)
      .values({
        orgId: org.id,
        email: `pending-${Date.now()}@google-test.local`,
        name: "Google Pending Admin",
        role: "admin",
        emailVerified: true,
      })
      .returning()

    // 2. Create authenticated caller
    const caller = appRouter.createCaller({
      user: {
        id: user.id,
        orgId: org.id,
        role: "admin",
      },
    })

    // 3. Verify getOnboardingStatus returns isPending: true
    const statusBefore = await caller.auth.getOnboardingStatus()
    expect(statusBefore.isPending).toBe(true)
    expect(statusBefore.orgName).toBe("")
    expect(statusBefore.orgSlug).toBe("")

    // 4. Complete onboarding
    const finalSlug = `completed-onb-${Date.now()}`
    const completeResult = await caller.auth.completeOnboarding({
      orgName: "Successfully Completed Workspace",
      orgSlug: finalSlug,
    })
    expect(completeResult.success).toBe(true)

    // 5. Verify organization was updated in database
    const updatedOrg = await db.query.organizations.findFirst({
      where: eq(organizations.id, org.id),
    })
    expect(updatedOrg?.name).toBe("Successfully Completed Workspace")
    expect(updatedOrg?.slug).toBe(finalSlug)

    // 6. Verify getOnboardingStatus now returns isPending: false
    const statusAfter = await caller.auth.getOnboardingStatus()
    expect(statusAfter.isPending).toBe(false)
    expect(statusAfter.orgName).toBe("Successfully Completed Workspace")
    expect(statusAfter.orgSlug).toBe(finalSlug)

    // Clean up
    await db.delete(users).where(eq(users.id, user.id))
    await db.delete(organizations).where(eq(organizations.id, org.id))
  })
})

