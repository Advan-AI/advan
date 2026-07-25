import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SignJWT } from "jose"
import { NextRequest } from "next/server"

const mockLimit = vi.fn()
vi.mock("@upstash/ratelimit", () => {
  function RatelimitMock() {
    return {
      limit: (key: string) => mockLimit(key),
    }
  }
  ;(RatelimitMock as any).slidingWindow = vi.fn().mockReturnValue({})
  return {
    Ratelimit: RatelimitMock,
  }
})

vi.mock("@/lib/tickets/auto-intake", () => ({
  resolveOrCreateIntake: vi.fn(),
}))

vi.mock("@/lib/realtime/event-bus", () => ({
  isOrgChatAccepting: vi.fn(),
}))

vi.mock("@/lib/email/parse-inbound", () => ({
  sanitizeInboundText: vi.fn((t: string) => t),
}))

vi.mock("@/lib/governance/pii-masker", () => ({
  PIIMasker: { mask: vi.fn((t: string) => t) },
}))

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      visitors: {
        findFirst: vi.fn(),
      },
    },
  },
}))

import { resolveOrCreateIntake } from "@/lib/tickets/auto-intake"
import { isOrgChatAccepting } from "@/lib/realtime/event-bus"
import { db } from "@/lib/db"
import { POST } from "./route"

const mockResolveOrCreate = vi.mocked(resolveOrCreateIntake)
const mockIsOrgChatAccepting = vi.mocked(isOrgChatAccepting)
const mockFindVisitor = vi.mocked(db.query.visitors.findFirst)

const AUTH_SECRET = "test-auth-secret-intake-leakage-test!!"
const ORG_A = "aaaa0000-0000-0000-0000-000000000001"
const ORG_B = "bbbb0000-0000-0000-0000-000000000002"
const WIDGET_KEY_A = "wk_org_a"
const WIDGET_KEY_B = "wk_org_b"
const VISITOR_ID_A = "aaaa1111-0000-0000-0000-000000000001"
const VISITOR_ID_B = "bbbb1111-0000-0000-0000-000000000002"

function visitorFixture(opts: { id: string; orgId: string; widgetKey: string }) {
  return {
    id: opts.id,
    orgId: opts.orgId,
    widgetKey: opts.widgetKey,
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
  }
}

async function mintToken(opts: {
  orgId: string
  widgetKey: string
  visitorId: string
  secret?: string
  expiry?: string
}): Promise<string> {
  const key = new TextEncoder().encode(opts.secret ?? AUTH_SECRET)
  return new SignJWT({
    orgId: opts.orgId,
    widgetKey: opts.widgetKey,
    visitorId: opts.visitorId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(opts.expiry ?? "1h")
    .setIssuer("advan:chat-session")
    .sign(key)
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/chat/intake", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
}

beforeEach(() => {
  process.env.AUTH_SECRET = AUTH_SECRET
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
  mockLimit.mockReset().mockResolvedValue({ success: true, limit: 120, remaining: 119, reset: Date.now() + 1000 })
  mockIsOrgChatAccepting.mockResolvedValue(true)
  mockFindVisitor.mockResolvedValue(
    visitorFixture({ id: VISITOR_ID_A, orgId: ORG_A, widgetKey: WIDGET_KEY_A }),
  )
  mockResolveOrCreate.mockResolvedValue({
    conversationId: "conv-001",
    messageId: "msg-001",
    ticketId: "ticket-001",
    isNewTicket: true,
  })
})

afterEach(() => {
  delete process.env.AUTH_SECRET
  vi.clearAllMocks()
})

describe("POST /api/chat/intake", () => {
  it("accepts valid token and routes to token org/visitor", async () => {
    const token = await mintToken({ orgId: ORG_A, widgetKey: WIDGET_KEY_A, visitorId: VISITOR_ID_A })

    const res = await POST(makeRequest({ token, content: "Hello" }))

    expect(res.status).toBe(202)
    expect(mockResolveOrCreate).toHaveBeenCalledOnce()
    const call = mockResolveOrCreate.mock.calls[0][0]
    expect(call.orgId).toBe(ORG_A)
    expect(call.customerIdentifier).toEqual({ visitorId: VISITOR_ID_A })
  })

  it("returns 401 when token is missing", async () => {
    const res = await POST(makeRequest({ content: "Hello" }))
    expect(res.status).toBe(401)
    expect(mockResolveOrCreate).not.toHaveBeenCalled()
  })

  it("returns 401 for wrong-signature token", async () => {
    const token = await mintToken({
      orgId: ORG_A,
      widgetKey: WIDGET_KEY_A,
      visitorId: VISITOR_ID_A,
      secret: "wrong-secret",
    })

    const res = await POST(makeRequest({ token, content: "Hello" }))
    expect(res.status).toBe(401)
    expect(mockResolveOrCreate).not.toHaveBeenCalled()
  })

  it("rejects unknown visitorId in an otherwise valid token", async () => {
    const token = await mintToken({ orgId: ORG_A, widgetKey: WIDGET_KEY_A, visitorId: VISITOR_ID_A })
    mockFindVisitor.mockResolvedValue(undefined)

    const res = await POST(makeRequest({ token, content: "Unknown identity" }))
    expect(res.status).toBe(401)
    expect(mockResolveOrCreate).not.toHaveBeenCalled()
  })

  it("keeps tenant routing isolated across orgs", async () => {
    const tokenB = await mintToken({ orgId: ORG_B, widgetKey: WIDGET_KEY_B, visitorId: VISITOR_ID_B })
    mockFindVisitor.mockResolvedValue(
      visitorFixture({ id: VISITOR_ID_B, orgId: ORG_B, widgetKey: WIDGET_KEY_B }),
    )

    const res = await POST(makeRequest({ token: tokenB, content: "Hello B" }))
    expect(res.status).toBe(202)
    expect(mockResolveOrCreate.mock.calls[0][0].orgId).toBe(ORG_B)
    expect(mockResolveOrCreate.mock.calls[0][0].customerIdentifier).toEqual({ visitorId: VISITOR_ID_B })
  })
})
