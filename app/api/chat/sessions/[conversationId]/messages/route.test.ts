import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/chat/widget-session-auth", () => ({
  verifyWidgetSession: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      conversations: {
        findFirst: vi.fn(),
      },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              offset: vi.fn().mockResolvedValue([]),
            })),
          })),
        })),
      })),
    })),
  },
}))

import { verifyWidgetSession } from "@/lib/chat/widget-session-auth"
import { db } from "@/lib/db"
import { GET } from "./route"

const mockVerify = vi.mocked(verifyWidgetSession)
const mockFindConversation = vi.mocked(db.query.conversations.findFirst)

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/chat/sessions/conv-b/messages?page=0&limit=20", {
    headers: { authorization: "Bearer token" },
  })
}

describe("GET /api/chat/sessions/:conversationId/messages", () => {
  beforeEach(() => {
    mockVerify.mockResolvedValue({
      orgId: "org-a",
      visitorId: "visitor-a",
      widgetKey: "wk-a",
    })
  })

  it("returns 403 when visitor token does not own the target conversation", async () => {
    // Simulates visitor A requesting visitor B's valid conversationId.
    mockFindConversation.mockResolvedValue(undefined)

    const res = await GET(makeRequest(), {
      params: Promise.resolve({ conversationId: "conv-b" }),
    })

    expect(res.status).toBe(403)
  })

  it("returns message history for owned conversations", async () => {
    mockFindConversation.mockResolvedValue({ id: "conv-a" } as any)

    const res = await GET(makeRequest(), {
      params: Promise.resolve({ conversationId: "conv-a" }),
    })

    expect(res.status).toBe(200)
  })
})
