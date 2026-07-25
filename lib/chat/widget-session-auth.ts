import { NextRequest } from "next/server"
import { and, eq } from "drizzle-orm"
import { verifyWidgetToken } from "@/lib/chat/verify-widget-token"
import { db } from "@/lib/db"
import { visitors } from "@/lib/db/schema"

export function extractWidgetToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization")
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim()
    if (token) return token
  }

  const qp = req.nextUrl.searchParams.get("token")?.trim()
  if (qp) return qp

  return null
}

export async function verifyWidgetSession(req: NextRequest): Promise<{
  orgId: string
  widgetKey: string
  visitorId: string
}> {
  const token = extractWidgetToken(req)
  if (!token) {
    throw new Error("missing_token")
  }

  const claims = await verifyWidgetToken(token)
  const visitor = await db.query.visitors.findFirst({
    where: and(
      eq(visitors.id, claims.visitorId),
      eq(visitors.orgId, claims.orgId),
      eq(visitors.widgetKey, claims.widgetKey),
    ),
    columns: { id: true },
  })

  if (!visitor) {
    throw new Error("unknown_visitor")
  }

  return {
    orgId: claims.orgId,
    widgetKey: claims.widgetKey,
    visitorId: claims.visitorId,
  }
}
