/**
 * Cross-tenant leakage tests for POST /api/chat/intake.
 *
 * Verifies that:
 *   1. A valid JWT → 202, message routed to the token's org
 *   2. No token → 401 (no fallback to any body field)
 *   3. Tampered token (wrong signature) → 401
 *   4. Org A token + spoofed orgId in body → message STILL lands under Org A
 *   5. Two orgs, two widget keys — no cross-tenant leakage
 *   6. visitorSessionId from JWT wins over any caller-supplied value
 */

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

// ─── Mocks ─────────────────────────────────────────────────────────────────────
// vi.mock is hoisted — use vi.fn() inside the factory and access via vi.mocked().

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

import { resolveOrCreateIntake } from "@/lib/tickets/auto-intake"
import { isOrgChatAccepting } from "@/lib/realtime/event-bus"
import { POST } from "./route"

const mockResolveOrCreate = vi.mocked(resolveOrCreateIntake)
const mockIsOrgChatAccepting = vi.mocked(isOrgChatAccepting)

// ─── Constants ─────────────────────────────────────────────────────────────────

const AUTH_SECRET = "test-auth-secret-intake-leakage-test!!"
const ORG_A = "aaaa0000-0000-0000-0000-000000000001"
const ORG_B = "bbbb0000-0000-0000-0000-000000000002"
const WIDGET_KEY_A = "wk_org_a"
const WIDGET_KEY_B = "wk_org_b"
const SESSION_ID_A = "aaaa1111-0000-0000-0000-000000000001"
const SESSION_ID_B = "bbbb1111-0000-0000-0000-000000000002"

async function mintToken(opts: {
  orgId: string
  widgetKey: string
  visitorSessionId: string
  secret?: string
  expiry?: string
}): Promise<string> {
  const key = new TextEncoder().encode(opts.secret ?? AUTH_SECRET)
  return new SignJWT({
    orgId: opts.orgId,
    widgetKey: opts.widgetKey,
    visitorSessionId: opts.visitorSessionId,
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

function makeRequestWithAuthHeader(token: string, body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/chat/intake", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
  })
}

// ─── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.AUTH_SECRET = AUTH_SECRET
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
  mockLimit.mockReset().mockResolvedValue({ success: true, limit: 120, remaining: 119, reset: Date.now() + 1000 })
  mockIsOrgChatAccepting.mockResolvedValue(true)
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

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/chat/intake — tenant isolation", () => {
  // ── 1. Happy path: valid token in body ────────────────────────────────────
  it("accepts a valid JWT in the body field and routes to the token org", async () => {
    const token = await mintToken({ orgId: ORG_A, widgetKey: WIDGET_KEY_A, visitorSessionId: SESSION_ID_A })

    const res = await POST(makeRequest({ token, content: "Hello from Org A" }))

    expect(res.status).toBe(202)
    const body = await res.json() as { status: string; conversationId: string }
    expect(body.status).toBe("received")
    expect(body.conversationId).toBe("conv-001")

    expect(mockResolveOrCreate).toHaveBeenCalledOnce()
    const call = mockResolveOrCreate.mock.calls[0][0]
    expect(call.orgId).toBe(ORG_A)
  })

  // ── 2. Happy path: valid token in Authorization header ────────────────────
  it("accepts a valid JWT via Authorization Bearer header", async () => {
    const token = await mintToken({ orgId: ORG_A, widgetKey: WIDGET_KEY_A, visitorSessionId: SESSION_ID_A })

    const res = await POST(makeRequestWithAuthHeader(token, { content: "Hello via header" }))

    expect(res.status).toBe(202)
    expect(mockResolveOrCreate.mock.calls[0][0].orgId).toBe(ORG_A)
  })

  // ── 3. No token → 401, intake never called ────────────────────────────────
  it("returns 401 when no token is provided", async () => {
    const res = await POST(makeRequest({ content: "Unauthenticated message" }))

    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/missing session token/i)
    expect(mockResolveOrCreate).not.toHaveBeenCalled()
  })

  // ── 4. Tampered token (wrong secret) → 401 ────────────────────────────────
  it("returns 401 for a token signed with the wrong secret", async () => {
    const token = await mintToken({
      orgId: ORG_A,
      widgetKey: WIDGET_KEY_A,
      visitorSessionId: SESSION_ID_A,
      secret: "completely-wrong-secret-not-matching!!",
    })

    const res = await POST(makeRequest({ token, content: "Tampered" }))

    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/invalid or expired/i)
    expect(mockResolveOrCreate).not.toHaveBeenCalled()
  })

  // ── 5. Expired token → 401 ────────────────────────────────────────────────
  it("returns 401 for an expired token", async () => {
    // jose minimum expiry is 1s; sign with 1s and wait 1100ms
    const token = await mintToken({
      orgId: ORG_A,
      widgetKey: WIDGET_KEY_A,
      visitorSessionId: SESSION_ID_A,
      expiry: "1s",
    })
    await new Promise((r) => setTimeout(r, 1100))

    const res = await POST(makeRequest({ token, content: "Expired" }))

    expect(res.status).toBe(401)
    expect(mockResolveOrCreate).not.toHaveBeenCalled()
  })

  // ── 6. CORE: Cross-tenant spoofing ────────────────────────────────────────
  // Org A token + "orgId: ORG_B" in body → message MUST land under Org A.
  it("ignores body orgId and always routes by JWT org (Org A token, Org B in body)", async () => {
    const token = await mintToken({ orgId: ORG_A, widgetKey: WIDGET_KEY_A, visitorSessionId: SESSION_ID_A })

    const res = await POST(
      makeRequest({
        token,
        content: "Attacker payload",
        orgId: ORG_B,          // attacker-supplied — must be completely ignored
      })
    )

    expect(res.status).toBe(202)

    expect(mockResolveOrCreate).toHaveBeenCalledOnce()
    const { orgId } = mockResolveOrCreate.mock.calls[0][0]
    expect(orgId).toBe(ORG_A)
    expect(orgId).not.toBe(ORG_B)
  })

  // ── 7. Two-org isolation — separate tokens stay separate ─────────────────
  it("routes Org B messages under Org B when Org B token is used", async () => {
    const tokenB = await mintToken({ orgId: ORG_B, widgetKey: WIDGET_KEY_B, visitorSessionId: SESSION_ID_B })

    const res = await POST(makeRequest({ token: tokenB, content: "Hello from Org B" }))

    expect(res.status).toBe(202)
    const { orgId } = mockResolveOrCreate.mock.calls[0][0]
    expect(orgId).toBe(ORG_B)
    expect(orgId).not.toBe(ORG_A)
  })

  // ── 8. visitorSessionId from JWT wins over any caller-supplied value ──────
  it("uses visitorSessionId from JWT, ignoring any caller-supplied value", async () => {
    const token = await mintToken({ orgId: ORG_A, widgetKey: WIDGET_KEY_A, visitorSessionId: SESSION_ID_A })

    await POST(
      makeRequest({
        token,
        content: "Session spoofing attempt",
        visitorSessionId: "ffffffff-ffff-ffff-ffff-ffffffffffff",  // attacker-supplied
      })
    )

    expect(mockResolveOrCreate).toHaveBeenCalledOnce()
    const { customerIdentifier } = mockResolveOrCreate.mock.calls[0][0] as {
      customerIdentifier: { visitorSessionId: string }
    }
    expect(customerIdentifier.visitorSessionId).toBe(SESSION_ID_A)
    expect(customerIdentifier.visitorSessionId).not.toBe("ffffffff-ffff-ffff-ffff-ffffffffffff")
  })

  // ── 9. Missing content → 400 (schema runs regardless) ────────────────────
  it("returns 400 for missing content even when a token is present", async () => {
    const res = await POST(makeRequest({ token: "any.token.value" }))
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe("Invalid request")
    expect(mockResolveOrCreate).not.toHaveBeenCalled()
  })

  describe("Secondary Rate Limiting", () => {
    beforeEach(() => {
      process.env.UPSTASH_REDIS_REST_URL = "https://mock-redis.upstash.io"
      process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token"
    })

    afterEach(() => {
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN
    })

    it("rejects request on widgetKey-scoped rate limit failure", async () => {
      mockLimit.mockResolvedValueOnce({
        success: false,
        limit: 120,
        remaining: 0,
        reset: Date.now() + 5000,
      })

      const token = await mintToken({ orgId: ORG_A, widgetKey: WIDGET_KEY_A, visitorSessionId: SESSION_ID_A })
      const res = await POST(
        makeRequest({ token, content: "Rate-limited content attempt" })
      )

      expect(res.status).toBe(429)
      const body = await res.json() as { error: string }
      expect(body.error).toContain("Too many messages for this widget")
    })
  })
})
