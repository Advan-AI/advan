import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/chat/widget-session-auth", () => ({
  verifyWidgetSession: vi.fn(),
}))

vi.mock("@/lib/tickets/auto-intake", () => ({
  resolveOrCreateIntake: vi.fn(),
  createChatSession: vi.fn(),
}))

vi.mock("@/lib/email/parse-inbound", () => ({
  sanitizeInboundText: vi.fn((t: string) => t),
}))

vi.mock("@/lib/governance/pii-masker", () => ({
  PIIMasker: { mask: vi.fn((t: string) => t) },
}))

import { verifyWidgetSession } from "@/lib/chat/widget-session-auth"
import { resolveOrCreateIntake, createChatSession } from "@/lib/tickets/auto-intake"
import { POST } from "./route"

const mockVerify = vi.mocked(verifyWidgetSession)
const mockResolve = vi.mocked(resolveOrCreateIntake)
const mockCreate = vi.mocked(createChatSession)

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/chat/sessions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", authorization: "Bearer token" },
  })
}

describe("POST /api/chat/sessions", () => {
  beforeEach(() => {
    mockVerify.mockReset()
    mockResolve.mockReset()
    mockCreate.mockReset()

    mockVerify.mockResolvedValue({
      orgId: "org-a",
      visitorId: "visitor-a",
      widgetKey: "wk_a",
    })
    mockResolve.mockResolvedValue({
      ticketId: "ticket-1",
      conversationId: "conv-1",
      messageId: "msg-1",
      isNewTicket: true,
    })
    mockCreate.mockResolvedValue({ ticketId: "ticket-2", conversationId: "conv-2" })
  })

  it("creates new session with initial message using forceNew=true", async () => {
    const res = await POST(makeRequest({ displayName: "Alex", initialMessage: "Hello" }))

    expect(res.status).toBe(200)
    expect(mockResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org-a",
        customerIdentifier: { visitorId: "visitor-a" },
        forceNew: true,
        customerName: "Alex",
      })
    )
  })

  it("creates empty session when initialMessage is omitted", async () => {
    const res = await POST(makeRequest({ displayName: "Jamie" }))

    expect(res.status).toBe(200)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org-a",
        customerIdentifier: { visitorId: "visitor-a" },
        displayName: "Jamie",
      })
    )
    expect(mockResolve).not.toHaveBeenCalled()
  })

  it("rejects whitespace displayName with clear validation error", async () => {
    const res = await POST(makeRequest({ displayName: "   ", initialMessage: "Hello" }))

    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/displayname/i)
  })
})
