import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { jwtVerify } from "jose"
import { NextRequest } from "next/server"

// ─── DB mock ──────────────────────────────────────────────────────────────────
// The session route calls db.query.widgetConfigs.findFirst directly.
// vi.mock is hoisted before variable declarations, so we cannot reference a
// const inside the factory. Instead we return vi.fn() in the factory and
// obtain the typed reference via vi.mocked() after the import.

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      widgetConfigs: {
        findFirst: vi.fn(),
      },
    },
  },
}))

import { db } from "@/lib/db"
import { POST } from "./route"

// Typed reference to the mock for per-test setup.
const mockFindFirst = vi.mocked(db.query.widgetConfigs.findFirst)

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTH_SECRET = "test-auth-secret-for-widget-session!!"
const ORG_ID = "10000000-0000-0000-0000-000000000001"
const WIDGET_KEY = "wk_test_abc123"
const ALLOWED_ORIGIN = "https://example.com"
const EXISTING_SESSION_ID = "20000000-0000-0000-0000-000000000002"

function widgetConfigFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "30000000-0000-0000-0000-000000000003",
    orgId: ORG_ID,
    widgetKey: WIDGET_KEY,
    allowedOrigins: [ALLOWED_ORIGIN],
    preChatFormEnabled: true,
    brandingConfig: null,
    createdAt: new Date(),
    ...overrides,
  }
}

function makeRequest(
  body: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest("http://localhost/api/chat/session", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  })
}

async function decodeToken(token: string) {
  const key = new TextEncoder().encode(AUTH_SECRET)
  const { payload } = await jwtVerify(token, key, { issuer: "advan:chat-session" })
  return payload as {
    orgId: string
    widgetKey: string
    visitorSessionId: string
    exp: number
    iat: number
    iss: string
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.AUTH_SECRET = AUTH_SECRET
  // Disable Upstash so rate limiting is skipped in tests (no Redis connection).
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
  mockFindFirst.mockReset()
})

afterEach(() => {
  delete process.env.AUTH_SECRET
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/chat/session", () => {
  it("issues a valid JWT for a known widgetKey and allowed origin", async () => {
    mockFindFirst.mockResolvedValue(widgetConfigFixture())

    const res = await POST(makeRequest({ widgetKey: WIDGET_KEY, origin: ALLOWED_ORIGIN }))

    expect(res.status).toBe(200)
    const body = await res.json() as { token: string; visitorSessionId: string }
    expect(body.visitorSessionId).toBeTruthy()
    // Visually looks like a UUID
    expect(body.visitorSessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )

    // Token is verifiable and contains the expected claims.
    const decoded = await decodeToken(body.token)
    expect(decoded.orgId).toBe(ORG_ID)
    expect(decoded.widgetKey).toBe(WIDGET_KEY)
    expect(decoded.visitorSessionId).toBe(body.visitorSessionId)
    expect(decoded.iss).toBe("advan:chat-session")
    // 1-hour expiry: exp - iat should be exactly 3600 seconds.
    expect(decoded.exp - decoded.iat).toBe(3600)
  })

  it("rejects a request whose origin is not in allowedOrigins", async () => {
    mockFindFirst.mockResolvedValue(widgetConfigFixture())

    const res = await POST(
      makeRequest({ widgetKey: WIDGET_KEY, origin: "https://attacker.com" }),
    )

    expect(res.status).toBe(403)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/origin not allowed/i)
  })

  it("rejects a request whose origin is a superset/prefix of an allowed origin", async () => {
    // Ensures strict equality — "https://example.com.evil.io" must NOT match
    // an allowedOrigins entry of "https://example.com".
    mockFindFirst.mockResolvedValue(widgetConfigFixture())

    const res = await POST(
      makeRequest({
        widgetKey: WIDGET_KEY,
        origin: "https://example.com.evil.io",
      }),
    )

    expect(res.status).toBe(403)
  })

  it("returns 404 for an unknown widgetKey", async () => {
    mockFindFirst.mockResolvedValue(undefined)

    const res = await POST(
      makeRequest({ widgetKey: "wk_does_not_exist", origin: ALLOWED_ORIGIN }),
    )

    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/unknown widgetkey/i)
  })

  it("returns the same visitorSessionId when a valid UUID is passed (resume)", async () => {
    mockFindFirst.mockResolvedValue(widgetConfigFixture())

    const res = await POST(
      makeRequest({
        widgetKey: WIDGET_KEY,
        origin: ALLOWED_ORIGIN,
        visitorSessionId: EXISTING_SESSION_ID,
      }),
    )

    expect(res.status).toBe(200)
    const body = await res.json() as { token: string; visitorSessionId: string }
    // The session ID must be echoed back unchanged — not re-minted.
    expect(body.visitorSessionId).toBe(EXISTING_SESSION_ID)

    const decoded = await decodeToken(body.token)
    expect(decoded.visitorSessionId).toBe(EXISTING_SESSION_ID)
  })

  it("returns 400 for an invalid request body", async () => {
    const res = await POST(makeRequest({ widgetKey: "", origin: "not-a-url" }))
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe("Invalid request")
  })

  it("returns 400 when visitorSessionId is present but not a UUID", async () => {
    mockFindFirst.mockResolvedValue(widgetConfigFixture())

    const res = await POST(
      makeRequest({
        widgetKey: WIDGET_KEY,
        origin: ALLOWED_ORIGIN,
        visitorSessionId: "not-a-uuid",
      }),
    )

    // Schema rejects non-UUID visitorSessionId before hitting the DB.
    expect(res.status).toBe(400)
    expect(mockFindFirst).not.toHaveBeenCalled()
  })
})
