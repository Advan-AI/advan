/**
 * /chat-widget Socket.IO namespace.
 *
 * Extends the existing Socket.IO server — no second process is required.
 * Visitors connect here to send messages and receive real-time replies.
 *
 * Connection flow:
 *   1. Widget calls POST /api/chat/session → receives { token, visitorId }.
 *   2. Widget calls POST /api/chat/intake  → receives { conversationId }.
 *   3. Widget connects here with handshake.auth = { token }.
 *   4. Middleware verifies the JWT and re-checks the Origin header against
 *      widget_configs.allowedOrigins (separate trust boundary from the HTTP check).
 *   5. On connect, visitor joins widgetOrgRoom(orgId) only.
 *   6. Client explicitly emits join:conversation with a selected conversationId.
 *
 * Events (server → visitor):
 *   session:ready         { visitorId: string }
 *   joined:conversation   { conversationId: string }
 *   left:conversation     { conversationId: string }
 *   agent:message         { conversationId, messageId, content }
 *   triage:pending        { conversationId, priority }
 *   typing:start          { role: "agent" }
 *   typing:stop           { role: "agent" }
 *   presence:agent-online { online: boolean }
 *   error                 { code: string }
 *
 * Events (server → agent org room, in default namespace):
 *   visitor:online        { conversationId: string }  — visitor widget connected
 *   visitor:offline       { conversationId: string }  — visitor widget disconnected
 *   visitor:typing:start  { conversationId, visitorId }
 *   visitor:typing:stop   { conversationId, visitorId }
 *
 * Events (visitor → server):
 *   visitor:message  { conversationId: string, content: string }
 *   typing:start     (no payload — visitor is typing)
 *   typing:stop      (no payload — visitor stopped typing)
 */

import { verifyWidgetToken, type WidgetTokenPayload } from "@/lib/chat/verify-widget-token"
import type { Namespace, Server as SocketIOServer } from "socket.io"

export const CHAT_WIDGET_NAMESPACE = "/chat-widget"

/** Conversation-scoped room inside the widget namespace. */
export function widgetRoom(conversationId: string): string {
  return `widget:${conversationId}`
}

/**
 * Org-scoped room inside the widget namespace.
 * Used for presence:agent-online broadcasts so a single server-side emit
 * reaches all visitors for that org without iterating individual rooms.
 */
export function widgetOrgRoom(orgId: string): string {
  return `widget-org:${orgId}`
}

// ─── Deps interface ───────────────────────────────────────────────────────────

/**
 * Externally injectable deps so tests can stub DB/intake without vi.mock.
 * Production callers pass `productionChatWidgetDeps(io)`.
 */
export interface ChatWidgetDeps {
  /**
   * Look up widget_configs by widgetKey.
   * Returns only the fields needed for auth — null if not found.
   */
  findWidgetConfig(widgetKey: string): Promise<{
    orgId: string
    allowedOrigins: string[]
  } | null>

  /** True when conversationId belongs to this visitor+org scope. */
  isConversationOwnedByVisitor(input: {
    orgId: string
    visitorId: string
    conversationId: string
  }): Promise<boolean>

  /**
   * Route a visitor message through the intake pipeline (creates/threads
   * the ticket + conversation if not already done by the client call).
   */
  processVisitorMessage(input: {
    orgId: string
    visitorId: string
    conversationId: string
    content: string
  }): Promise<void>

  /** Verifies the visitor identity is still valid for org+widget scope. */
  findVisitor(input: { orgId: string; widgetKey: string; visitorId: string }): Promise<{ id: string } | null>

  /**
   * Clear the chatOfflineDelivery flag so subsequent agent replies are
   * delivered via Socket.IO rather than email.
   *
   * Called when the visitor reconnects with at least one agent online —
   * switching the conversation back to live delivery without requiring any
   * state stored in the browser.
   */
  clearOfflineDelivery(conversationId: string, orgId: string): Promise<void>
}

// ─── JWT verification (shared with POST /api/chat/intake) ────────────────────
// verifyWidgetToken and WidgetTokenPayload are imported from lib/chat/verify-widget-token.ts

// ─── Internal socket data ─────────────────────────────────────────────────────

interface SocketData {
  orgId: string
  widgetKey: string
  visitorId: string
  /** Active conversation selected by the visitor in this socket session. */
  conversationId?: string
}

// ─── Namespace registration ───────────────────────────────────────────────────

/**
 * Register the /chat-widget namespace on an existing Socket.IO server instance.
 * Call once at server startup after creating `io`.
 *
 * @returns The namespace handle — retain it to relay server-pushed events
 *          (e.g. agent:message from Redis pub/sub).
 */
export function registerChatWidgetNamespace(
  io: SocketIOServer,
  deps: ChatWidgetDeps,
): Namespace {
  const ns = io.of(CHAT_WIDGET_NAMESPACE)

  // ── Auth + origin middleware ───────────────────────────────────────────────
  // This runs before the "connection" event, giving us a clean rejection path
  // that never emits any room events to unauthenticated sockets.
  ns.use(async (socket, next) => {
    // 1. Verify JWT signed by POST /api/chat/session.
    const rawToken = socket.handshake.auth?.token as string | undefined
    if (!rawToken) return next(new Error("Missing auth token"))

    let tokenPayload: WidgetTokenPayload
    try {
      tokenPayload = await verifyWidgetToken(rawToken)
    } catch {
      // Covers expired, malformed, wrong-issuer, wrong-key tokens.
      return next(new Error("Invalid or expired token"))
    }

    // 2. Origin re-check at the socket handshake level.
    //
    //    HTTP-level origin checks (POST /api/chat/session) and socket-level
    //    checks are different trust boundaries. A client could obtain a valid
    //    token via an allowed origin and then open a WebSocket from a different
    //    origin — re-checking here closes that window.
    //
    //    The origin header is set by the browser on WebSocket upgrade; it is
    //    not forgeable by client-side JS in a same-origin context.
    //
    //    The widget iframe is always loaded from the app's own origin (we serve
    //    it at /chat-widget-frame).  Therefore the WebSocket handshake origin is
    //    the app URL — not the embedding customer site — and we must allow it in
    //    addition to the widgetConfigs.allowedOrigins list.
    const origin = socket.handshake.headers.origin
    if (!origin) return next(new Error("Missing origin"))

    let config: { orgId: string; allowedOrigins: string[] } | null
    try {
      config = await deps.findWidgetConfig(tokenPayload.widgetKey)
    } catch (err) {
      console.error("[ChatWidget] Config lookup error:", (err as Error).message)
      return next(new Error("Config lookup failed"))
    }

    if (!config) return next(new Error("Unknown widgetKey"))

    // Normalise the app's own URL for comparison: strip trailing slash.
    const rawAppOrigin = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? ""
    const appOrigin = rawAppOrigin.replace(/\/$/, "")

    // Allow the origin when it is:
    //   a) in the widgetConfigs.allowedOrigins list (direct/non-iframe embeds), OR
    //   b) the app's own origin (the iframe connecting from /chat-widget-frame).
    const isAllowed =
      config.allowedOrigins.includes(origin) ||
      (appOrigin !== "" && origin === appOrigin)

    if (!isAllowed) {
      return next(new Error("Origin not allowed"))
    }

    // 3. Confirm token orgId matches the DB record — prevents replay if a
    //    widgetKey is re-assigned to a different org after the token was issued.
    if (tokenPayload.orgId !== config.orgId) {
      return next(new Error("orgId mismatch"))
    }

    const visitor = await deps
      .findVisitor({
        orgId: tokenPayload.orgId,
        widgetKey: tokenPayload.widgetKey,
        visitorId: tokenPayload.visitorId,
      })
      .catch(() => null)

    if (!visitor) {
      return next(new Error("Unknown visitor identity"))
    }

    socket.data = {
      orgId: tokenPayload.orgId,
      widgetKey: tokenPayload.widgetKey,
      visitorId: tokenPayload.visitorId,
    } satisfies SocketData

    next()
  })

  // ── Connection handler ────────────────────────────────────────────────────
  ns.on("connection", async (socket) => {
    const { orgId, visitorId } = socket.data as SocketData

    // Org room: used for server-side presence broadcasts.
    socket.join(widgetOrgRoom(orgId))

    // Inform the client of its resolved session state.
    socket.emit("session:ready", {
      visitorId,
    })

    // Emit initial agent presence using the default namespace's org room.
    // fetchSockets() is async but best-effort — fall back to offline on error.
    let agentsOnline = false
    try {
      const agentSockets = await io.in(`org:${orgId}`).fetchSockets()
      const count = agentSockets.length
      agentsOnline = count > 0
      socket.emit("presence:agent-online", { online: agentsOnline, count })
    } catch {
      socket.emit("presence:agent-online", { online: false, count: 0 })
    }


    socket.on("join:conversation", async (data: { conversationId: string }) => {
      const requestedConversationId = data?.conversationId?.trim()
      if (!requestedConversationId) {
        socket.emit("error", { code: "INVALID_CONVERSATION" })
        return
      }

      const owned = await deps
        .isConversationOwnedByVisitor({
          orgId,
          visitorId,
          conversationId: requestedConversationId,
        })
        .catch(() => false)

      if (!owned) {
        socket.emit("error", { code: "FORBIDDEN_CONVERSATION" })
        return
      }

      const previous = (socket.data as SocketData).conversationId
      if (previous && previous !== requestedConversationId) {
        socket.leave(widgetRoom(previous))
      }

      socket.join(widgetRoom(requestedConversationId))
      socket.data.conversationId = requestedConversationId
      socket.emit("joined:conversation", { conversationId: requestedConversationId })
      io.to(`org:${orgId}`).emit("visitor:online", { conversationId: requestedConversationId })

      if (agentsOnline) {
        deps.clearOfflineDelivery(requestedConversationId, orgId).catch((err) => {
          console.warn("[ChatWidget] clearOfflineDelivery failed:", (err as Error).message)
        })
      }
    })

    socket.on("leave:conversation", (data: { conversationId: string }) => {
      const requestedConversationId = data?.conversationId?.trim()
      if (!requestedConversationId) return

      socket.leave(widgetRoom(requestedConversationId))
      if ((socket.data as SocketData).conversationId === requestedConversationId) {
        delete (socket.data as SocketData).conversationId
      }

      socket.emit("left:conversation", { conversationId: requestedConversationId })
      io.to(`org:${orgId}`).emit("visitor:offline", { conversationId: requestedConversationId })
    })

    // ── visitor:message ──────────────────────────────────────────────────
    socket.on(
      "visitor:message",
      async (data: { conversationId: string; content: string }) => {
        const activeConversationId = (socket.data as SocketData).conversationId
        if (!activeConversationId || !data?.content?.trim()) return
        try {
          await deps.processVisitorMessage({
            orgId,
            visitorId,
            conversationId: activeConversationId,
            content: data.content,
          })
          // Dashboard alerts are published from resolveOrCreateIntake via Redis
          // (customer:message). Do not also emit visitor:message here — that
          // caused duplicate toasts when both paths fired.
        } catch (err) {
          console.error("[ChatWidget] visitor:message error:", (err as Error).message)
          socket.emit("error", { code: "MESSAGE_FAILED" })
        }
      },
    )

    // ── typing:start / typing:stop (visitor → agents) ────────────────────
    // Relay visitor typing signals to the org room in the default namespace
    // so dashboard agents can display a "visitor is typing" indicator.
    // These are ephemeral — never persisted.
    socket.on("typing:start", () => {
      const cid = (socket.data as SocketData).conversationId
      if (!cid) return
      io.to(`org:${orgId}`).emit("visitor:typing:start", {
        conversationId: cid,
        visitorId,
      })
    })

    socket.on("typing:stop", () => {
      const cid = (socket.data as SocketData).conversationId
      if (!cid) return
      io.to(`org:${orgId}`).emit("visitor:typing:stop", {
        conversationId: cid,
        visitorId,
      })
    })

    socket.on("disconnect", () => {
      console.log(`[ChatWidget] Visitor disconnected (${socket.id}) org:${orgId} visitor:${visitorId}`)
      // Notify the agent dashboard that this visitor has gone offline.
      const cid = (socket.data as SocketData).conversationId
      if (cid) {
        io.to(`org:${orgId}`).emit("visitor:offline", { conversationId: cid })
      }
    })
  })

  return ns
}

// ─── Production deps factory ──────────────────────────────────────────────────

/**
 * Build production deps wired to the real Drizzle DB and auto-intake pipeline.
 * Called once in socket-server.ts after `io` is created.
 *
 * Lazy-imports DB and intake to keep this module importable in test environments
 * that mock those modules separately.
 */
export async function buildProductionChatWidgetDeps(): Promise<ChatWidgetDeps> {
  const { db } = await import("@/lib/db")
  const { widgetConfigs, conversations, visitors } = await import("@/lib/db/schema")
  const { eq, and } = await import("drizzle-orm")
  const { resolveOrCreateIntake } = await import("@/lib/tickets/auto-intake")
  const { isConversationOwnedByVisitor } = await import("@/lib/chat/conversation-ownership")

  return {
    async findWidgetConfig(widgetKey) {
      const row = await db.query.widgetConfigs.findFirst({
        where: eq(widgetConfigs.widgetKey, widgetKey),
        columns: { orgId: true, allowedOrigins: true },
      })
      if (!row) return null
      return { orgId: row.orgId, allowedOrigins: row.allowedOrigins as string[] }
    },

    async isConversationOwnedByVisitor({ orgId, visitorId, conversationId }) {
      return isConversationOwnedByVisitor({ orgId, visitorId, conversationId })
    },

    async processVisitorMessage({ orgId, visitorId, conversationId, content }) {
      // Sanitize visitor-authored content before storage.
      // Chat widgets carry the same XSS risk as inbound email: user-supplied
      // text can contain HTML that would be rendered by the dashboard UI.
      // Apply the same two-pass sanitization the email inbound path uses:
      //   1. sanitizeInboundText — strips all HTML tags (plain-text context)
      //   2. PIIMasker.mask     — redacts emails, phones, card numbers, SSNs
      const { sanitizeInboundText } = await import("@/lib/email/parse-inbound")
      const { PIIMasker } = await import("@/lib/governance/pii-masker")
      const sanitized = PIIMasker.mask(sanitizeInboundText(content))

      await resolveOrCreateIntake({
        orgId,
        channel: "chat",
        customerIdentifier: { visitorId },
        content: sanitized,
        conversationId,
      })
    },

    async findVisitor({ orgId, widgetKey, visitorId }) {
      const row = await db.query.visitors.findFirst({
        where: and(
          eq(visitors.id, visitorId),
          eq(visitors.orgId, orgId),
          eq(visitors.widgetKey, widgetKey),
        ),
        columns: { id: true },
      })
      return row ?? null
    },

    async clearOfflineDelivery(conversationId, orgId) {
      // Guard: only update if the flag is currently set to avoid spurious writes.
      await db
        .update(conversations)
        .set({ chatOfflineDelivery: false })
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.orgId, orgId),
            eq(conversations.chatOfflineDelivery, true),
          ),
        )
    },
  }
}
