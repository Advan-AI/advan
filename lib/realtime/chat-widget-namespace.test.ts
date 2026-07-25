import { createServer, type Server as HttpServer } from "http"
import { AddressInfo } from "net"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { Server as SocketIOServer } from "socket.io"
import { connect as ioClient } from "socket.io-client"
import { SignJWT } from "jose"
import {
  CHAT_WIDGET_NAMESPACE,
  registerChatWidgetNamespace,
  type ChatWidgetDeps,
  widgetRoom,
} from "./chat-widget-namespace"

type ClientSocket = ReturnType<typeof ioClient>

const AUTH_SECRET = "test-secret-for-chat-widget-namespace-tests!!"
const ORG_ID = "10000000-0000-0000-0000-000000000001"
const WIDGET_KEY = "wk_test_abc"
const ALLOWED_ORIGIN = "http://localhost"
const VISITOR_ID = "20000000-0000-0000-0000-000000000002"
const CONVERSATION_ID = "30000000-0000-0000-0000-000000000003"

async function signToken(payload: Record<string, unknown>): Promise<string> {
  const key = new TextEncoder().encode(AUTH_SECRET)
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .setIssuer("advan:chat-session")
    .sign(key)
}

async function validToken(overrides: Record<string, unknown> = {}): Promise<string> {
  return signToken({
    orgId: ORG_ID,
    widgetKey: WIDGET_KEY,
    visitorId: VISITOR_ID,
    ...overrides,
  })
}

function makeDeps(overrides: Partial<ChatWidgetDeps> = {}): ChatWidgetDeps {
  return {
    findWidgetConfig: vi.fn().mockResolvedValue({ orgId: ORG_ID, allowedOrigins: [ALLOWED_ORIGIN] }),
    isConversationOwnedByVisitor: vi.fn().mockResolvedValue(true),
    processVisitorMessage: vi.fn().mockResolvedValue(undefined),
    findVisitor: vi.fn().mockResolvedValue({ id: VISITOR_ID }),
    clearOfflineDelivery: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

let activeDeps: ChatWidgetDeps = makeDeps()
const delegatingDeps: ChatWidgetDeps = {
  findWidgetConfig: (key) => activeDeps.findWidgetConfig(key),
  isConversationOwnedByVisitor: (input) => activeDeps.isConversationOwnedByVisitor(input),
  processVisitorMessage: (input) => activeDeps.processVisitorMessage(input),
  findVisitor: (input) => activeDeps.findVisitor(input),
  clearOfflineDelivery: (conversationId, orgId) => activeDeps.clearOfflineDelivery(conversationId, orgId),
}

let httpServer: HttpServer
let io: SocketIOServer
let port: number

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      httpServer = createServer()
      io = new SocketIOServer(httpServer, { cors: { origin: "*" } })
      registerChatWidgetNamespace(io, delegatingDeps)
      httpServer.listen(0, "127.0.0.1", () => {
        port = (httpServer.address() as AddressInfo).port
        resolve()
      })
    }),
  10_000,
)

afterAll(
  () =>
    new Promise<void>((resolve) => {
      io.close()
      httpServer.close(() => resolve())
    }),
  10_000,
)

beforeEach(() => {
  process.env.AUTH_SECRET = AUTH_SECRET
  activeDeps = makeDeps()
})

function connect(token: string): ClientSocket {
  return ioClient(`http://127.0.0.1:${port}${CHAT_WIDGET_NAMESPACE}`, {
    auth: { token },
    extraHeaders: { origin: ALLOWED_ORIGIN },
    transports: ["polling"],
    autoConnect: false,
    reconnection: false,
  } as unknown as Record<string, unknown>)
}

function waitFor<T>(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeoutMs)
    socket.once(event, (payload: T) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })
}

function expectNoEvent(socket: ClientSocket, event: string, timeoutMs = 350): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const onEvent = () => {
      clearTimeout(timer)
      reject(new Error(`Expected no ${event} event`))
    }
    const timer = setTimeout(() => {
      socket.off(event, onEvent)
      resolve()
    }, timeoutMs)
    socket.once(event, onEvent)
  })
}

describe("/chat-widget namespace explicit room membership", () => {
  it("does not receive before join, receives after join, and stops after leave", async () => {
    const ns = io.of(CHAT_WIDGET_NAMESPACE)
    const token = await validToken()

    const socket = connect(token)
    const ready = waitFor(socket, "session:ready")
    socket.connect()

    try {
      await ready

      ns.to(widgetRoom(CONVERSATION_ID)).emit("agent:message", {
        conversationId: CONVERSATION_ID,
        messageId: "m-before",
        content: "Before join",
      })
      await expectNoEvent(socket, "agent:message")

      socket.emit("join:conversation", { conversationId: CONVERSATION_ID })
      await waitFor(socket, "joined:conversation")

      const afterJoin = waitFor<{ messageId: string; content: string }>(socket, "agent:message")
      ns.to(widgetRoom(CONVERSATION_ID)).emit("agent:message", {
        conversationId: CONVERSATION_ID,
        messageId: "m-after",
        content: "After join",
      })
      const joinedPayload = await afterJoin
      expect(joinedPayload.messageId).toBe("m-after")
      expect(joinedPayload.content).toBe("After join")

      socket.emit("leave:conversation", { conversationId: CONVERSATION_ID })
      await waitFor(socket, "left:conversation")

      ns.to(widgetRoom(CONVERSATION_ID)).emit("agent:message", {
        conversationId: CONVERSATION_ID,
        messageId: "m-after-leave",
        content: "After leave",
      })
      await expectNoEvent(socket, "agent:message")
    } finally {
      socket.disconnect()
      delete process.env.AUTH_SECRET
    }
  })

  it("rejects join when conversation ownership check fails", async () => {
    activeDeps = makeDeps({
      isConversationOwnedByVisitor: vi.fn().mockResolvedValue(false),
    })

    const token = await validToken()
    const socket = connect(token)
    const ready = waitFor(socket, "session:ready")
    socket.connect()

    try {
      await ready
      socket.emit("join:conversation", { conversationId: CONVERSATION_ID })
      const err = await waitFor<{ code: string }>(socket, "error")
      expect(err.code).toBe("FORBIDDEN_CONVERSATION")
    } finally {
      socket.disconnect()
      delete process.env.AUTH_SECRET
    }
  })
})
