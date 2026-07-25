import { NextRequest, NextResponse } from "next/server"
import { and, desc, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { verifyWidgetSession } from "@/lib/chat/widget-session-auth"
import { db } from "@/lib/db"
import { conversations, hitlQueue, messages, tickets } from "@/lib/db/schema"
import { PIIMasker } from "@/lib/governance/pii-masker"
import { sanitizeInboundText } from "@/lib/email/parse-inbound"
import { createChatSession, resolveOrCreateIntake } from "@/lib/tickets/auto-intake"
import { getCustomerSessionStatus } from "@/lib/tickets/status-labels"
import { buildChatTicketSubject } from "@/lib/chat/ticket-subject"

export const runtime = "nodejs"

const CreateSessionSchema = z.object({
  displayName: z.string().min(1).max(80),
  initialMessage: z.string().min(1).max(8000).optional(),
  subject: z.string().max(255).optional(),
})

function parseLastViewedMap(raw: string | null): Record<string, Date> {
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as Record<string, string>
    if (!parsed || typeof parsed !== "object") return {}

    const out: Record<string, Date> = {}
    for (const [conversationId, value] of Object.entries(parsed)) {
      if (typeof value !== "string") continue
      const d = new Date(value)
      if (!Number.isNaN(d.getTime())) {
        out[conversationId] = d
      }
    }
    return out
  } catch {
    return {}
  }
}

function sanitizeDisplayName(name: string): string {
  return PIIMasker.mask(sanitizeInboundText(name)).trim().replace(/\s+/g, " ")
}

export async function GET(req: NextRequest) {
  let claims: { orgId: string; visitorId: string }
  try {
    claims = await verifyWidgetSession(req)
  } catch {
    return NextResponse.json({ error: "Invalid or expired session token." }, { status: 401 })
  }

  const { orgId, visitorId } = claims
  const lastViewedByConversation = parseLastViewedMap(
    req.nextUrl.searchParams.get("lastViewedAtByConversation")
  )

  const rows = await db
    .select({
      conversationId: conversations.id,
      customerDisplayName: conversations.customerDisplayName,
      ticketId: conversations.ticketId,
      ticketStatus: tickets.status,
      lastActivityAt: conversations.updatedAt,
    })
    .from(conversations)
    .innerJoin(tickets, eq(conversations.ticketId, tickets.id))
    .where(
      and(
        eq(conversations.orgId, orgId),
        eq(conversations.visitorId, visitorId),
        eq(conversations.channel, "chat"),
      )
    )
    .orderBy(desc(conversations.updatedAt))

  if (rows.length === 0) {
    return NextResponse.json({ sessions: [] })
  }

  const conversationIds = rows.map((r) => r.conversationId)
  const ticketIds = rows.map((r) => r.ticketId)

  const [pendingHitl, latestMessages] = await Promise.all([
    db
      .select({ ticketId: hitlQueue.ticketId })
      .from(hitlQueue)
      .where(
        and(
          eq(hitlQueue.orgId, orgId),
          eq(hitlQueue.status, "pending"),
          inArray(hitlQueue.ticketId, ticketIds),
        )
      ),
    db
      .select({
        conversationId: messages.conversationId,
        role: messages.role,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(inArray(messages.conversationId, conversationIds))
      .orderBy(desc(messages.createdAt)),
  ])

  const pendingTicketIds = new Set(pendingHitl.map((r) => r.ticketId).filter((v): v is string => Boolean(v)))
  const latestByConversation = new Map<string, (typeof latestMessages)[number]>()
  for (const message of latestMessages) {
    if (!latestByConversation.has(message.conversationId)) {
      latestByConversation.set(message.conversationId, message)
    }
  }

  const sessions = rows.map((row) => {
    const latest = latestByConversation.get(row.conversationId)
    const awaitingHumanReview = pendingTicketIds.has(row.ticketId)
    const status = getCustomerSessionStatus({ ticketStatus: row.ticketStatus, awaitingHumanReview })

    const lastViewedAt = lastViewedByConversation[row.conversationId]
    const hasUnreadAgentReply =
      latest?.role === "agent" &&
      (lastViewedAt ? latest.createdAt > lastViewedAt : true)

    return {
      conversationId: row.conversationId,
      customerDisplayName: row.customerDisplayName,
      status,
      lastMessagePreview: latest?.content?.slice(0, 180) ?? "",
      lastActivityAt: row.lastActivityAt.toISOString(),
      hasUnreadAgentReply,
    }
  })

  return NextResponse.json({ sessions })
}

export async function POST(req: NextRequest) {
  let claims: { orgId: string; visitorId: string }
  try {
    claims = await verifyWidgetSession(req)
  } catch {
    return NextResponse.json({ error: "Invalid or expired session token." }, { status: 401 })
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = CreateSessionSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const displayName = sanitizeDisplayName(parsed.data.displayName)
  if (!displayName) {
    return NextResponse.json(
      { error: "displayName must contain at least one visible character." },
      { status: 400 }
    )
  }

  const subject = parsed.data.subject?.trim()
    ? buildChatTicketSubject({
        displayName,
        initialMessage: parsed.data.subject,
      })
    : buildChatTicketSubject({
        displayName,
        initialMessage: parsed.data.initialMessage,
      })

  try {
    if (parsed.data.initialMessage?.trim()) {
      const content = PIIMasker.mask(sanitizeInboundText(parsed.data.initialMessage))
      const result = await resolveOrCreateIntake({
        orgId: claims.orgId,
        channel: "chat",
        customerIdentifier: { visitorId: claims.visitorId },
        content,
        subject,
        customerName: displayName,
        forceNew: true,
      })

      return NextResponse.json({ conversationId: result.conversationId })
    }

    const result = await createChatSession({
      orgId: claims.orgId,
      customerIdentifier: { visitorId: claims.visitorId },
      displayName,
      subject,
    })

    return NextResponse.json({ conversationId: result.conversationId })
  } catch (error) {
    console.error("[chat/sessions] failed to create session:", (error as Error).message)
    return NextResponse.json({ error: "Failed to create session." }, { status: 500 })
  }
}
