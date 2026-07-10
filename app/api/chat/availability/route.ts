/**
 * GET /api/chat/availability?widgetKey=<key>
 *
 * Public, unauthenticated endpoint called by the embedded chat widget on load
 * to determine whether to offer live chat or the offline pre-chat form.
 *
 * Response shape:
 *   {
 *     agentsOnline: boolean,
 *     agentCount: number,
 *     teamName: string,
 *     agents: Array<{ id: string; name: string; initials: string }>,
 *     preChatFormEnabled: boolean
 *   }
 */

import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { organizations, users, widgetConfigs } from "@/lib/db/schema"
import { countAgentsOnline, isOrgChatAccepting } from "@/lib/realtime/event-bus"

export const runtime = "nodejs"

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}

function displayName(name: string | null, email: string): string {
  const trimmed = name?.trim()
  if (trimmed) return trimmed.split(/\s+/)[0] // first name only for widget
  const local = email.split("@")[0] ?? "Agent"
  return local.charAt(0).toUpperCase() + local.slice(1)
}

export async function GET(req: NextRequest) {
  const widgetKey = req.nextUrl.searchParams.get("widgetKey")?.trim()
  if (!widgetKey) {
    return NextResponse.json({ error: "widgetKey is required" }, { status: 400 })
  }

  const config = await db.query.widgetConfigs.findFirst({
    where: eq(widgetConfigs.widgetKey, widgetKey),
    columns: {
      orgId: true,
      preChatFormEnabled: true,
      brandingConfig: true,
    },
  })

  if (!config) {
    return NextResponse.json({ error: "Unknown widgetKey" }, { status: 404 })
  }

  const [agentsOnline, socketCount, org] = await Promise.all([
    isOrgChatAccepting(config.orgId),
    countAgentsOnline(config.orgId),
    db.query.organizations.findFirst({
      where: eq(organizations.id, config.orgId),
      columns: { name: true },
    }),
  ])

  const branding = (config.brandingConfig ?? {}) as {
    teamName?: string
    agentName?: string
  }

  const teamName =
    branding.teamName?.trim() ||
    org?.name?.trim() ||
    "Support"

  // Prefer real available agents for avatar stack; fall back to synthetic count.
  const availableUsers = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.orgId, config.orgId), eq(users.chatAvailable, true)))
    .limit(8)

  const agentCount = agentsOnline ? Math.max(socketCount, availableUsers.length > 0 ? 1 : 0) : 0

  const agents = agentsOnline
    ? (availableUsers.length > 0 ? availableUsers : [{ id: "support", name: teamName, email: "support@local" }])
        .slice(0, 3)
        .map((u) => {
          const name = displayName(u.name, u.email)
          return { id: u.id, name, initials: initialsFromName(name) }
        })
    : []

  return NextResponse.json({
    agentsOnline,
    agentCount,
    teamName,
    agents,
    preChatFormEnabled: config.preChatFormEnabled,
  })
}
