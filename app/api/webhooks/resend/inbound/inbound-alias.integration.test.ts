import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { eq } from "drizzle-orm"
import { resetEmailConfigCache } from "@/lib/email/config"

// Mock out BullMQ Queue constructor to avoid connections during test boot
vi.mock("@/lib/queue/queues", () => ({
  copilotTriageQueue: { add: vi.fn() },
  notificationQueue: { add: vi.fn() },
  embeddingQueue: { add: vi.fn() },
}))

const SECRET = `whsec_${Buffer.from("test-secret-for-svix-signing").toString("base64")}`
const DOMAIN = "mail.example.com"

// Set DATABASE_URL and other configuration before importing any db modules!
process.env.DATABASE_URL = "postgres://arslan_toor:Encrypt123***@localhost:5432/advan_ai"
process.env.RESEND_API_KEY = "re_test"
process.env.EMAIL_FROM = `Support <support@${DOMAIN}>`
process.env.EMAIL_INBOUND_DOMAIN = DOMAIN
process.env.RESEND_WEBHOOK_SECRET = SECRET
resetEmailConfigCache()

import { db } from "@/lib/db"
import { organizations } from "@/lib/db/schema"
import { productionDeps } from "./route"

function seedEnv() {
  process.env.DATABASE_URL = "postgres://arslan_toor:Encrypt123***@localhost:5432/advan_ai"
  process.env.RESEND_API_KEY = "re_test"
  process.env.EMAIL_FROM = `Support <support@${DOMAIN}>`
  process.env.EMAIL_INBOUND_DOMAIN = DOMAIN
  process.env.RESEND_WEBHOOK_SECRET = SECRET
  resetEmailConfigCache()
}

function clearEnv() {
  delete process.env.RESEND_API_KEY
  delete process.env.EMAIL_FROM
  delete process.env.EMAIL_INBOUND_DOMAIN
  delete process.env.RESEND_WEBHOOK_SECRET
  resetEmailConfigCache()
}

describe("Inbound Email Alias Database Routing (Integration)", () => {
  let orgAId: string
  let orgBId: string
  let aliasA: string
  let aliasB: string

  beforeAll(async () => {
    seedEnv()
    const timestamp = Date.now()
    aliasA = `support+orga-${timestamp}`
    aliasB = `support+orgb-${timestamp}`

    const [orgA] = await db
      .insert(organizations)
      .values({
        name: "Integration Org A",
        slug: `org-a-${timestamp}`,
        inboundEmailAlias: aliasA,
      })
      .returning()

    const [orgB] = await db
      .insert(organizations)
      .values({
        name: "Integration Org B",
        slug: `org-b-${timestamp}`,
        inboundEmailAlias: aliasB,
      })
      .returning()

    orgAId = orgA.id
    orgBId = orgB.id
  })

  afterAll(async () => {
    clearEnv()
    if (orgAId) {
      await db.delete(organizations).where(eq(organizations.id, orgAId))
    }
    if (orgBId) {
      await db.delete(organizations).where(eq(organizations.id, orgBId))
    }
  })

  it("resolves the correct organization for Org A's alias", async () => {
    const resolvedOrgId = await productionDeps.resolveOrgByEmailAlias([
      `someone@else.com`,
      `${aliasA}@${DOMAIN}`,
    ])

    expect(resolvedOrgId).toBe(orgAId)
  })

  it("resolves the correct organization for Org B's alias", async () => {
    const resolvedOrgId = await productionDeps.resolveOrgByEmailAlias([
      `${aliasB}@${DOMAIN}`,
    ])

    expect(resolvedOrgId).toBe(orgBId)
  })

  it("returns null when an unknown alias is queried", async () => {
    const resolvedOrgId = await productionDeps.resolveOrgByEmailAlias([
      `support+unknown-${Date.now()}@${DOMAIN}`,
    ])

    expect(resolvedOrgId).toBeNull()
  })

  it("handles case-insensitivity and whitespace in email addresses gracefully", async () => {
    const resolvedOrgId = await productionDeps.resolveOrgByEmailAlias([
      `  ${aliasA.toUpperCase()}@${DOMAIN.toUpperCase()}  `,
    ])

    expect(resolvedOrgId).toBe(orgAId)
  })
})
