import { createServer } from "http"
import { Server as SocketIOServer } from "socket.io"
import { db } from "@/lib/db"
import { conversations, hitlQueue } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { signalHITLDecision } from "@/lib/temporal/client"
import {
  createSubscriber,
  HITL_NEW_CHANNEL,
  HITL_RESOLVED_CHANNEL,
  PIPELINE_STEP_CHANNEL,
  PIPELINE_RUN_FINISHED_CHANNEL,
  CHAT_AGENT_REPLY_CHANNEL,
  CHAT_TRIAGE_PENDING_CHANNEL,
  CUSTOMER_MESSAGE_CHANNEL,
  trackAgentOnline,
  trackAgentOffline,
} from "@/lib/realtime/event-bus"
import {
  registerChatWidgetNamespace,
  buildProductionChatWidgetDeps,
  widgetRoom,
  widgetOrgRoom,
  CHAT_WIDGET_NAMESPACE,
} from "@/lib/realtime/chat-widget-namespace"
import { requireIntEnv } from "@/lib/env/required"

/**
 * Socket.IO server for real-time HITL queue updates and chat visitor events.
 *
 * Two connection modes:
 *
 *   Agent/reviewer:  handshake.auth = { orgId }
 *     Joins room "org:{orgId}". Receives hitl:new, hitl:resolved,
 *     pipeline:step, pipeline:run:finished.
 *
 *   Chat visitor:    handshake.auth = { conversationId, orgId }
 *     The conversationId + orgId pair is verified against the DB before
 *     admission. Joins room "conversation:{conversationId}". Receives:
 *       chat:agent_reply    — { conversationId, messageId, content }
 *       chat:triage_pending — { conversationId, priority }
 *
 * Events emitted to the agent room:
 *   hitl:new      — a new item appeared in the queue     { item }
 *   hitl:resolved — an item was approved/rejected        { id, action, editedOutput? }
 *
 * Events received from agent client:
 *   hitl:approve  — { id, editedOutput? }
 *   hitl:reject   — { id }
 *
 * Mount in a standalone Node process (e.g. on Railway):
 *   npx tsx lib/realtime/socket-server.ts
 *
 * Or attach to the same HTTP server as Next.js in custom server mode.
 */

const PORT = requireIntEnv("SOCKET_PORT", process.env, { min: 1 })

const socketOrigins = (
  process.env.SOCKET_CORS_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? []
)

if (socketOrigins.length === 0) {
  const authUrl = process.env.AUTH_URL?.trim()
  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim()
  if (authUrl) socketOrigins.push(authUrl)
  if (nextAuthUrl) socketOrigins.push(nextAuthUrl)
}

if (socketOrigins.length === 0) {
  throw new Error("Missing socket CORS configuration. Set SOCKET_CORS_ORIGINS or AUTH_URL/NEXTAUTH_URL.")
}

const httpServer = createServer()
const io = new SocketIOServer(httpServer, {
  cors: {
    // Agents load from the Next app origin. Allow common local variants so
    // dashboard alerts work whether the user opens localhost or 127.0.0.1.
    // /chat-widget namespace still enforces per-widgetKey origin allowlists.
    origin: socketOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
})

// ── /chat-widget namespace ────────────────────────────────────────────────────
// Mounted immediately — deps are async-loaded lazily inside the factory so the
// server starts even if DB isn't ready yet (deps are called per-connection).
let chatWidgetNs: ReturnType<typeof registerChatWidgetNamespace> | null = null

buildProductionChatWidgetDeps().then((deps) => {
  chatWidgetNs = registerChatWidgetNamespace(io, deps)
  console.log(`[Socket] /chat-widget namespace registered`)
}).catch((err) => {
  console.error("[Socket] Failed to register /chat-widget namespace:", (err as Error).message)
})

io.on("connection", async (socket) => {
  const orgId = socket.handshake.auth?.orgId as string | undefined
  const conversationId = socket.handshake.auth?.conversationId as string | undefined

  if (!orgId) {
    socket.disconnect(true)
    return
  }

  // ── Chat visitor mode ────────────────────────────────────────────────────
  // When a conversationId is supplied, verify ownership then admit the visitor
  // into a conversation-scoped room. This keeps agent events out of visitor
  // sockets and visitor rooms isolated per conversation (tenant-safe).
  if (conversationId) {
    const conv = await db.query.conversations.findFirst({
      where: and(eq(conversations.id, conversationId), eq(conversations.orgId, orgId)),
    }).catch(() => null)

    if (!conv) {
      console.warn(`[Socket] Visitor rejected — conversation ${conversationId} not found in org ${orgId}`)
      socket.disconnect(true)
      return
    }

    socket.join(`conversation:${conversationId}`)
    console.log(`[Socket] Visitor joined conversation:${conversationId} (${socket.id})`)

    socket.on("disconnect", () => {
      console.log(`[Socket] Visitor disconnected from conversation:${conversationId} (${socket.id})`)
    })
    return
  }

  // ── Agent/reviewer mode ──────────────────────────────────────────────────
  // Join an org-scoped room so broadcasts are tenant-isolated
  socket.join(`org:${orgId}`)
  console.log(`[Socket] Agent connected to org:${orgId} (${socket.id})`)

  // Stamp presence in Redis so Next.js app can answer availability checks
  // cross-process (GET /api/chat/availability reads this key).
  trackAgentOnline(orgId, socket.id).catch(() => {/* non-fatal */})

  // Notify visitors that an agent just came online.
  if (chatWidgetNs) {
    const count = io.sockets.adapter.rooms.get(`org:${orgId}`)?.size ?? 1
    chatWidgetNs.to(widgetOrgRoom(orgId)).emit("presence:agent-online", {
      online: true,
      count,
    })
  }

  // ── hitl:approve ────────────────────────────────────────────────────────
  socket.on(
    "hitl:approve",
    async (data: { id: string; editedOutput?: string }) => {
      await resolveHITL(orgId, data.id, "approve", data.editedOutput)
      io.to(`org:${orgId}`).emit("hitl:resolved", {
        id: data.id,
        action: "approve",
        editedOutput: data.editedOutput,
      })
    }
  )

  // ── hitl:reject ─────────────────────────────────────────────────────────
  socket.on("hitl:reject", async (data: { id: string }) => {
    await resolveHITL(orgId, data.id, "reject")
    io.to(`org:${orgId}`).emit("hitl:resolved", { id: data.id, action: "reject" })
  })

  // ── agent typing → visitor ───────────────────────────────────────────────
  // Dashboard agent emits these so the widget can show "Agent is typing…".
  // Ephemeral — never persisted.
  socket.on("agent:typing:start", (data: { conversationId: string }) => {
    if (!data?.conversationId || !chatWidgetNs) return
    chatWidgetNs.to(widgetRoom(data.conversationId)).emit("typing:start", { role: "agent" })
  })

  socket.on("agent:typing:stop", (data: { conversationId: string }) => {
    if (!data?.conversationId || !chatWidgetNs) return
    chatWidgetNs.to(widgetRoom(data.conversationId)).emit("typing:stop", { role: "agent" })
  })

  socket.on("disconnect", () => {
    console.log(`[Socket] Agent disconnected (${socket.id})`)
    // Remove from Redis presence SET (non-fatal).
    trackAgentOffline(orgId, socket.id).catch(() => {/* non-fatal */})
    // Notify visitors of remaining agent count (0 = offline).
    const agentRoomSize = io.sockets.adapter.rooms.get(`org:${orgId}`)?.size ?? 0
    if (chatWidgetNs) {
      chatWidgetNs.to(widgetOrgRoom(orgId)).emit("presence:agent-online", {
        online: agentRoomSize > 0,
        count: agentRoomSize,
      })
    }
  })
})

async function resolveHITL(
  orgId: string,
  id: string,
  action: "approve" | "reject",
  editedOutput?: string
) {
  const item = await db.query.hitlQueue.findFirst({
    where: and(eq(hitlQueue.id, id), eq(hitlQueue.orgId, orgId)),
  })

  if (!item || item.status !== "pending") return

  if (item.temporalWorkflowId) {
    try {
      await signalHITLDecision(item.temporalWorkflowId, {
        approved: action === "approve",
        editedOutput,
      })
    } catch (err) {
      console.warn("[Socket] Temporal signal failed:", err)
    }
  }

  await db
    .update(hitlQueue)
    .set({ status: action === "approve" ? "approved" : "rejected", resolvedAt: new Date() })
    .where(eq(hitlQueue.id, id))
}

/**
 * Exported helper so the Next.js API layer can broadcast new HITL items
 * when the Temporal workflow creates them (in-process fallback).
 */
export function broadcastHITLNew(orgId: string, item: unknown) {
  io.to(`org:${orgId}`).emit("hitl:new", { item })
}

// ── Cross-process fan-out via Redis pub/sub ─────────────────────────────────
// HITL items / pipeline steps are produced by the Next.js app process; relay
// them to connected Socket.IO clients regardless of which process emitted them.
const subscriber = createSubscriber()
if (subscriber) {
  subscriber.subscribe(
    HITL_NEW_CHANNEL,
    HITL_RESOLVED_CHANNEL,
    PIPELINE_STEP_CHANNEL,
    PIPELINE_RUN_FINISHED_CHANNEL,
    CHAT_AGENT_REPLY_CHANNEL,
    CHAT_TRIAGE_PENDING_CHANNEL,
    CUSTOMER_MESSAGE_CHANNEL,
    (err) => {
    if (err) console.error("[Socket] Redis subscribe failed:", err.message)
    else console.log("[Socket] Subscribed to realtime event bus")
  })
  subscriber.on("message", (channel, raw) => {
    try {
      const msg = JSON.parse(raw) as { orgId: string; conversationId?: string; [k: string]: unknown }
      if (!msg.orgId) return

      const orgRoom = `org:${msg.orgId}`

      if (channel === HITL_NEW_CHANNEL) {
        io.to(orgRoom).emit("hitl:new", { item: msg.item })
      } else if (channel === HITL_RESOLVED_CHANNEL) {
        io.to(orgRoom).emit("hitl:resolved", msg)
      } else if (channel === PIPELINE_STEP_CHANNEL) {
        io.to(orgRoom).emit("pipeline:step", msg)
      } else if (channel === PIPELINE_RUN_FINISHED_CHANNEL) {
        io.to(orgRoom).emit("pipeline:run:finished", msg)
      } else if (channel === CHAT_AGENT_REPLY_CHANNEL && msg.conversationId) {
        // Relay agent auto-reply to the legacy visitor conversation room (default ns).
        io.to(`conversation:${msg.conversationId}`).emit("chat:agent_reply", {
          conversationId: msg.conversationId,
          messageId: msg.messageId,
          content: msg.content,
        })
        // Also relay as agent:message to the /chat-widget namespace.
        chatWidgetNs?.to(widgetRoom(msg.conversationId as string)).emit("agent:message", {
          conversationId: msg.conversationId,
          messageId: msg.messageId,
          content: msg.content,
        })
      } else if (channel === CHAT_TRIAGE_PENDING_CHANNEL && msg.conversationId) {
        // Relay "an agent will respond shortly" to the legacy visitor room (default ns).
        io.to(`conversation:${msg.conversationId}`).emit("chat:triage_pending", {
          conversationId: msg.conversationId,
          priority: msg.priority,
        })
        // Also relay triage:pending to the /chat-widget namespace.
        chatWidgetNs?.to(widgetRoom(msg.conversationId as string)).emit("triage:pending", {
          conversationId: msg.conversationId,
          priority: msg.priority,
        })
      } else if (channel === CUSTOMER_MESSAGE_CHANNEL && msg.conversationId) {
        io.to(orgRoom).emit("customer:message", {
          conversationId: msg.conversationId,
          messageId: msg.messageId,
          channel: msg.channel,
          content: msg.content,
          customerName: msg.customerName,
          customerEmail: msg.customerEmail,
        })
      }
    } catch {
      /* malformed payload — ignore */
    }
  })
} else {
  console.warn("[Socket] REDIS_URL not set — cross-process fan-out disabled (single-process only)")
}

httpServer.listen(PORT, () => {
  console.log(`[Socket] HITL Socket.IO server running on port ${PORT}`)
})

export { io }
