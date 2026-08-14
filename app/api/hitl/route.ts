import { NextRequest, NextResponse } from "next/server"
import { getEffectiveSession } from "@/lib/auth/effective-session"
import { db } from "@/lib/db"
import { hitlQueue } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { signalHITLDecision } from "@/lib/temporal/client"

/**
 * HITL (Human-in-the-Loop) REST endpoint.
 *
 * GET  /api/hitl?status=pending      — list pending HITL items for this org
 * POST /api/hitl                     — approve or reject a HITL item
 *
 * POST body:
 *   { id: string, action: "approve" | "reject", editedOutput?: string }
 *
 * On approval/rejection:
 * 1. Signals the Temporal workflow via hitlDecisionSignal
 * 2. Updates hitl_queue row status in Postgres
 */

export async function GET(req: NextRequest) {
  const session = await getEffectiveSession()
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const status = (searchParams.get("status") ?? "pending") as "pending" | "approved" | "rejected"

  const items = await db.query.hitlQueue.findMany({
    where: and(
      eq(hitlQueue.orgId, session.user.orgId),
      eq(hitlQueue.status, status)
    ),
    orderBy: (h, { desc }) => [desc(h.createdAt)],
    limit: 25,
  })

  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const session = await getEffectiveSession()
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { id: string; action: "approve" | "reject"; editedOutput?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { id, action, editedOutput } = body
  if (!id || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "id and action (approve|reject) required" }, { status: 400 })
  }

  // Find the HITL item
  const item = await db.query.hitlQueue.findFirst({
    where: and(eq(hitlQueue.id, id), eq(hitlQueue.orgId, session.user.orgId)),
  })

  if (!item) return NextResponse.json({ error: "HITL item not found" }, { status: 404 })
  if (item.status !== "pending") {
    return NextResponse.json({ error: `Item already ${item.status}` }, { status: 409 })
  }

  // Signal Temporal workflow if wired
  if (item.temporalWorkflowId) {
    try {
      await signalHITLDecision(item.temporalWorkflowId, {
        approved: action === "approve",
        editedOutput,
      })
    } catch (err) {
      console.warn("[HITL] Temporal signal failed (workflow may have expired):", err)
    }
  }

  // Update DB status
  await db
    .update(hitlQueue)
    .set({
      status: action === "approve" ? "approved" : "rejected",
      reviewedBy: session.user.id,
      resolvedAt: new Date(),
    })
    .where(eq(hitlQueue.id, id))

  return NextResponse.json({ success: true, action, id })
}
