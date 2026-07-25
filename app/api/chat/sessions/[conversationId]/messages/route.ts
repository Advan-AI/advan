import { NextRequest, NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { z } from "zod"
import { verifyWidgetSession } from "@/lib/chat/widget-session-auth"
import { db } from "@/lib/db"
import { messages } from "@/lib/db/schema"
import { isConversationOwnedByVisitor } from "@/lib/chat/conversation-ownership"

export const runtime = "nodejs"

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  page: z.coerce.number().int().min(0).default(0),
})

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  let claims: { orgId: string; visitorId: string }
  try {
    claims = await verifyWidgetSession(req)
  } catch {
    return NextResponse.json({ error: "Invalid or expired session token." }, { status: 401 })
  }

  const { conversationId } = await context.params
  const parsedQuery = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()))
  if (!parsedQuery.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 })
  }

  const ownedConversation = await isConversationOwnedByVisitor({
    orgId: claims.orgId,
    visitorId: claims.visitorId,
    conversationId,
  })

  if (!ownedConversation) {
    // Fail closed: do not reveal whether the conversation exists for someone else.
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { limit, page } = parsedQuery.data
  const offset = page * limit

  const rows = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
      metadata: messages.metadata,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
    .limit(limit)
    .offset(offset)

  return NextResponse.json({
    messages: rows,
    page,
    limit,
    hasMore: rows.length === limit,
  })
}
