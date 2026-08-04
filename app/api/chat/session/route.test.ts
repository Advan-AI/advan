import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { jwtVerify } from "jose"
import { NextRequest } from "next/server"

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      widgetConfigs: {
        findFirst: vi.fn(),
      },
      visitors: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

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

import { db } from "@/lib/db"
import { POST } from "./route"

const mockFindWidget = vi.mocked(db.query.widgetConfigs.findFirst)
const mockFindVisitor = vi.mocked(db.query.visitors.findFirst)
const mockInsert = vi.mocked(db.insert)
const mockUpdate = vi.mocked(db.update)

const AUTH_SECRET = "test-auth-secret-for-widget-session!!"
const ORG_ID = "10000000-0000-0000-0000-000000000001"
const WIDGET_KEY = "wk_test_abc123"
const ALLOWED_ORIGIN = "https://example.com"
const EXISTING_VISITOR_ID = "20000000-0000-0000-0000-000000000002"

function widgetConfigFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "30000000-0000-0000-0000-000000000003",
    orgId: ORG_ID,
    widgetKey: WIDGET_KEY,
    allowedOrigins: [ALLOWED_ORIGIN],
    preChatFormEnabled: true,
    preChatQuestions: [],
    brandingConfig: null,
    createdAt: new Date(),
    ...overrides,
  }
}

function visitorFixture(id: string) {
  return {
    id,
    orgId: ORG_ID,
    widgetKey: WIDGET_KEY,
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
  }
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/chat/session", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
  })
}

async function decodeToken(token: string) {
  const key = new TextEncoder().encode(AUTH_SECRET)
  const { payload } = await jwtVerify(token, key, { issuer: "advan:chat-session" })
  return payload as {
    orgId: string
    widgetKey: string
    visitorId: string
    exp: number
    iat: number
    iss: string
  }
}

beforeEach(() => {
  process.env.AUTH_SECRET = AUTH_SECRET
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
  mockLimit.mockReset().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: Date.now() + 1000 })
  mockFindWidget.mockReset()
  mockFindVisitor.mockReset()
  mockInsert.mockReset()
  mockUpdate.mockReset()

  mockInsert.mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReturnType<typeof db.insert>)

  mockUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  } as unknown as ReturnType<typeof db.update>)
})

afterEach(() => {
  delete process.env.AUTH_SECRET
})

describe("POST /api/chat/session", () => {
  it("issues a valid JWT and creates a new visitor when visitorId is absent", async () => {
    mockFindWidget.mockResolvedValue(widgetConfigFixture())

    const res = await POST(makeRequest({ widgetKey: WIDGET_KEY, origin: ALLOWED_ORIGIN }))

    expect(res.status).toBe(200)
    const body = await res.json() as { token: string; visitorId: string }
    expect(body.visitorId).toMatch(/^[0-9a-f-]{36}$/i)

    const decoded = await decodeToken(body.token)
    expect(decoded.orgId).toBe(ORG_ID)
    expect(decoded.widgetKey).toBe(WIDGET_KEY)
    expect(decoded.visitorId).toBe(body.visitorId)
    expect(decoded.exp - decoded.iat).toBe(3600)

    expect(mockInsert).toHaveBeenCalledOnce()
  })

  it("reuses an existing visitorId scoped to widget+org and updates lastSeenAt", async () => {
    mockFindWidget.mockResolvedValue(widgetConfigFixture())
    mockFindVisitor.mockResolvedValue(visitorFixture(EXISTING_VISITOR_ID))

    const res = await POST(
      makeRequest({
        widgetKey: WIDGET_KEY,
        origin: ALLOWED_ORIGIN,
        visitorId: EXISTING_VISITOR_ID,
      }),
    )

    expect(res.status).toBe(200)
    const body = await res.json() as { token: string; visitorId: string }
    expect(body.visitorId).toBe(EXISTING_VISITOR_ID)

    const decoded = await decodeToken(body.token)
    expect(decoded.visitorId).toBe(EXISTING_VISITOR_ID)
    expect(mockUpdate).toHaveBeenCalledOnce()
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it("treats two browser starts with the same relayed visitorId as one visitor identity", async () => {
    mockFindWidget.mockResolvedValue(widgetConfigFixture())
    mockFindVisitor.mockResolvedValue(visitorFixture(EXISTING_VISITOR_ID))

    const first = await POST(
      makeRequest({ widgetKey: WIDGET_KEY, origin: ALLOWED_ORIGIN, visitorId: EXISTING_VISITOR_ID }),
    )
    const second = await POST(
      makeRequest({ widgetKey: WIDGET_KEY, origin: ALLOWED_ORIGIN, visitorId: EXISTING_VISITOR_ID }),
    )

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)

    const body1 = await first.json() as { visitorId: string }
    const body2 = await second.json() as { visitorId: string }
    expect(body1.visitorId).toBe(EXISTING_VISITOR_ID)
    expect(body2.visitorId).toBe(EXISTING_VISITOR_ID)
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalledTimes(2)
  })

  it("mints a new visitor when visitorId is unknown for the widget scope", async () => {
    mockFindWidget.mockResolvedValue(widgetConfigFixture())
    mockFindVisitor.mockResolvedValue(undefined)

    const res = await POST(
      makeRequest({
        widgetKey: WIDGET_KEY,
        origin: ALLOWED_ORIGIN,
        visitorId: EXISTING_VISITOR_ID,
      }),
    )

    expect(res.status).toBe(200)
    const body = await res.json() as { token: string; visitorId: string }
    expect(body.visitorId).toMatch(/^[0-9a-f-]{36}$/i)
    expect(body.visitorId).not.toBe(EXISTING_VISITOR_ID)
    expect(mockInsert).toHaveBeenCalledTimes(1)
  })

  it("rejects a request whose origin is not in allowedOrigins", async () => {
    mockFindWidget.mockResolvedValue(widgetConfigFixture())

    const res = await POST(
      makeRequest({ widgetKey: WIDGET_KEY, origin: "https://attacker.com" }),
    )

    expect(res.status).toBe(403)
  })

  it("returns 404 for unknown widgetKey", async () => {
    mockFindWidget.mockResolvedValue(undefined)

    const res = await POST(makeRequest({ widgetKey: "wk_unknown", origin: ALLOWED_ORIGIN }))

    expect(res.status).toBe(404)
  })

  it("returns 400 for invalid visitorId format", async () => {
    mockFindWidget.mockResolvedValue(widgetConfigFixture())

    const res = await POST(
      makeRequest({ widgetKey: WIDGET_KEY, origin: ALLOWED_ORIGIN, visitorId: "not-a-uuid" }),
    )

    expect(res.status).toBe(400)
    expect(mockFindWidget).not.toHaveBeenCalled()
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

    it("rejects request on IP-based rate limit failure", async () => {
      mockLimit.mockResolvedValueOnce({
        success: false,
        limit: 20,
        remaining: 0,
        reset: Date.now() + 5000,
      })

      const res = await POST(makeRequest({ widgetKey: WIDGET_KEY, origin: ALLOWED_ORIGIN }))
      expect(res.status).toBe(429)
    })

    it("rejects request on widgetKey-scoped rate limit failure", async () => {
      mockFindWidget.mockResolvedValue(widgetConfigFixture())
      mockLimit
        .mockResolvedValueOnce({ success: true, limit: 20, remaining: 19, reset: Date.now() })
        .mockResolvedValueOnce({ success: false, limit: 60, remaining: 0, reset: Date.now() + 5000 })

      const res = await POST(makeRequest({ widgetKey: WIDGET_KEY, origin: ALLOWED_ORIGIN }))
      expect(res.status).toBe(429)
    })
  })
})
