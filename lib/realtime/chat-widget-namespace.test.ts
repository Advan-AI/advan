/**
 * Tests for the /chat-widget Socket.IO namespace.
 *
 * Strategy: spin up a real in-process HTTP + Socket.IO server on an
 * ephemeral port, register the namespace with mock deps, connect via
 * socket.io-client, and assert events / rejections.
 *
 * No real DB or Redis connection is required — deps are fully injected.
 */

import { createServer, type Server as HttpServer } from "http"
import { AddressInfo } from "net"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { Server as SocketIOServer } from "socket.io"
import { connect as ioClient } from "socket.io-client"

/** Instance type of a connected socket.io-client socket. */
type ClientSocket = ReturnType<typeof ioClient>
import { SignJWT } from "jose"
import {
  registerChatWidgetNamespace,
  CHAT_WIDGET_NAMESPACE,
  widgetRoom,
  type ChatWidgetDeps,
} from "./chat-widget-namespace"

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTH_SECRET = "test-secret-for-chat-widget-namespace-tests!!"
const ORG_ID = "10000000-0000-0000-0000-000000000001"
const WIDGET_KEY = "wk_test_abc"
const ALLOWED_ORIGIN = "http://localhost"
const VISITOR_SESSION_ID = "20000000-0000-0000-0000-000000000002"
const CONVERSATION_ID = "30000000-0000-0000-0000-000000000003"

// ─── Token helpers ────────────────────────────────────────────────────────────

async function signToken(
  payload: Record<string, unknown>,
  opts: { secret?: string; expiry?: string } = {},
): Promise<string> {
  const key = new TextEncoder().encode(opts.secret ?? AUTH_SECRET)
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(opts.expiry ?? "1h")
    .setIssuer("advan:chat-session")
    .sign(key)
}

async function validToken(overrides: Record<string, unknown> = {}): Promise<string> {
  return signToken({
    orgId: ORG_ID,
    widgetKey: WIDGET_KEY,
    visitorSessionId: VISITOR_SESSION_ID,
    ...overrides,
  })
}

// ─── Deps factory ─────────────────────────────────────────────────────────────

function makeDeps(overrides: Partial<ChatWidgetDeps> = {}): ChatWidgetDeps {
  return {
    findWidgetConfig: vi.fn().mockResolvedValue({
      orgId: ORG_ID,
      allowedOrigins: [ALLOWED_ORIGIN],
    }),
    findConversationBySession: vi.fn().mockResolvedValue({ id: CONVERSATION_ID }),
    processVisitorMessage: vi.fn().mockResolvedValue(undefined),
    clearOfflineDelivery: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

// ─── Test server lifecycle ────────────────────────────────────────────────────
//
// The namespace is registered ONCE on the shared `io` instance. A mutable
// `activeDeps` delegate is swapped per test. This avoids the middleware-
// stacking problem that would occur if registerChatWidgetNamespace were called
// inside each test body.

let activeDeps: ChatWidgetDeps = makeDeps()

const delegatingDeps: ChatWidgetDeps = {
  findWidgetConfig: (k) => activeDeps.findWidgetConfig(k),
  findConversationBySession: (o, v) => activeDeps.findConversationBySession(o, v),
  processVisitorMessage: (i) => activeDeps.processVisitorMessage(i),
  clearOfflineDelivery: (c, o) => activeDeps.clearOfflineDelivery(c, o),
}

let httpServer: HttpServer
let io: SocketIOServer
let port: number

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      httpServer = createServer()
      io = new SocketIOServer(httpServer, {
        // Allow any origin for tests — namespace middleware enforces its own checks.
        cors: { origin: "*" },
      })
      // Register once with the delegating wrapper.
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

// ─── Client helper ────────────────────────────────────────────────────────────

function connect(
  token: string,
  opts: {
    conversationId?: string
    origin?: string
    badOriginHeader?: boolean
  } = {},
): ClientSocket {
  // `extraHeaders` is a valid engine.io / socket.io-client Node.js option for
  // setting HTTP headers on the upgrade request; the TS types don't surface it
  // in ManagerOptions for this version, so we cast through unknown.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ioClient(`http://127.0.0.1:${port}${CHAT_WIDGET_NAMESPACE}`, {
    auth: {
      token,
      ...(opts.conversationId ? { conversationId: opts.conversationId } : {}),
    },
    // The browser sets Origin automatically; in Node tests we set it explicitly
    // so the middleware's origin check can verify it.
    extraHeaders: {
      origin: opts.badOriginHeader ? "https://evil.example.com" : (opts.origin ?? ALLOWED_ORIGIN),
    },
    // Use polling for simpler teardown in tests (avoids WebSocket upgrade timing).
    transports: ["polling"],
    autoConnect: false,
    reconnection: false,
  } as unknown as Record<string, unknown>)
}

/**
 * Wait for an event or a timeout.
 * Resolves with the event payload, rejects on timeout.
 */
function waitFor<T>(
  socket: ClientSocket,
  event: string,
  timeoutMs = 3000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), timeoutMs)
    socket.once(event, (data: T) => {
      clearTimeout(timer)
      resolve(data)
    })
  })
}

/**
 * Attempt a connection; resolve with the connect_error message if auth fails,
 * reject (test failure) if the connection succeeds unexpectedly.
 */
function expectConnectionRejected(socket: ClientSocket, timeoutMs = 3000): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timeout: connection was not rejected")),
      timeoutMs,
    )
    socket.once("connect_error", (err: Error) => {
      clearTimeout(timer)
      resolve(err.message)
    })
    socket.once("connect", () => {
      clearTimeout(timer)
      reject(new Error("Expected connection to be rejected but it succeeded"))
    })
  })
}

// Disconnect all clients after each test.
afterEach(() => {
  // Nothing needed — each test manages its own socket lifecycle.
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("/chat-widget namespace", () => {
  describe("valid token — room join", () => {
    it("emits session:ready with conversationId after joining the room", async () => {
      process.env.AUTH_SECRET = AUTH_SECRET
      activeDeps = makeDeps()

      const token = await validToken()
      const socket = connect(token, { conversationId: CONVERSATION_ID })
      socket.connect()

      try {
        const payload = await waitFor<{
          conversationId: string
          visitorSessionId: string
        }>(socket, "session:ready")

        expect(payload.conversationId).toBe(CONVERSATION_ID)
        expect(payload.visitorSessionId).toBe(VISITOR_SESSION_ID)
      } finally {
        socket.disconnect()
        delete process.env.AUTH_SECRET
      }
    })

    it("resolves conversationId from DB on reconnect (no conversationId in auth)", async () => {
      process.env.AUTH_SECRET = AUTH_SECRET
      const spy = vi.fn().mockResolvedValue({ id: CONVERSATION_ID })
      activeDeps = makeDeps({ findConversationBySession: spy })

      const token = await validToken()
      // Do NOT pass conversationId — simulate reconnect from a fresh device.
      const socket = connect(token)
      socket.connect()

      try {
        const payload = await waitFor<{
          conversationId: string | null
          visitorSessionId: string
        }>(socket, "session:ready")

        // DB lookup resolved the conversation from the visitor session.
        expect(payload.conversationId).toBe(CONVERSATION_ID)
        expect(spy).toHaveBeenCalledWith(ORG_ID, VISITOR_SESSION_ID)
      } finally {
        socket.disconnect()
        delete process.env.AUTH_SECRET
      }
    })

    it("emits session:ready with null conversationId when no conversation exists yet", async () => {
      process.env.AUTH_SECRET = AUTH_SECRET
      activeDeps = makeDeps({
        findConversationBySession: vi.fn().mockResolvedValue(null),
      })

      const token = await validToken()
      const socket = connect(token) // no conversationId in auth
      socket.connect()

      try {
        const payload = await waitFor<{
          conversationId: string | null
          visitorSessionId: string
        }>(socket, "session:ready")

        expect(payload.conversationId).toBeNull()
      } finally {
        socket.disconnect()
        delete process.env.AUTH_SECRET
      }
    })

    it("delivers server-pushed agent:message to the joined room", async () => {
      process.env.AUTH_SECRET = AUTH_SECRET
      activeDeps = makeDeps()
      // Access the already-registered namespace via io.of()
      const ns = io.of(CHAT_WIDGET_NAMESPACE)

      const token = await validToken()
      const socket = connect(token, { conversationId: CONVERSATION_ID })
      socket.connect()

      // Wait until the socket has joined its room.
      await waitFor(socket, "session:ready")

      const agentMessagePromise = waitFor<{
        conversationId: string
        messageId: string
        content: string
      }>(socket, "agent:message")

      // Simulate a server-side agent:message broadcast (e.g. from Redis relay).
      ns.to(widgetRoom(CONVERSATION_ID)).emit("agent:message", {
        conversationId: CONVERSATION_ID,
        messageId: "msg-uuid-001",
        content: "Hi, how can I help you?",
      })

      const received = await agentMessagePromise

      expect(received.conversationId).toBe(CONVERSATION_ID)
      expect(received.messageId).toBe("msg-uuid-001")
      expect(received.content).toBe("Hi, how can I help you?")

      socket.disconnect()
      delete process.env.AUTH_SECRET
    })
  })

  describe("invalid / expired token — connection rejected", () => {
    it("rejects a connection with a missing token", async () => {
      process.env.AUTH_SECRET = AUTH_SECRET
      activeDeps = makeDeps()

      // Pass empty string as token — fails the "Missing auth token" check.
      const socket = connect("" as string)
      socket.connect()

      try {
        const errorMsg = await expectConnectionRejected(socket)
        expect(errorMsg).toMatch(/missing auth token/i)
      } finally {
        socket.disconnect()
        delete process.env.AUTH_SECRET
      }
    })

    it("rejects a connection with an expired token", async () => {
      process.env.AUTH_SECRET = AUTH_SECRET
      activeDeps = makeDeps()

      // exp: "0s" creates a token that is already expired.
      const expiredToken = await signToken(
        { orgId: ORG_ID, widgetKey: WIDGET_KEY, visitorSessionId: VISITOR_SESSION_ID },
        { expiry: "0s" },
      )
      const socket = connect(expiredToken)
      socket.connect()

      try {
        const errorMsg = await expectConnectionRejected(socket)
        expect(errorMsg).toMatch(/invalid or expired token/i)
      } finally {
        socket.disconnect()
        delete process.env.AUTH_SECRET
      }
    })

    it("rejects a connection signed with the wrong secret", async () => {
      process.env.AUTH_SECRET = AUTH_SECRET
      activeDeps = makeDeps()

      const wrongToken = await signToken(
        { orgId: ORG_ID, widgetKey: WIDGET_KEY, visitorSessionId: VISITOR_SESSION_ID },
        { secret: "completely-different-secret-value!!" },
      )
      const socket = connect(wrongToken)
      socket.connect()

      try {
        const errorMsg = await expectConnectionRejected(socket)
        expect(errorMsg).toMatch(/invalid or expired token/i)
      } finally {
        socket.disconnect()
        delete process.env.AUTH_SECRET
      }
    })

    it("rejects a connection whose origin is not in allowedOrigins", async () => {
      process.env.AUTH_SECRET = AUTH_SECRET
      activeDeps = makeDeps()

      const token = await validToken()
      // badOriginHeader sends "https://evil.example.com" as the Origin header.
      const socket = connect(token, { badOriginHeader: true })
      socket.connect()

      try {
        const errorMsg = await expectConnectionRejected(socket)
        expect(errorMsg).toMatch(/origin not allowed/i)
      } finally {
        socket.disconnect()
        delete process.env.AUTH_SECRET
      }
    })

    it("rejects a token whose widgetKey returns no config from DB", async () => {
      process.env.AUTH_SECRET = AUTH_SECRET
      activeDeps = makeDeps({
        findWidgetConfig: vi.fn().mockResolvedValue(null),
      })

      const token = await validToken({ widgetKey: "wk_unknown" })
      const socket = connect(token)
      socket.connect()

      try {
        const errorMsg = await expectConnectionRejected(socket)
        expect(errorMsg).toMatch(/unknown widgetkey/i)
      } finally {
        socket.disconnect()
        delete process.env.AUTH_SECRET
      }
    })
  })
})
