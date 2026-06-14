import { createServer } from "http"
import { Server as SocketIOServer } from "socket.io"
import { db } from "@/lib/db"
import { hitlQueue } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { signalHITLDecision } from "@/lib/temporal/client"
import {
  createSubscriber,
  HITL_NEW_CHANNEL,
  HITL_RESOLVED_CHANNEL,
  PIPELINE_STEP_CHANNEL,
  PIPELINE_RUN_FINISHED_CHANNEL,
} from "@/lib/realtime/event-bus"

/**
 * Socket.IO server for real-time HITL queue updates.
 *
 * Events emitted to the client:
 *   hitl:new      — a new item appeared in the queue     { item }
 *   hitl:resolved — an item was approved/rejected        { id, action, editedOutput? }
 *
 * Events received from client:
 *   hitl:approve  — { id, editedOutput? }
 *   hitl:reject   — { id }
 *
 * Mount in a standalone Node process (e.g. on Railway):
 *   npx tsx lib/realtime/socket-server.ts
 *
 * Or attach to the same HTTP server as Next.js in custom server mode.
 */

const PORT = parseInt(process.env.SOCKET_PORT ?? "3002", 10)

const httpServer = createServer()
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
})

io.on("connection", (socket) => {
  const orgId = socket.handshake.auth?.orgId as string | undefined

  if (!orgId) {
    socket.disconnect(true)
    return
  }

  // Join an org-scoped room so broadcasts are tenant-isolated
  socket.join(`org:${orgId}`)
  console.log(`[Socket] Client connected to org:${orgId} (${socket.id})`)

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

  socket.on("disconnect", () => {
    console.log(`[Socket] Client disconnected (${socket.id})`)
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
    (err) => {
    if (err) console.error("[Socket] Redis subscribe failed:", err.message)
    else console.log("[Socket] Subscribed to realtime event bus")
  })
  subscriber.on("message", (channel, raw) => {
    try {
      const msg = JSON.parse(raw) as { orgId: string; [k: string]: unknown }
      if (!msg.orgId) return
      const room = `org:${msg.orgId}`
      if (channel === HITL_NEW_CHANNEL) io.to(room).emit("hitl:new", { item: msg.item })
      else if (channel === HITL_RESOLVED_CHANNEL) io.to(room).emit("hitl:resolved", msg)
      else if (channel === PIPELINE_STEP_CHANNEL) io.to(room).emit("pipeline:step", msg)
      else if (channel === PIPELINE_RUN_FINISHED_CHANNEL) io.to(room).emit("pipeline:run:finished", msg)
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
