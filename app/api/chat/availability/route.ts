/**
 * GET /api/chat/availability?widgetKey=<key>
 *
 * Public, unauthenticated endpoint called by the embedded chat widget on load
 * to determine whether to offer live chat or the offline pre-chat form.
 *
 * Response shape:
 *   {
 *     agentsOnline: boolean,
 *     preChatFormEnabled: boolean
 *   }
 *
 *   agentsOnline         — true if at least one agent socket is connected to
 *                          this org's chat queue right now.  Read from the Redis
 *                          SET maintained by the socket server (cross-process).
 *
 *   preChatFormEnabled   — from widget_configs.preChatFormEnabled; the widget
 *                          should show the name + email form before submitting
 *                          the first message when this is true AND agentsOnline
 *                          is false.
 *
 * The widgetKey is validated against widget_configs.  An unknown key returns 404
 * rather than a "no agents" response, so the widget can detect misconfiguration.
 *
 * Rate limiting: shared by origin — callers are browsers loading a widget, so
 * the same limits as the session endpoint apply (Upstash or in-process).
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { widgetConfigs } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { isOrgChatAccepting } from "@/lib/realtime/event-bus"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const widgetKey = req.nextUrl.searchParams.get("widgetKey")?.trim()
  if (!widgetKey) {
    return NextResponse.json({ error: "widgetKey is required" }, { status: 400 })
  }

  const config = await db.query.widgetConfigs.findFirst({
    where: eq(widgetConfigs.widgetKey, widgetKey),
    columns: { orgId: true, preChatFormEnabled: true },
  })

  if (!config) {
    return NextResponse.json({ error: "Unknown widgetKey" }, { status: 404 })
  }

  // isOrgChatAccepting: Redis presence (any socket) AND DB (chatAvailable=true).
  // Falls back to false (= show pre-chat form) when Redis is unavailable.
  const agentsOnline = await isOrgChatAccepting(config.orgId)

  return NextResponse.json({
    agentsOnline,
    preChatFormEnabled: config.preChatFormEnabled,
  })
}
