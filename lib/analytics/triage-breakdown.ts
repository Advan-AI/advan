import { and, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { conversations, messages } from "@/lib/db/schema"

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChannelBreakdown = {
  channel: string
  total: number
  autoResolved: number
  escalated: number
  autoRate: number
}

export type TriageBreakdown = {
  /** Total inbound customer messages that passed through auto-triage. */
  total: number
  /** Messages the AI auto-resolved (decision === "auto_send"). */
  autoResolved: number
  /** Messages escalated to human review (complaint or low confidence). */
  escalated: number
  /** autoResolved / total as an integer percentage 0–100. */
  autoRate: number
  /** Per-channel breakdown sorted by total descending. */
  byChannel: ChannelBreakdown[]
  /**
   * Breakdown by complaint type.
   * A complaint message must never appear in autoResolved — this invariant is
   * enforced by the triage worker and verified by the analytics test.
   */
  byType: {
    complaint: { total: number; autoResolved: number; escalated: number }
    nonComplaint: { total: number; autoResolved: number; escalated: number }
  }
}

// ─── Query ────────────────────────────────────────────────────────────────────

/**
 * Aggregate triage decisions from messages that were processed by the
 * auto-triage worker.  We read directly from messages.metadata.triage so this
 * works without any schema migration — the triage worker already stamps every
 * processed message with {decision, isComplaint, confidence, …}.
 *
 * Correct categorisation invariant (also enforced by the triage worker):
 *   isComplaint=true → decision is always "hitl_complaint", never "auto_send"
 */
export async function getTriageBreakdown(orgId: string): Promise<TriageBreakdown> {
  const rows = await db
    .select({
      channel: conversations.channel,
      decision: sql<string>`${messages.metadata}->'triage'->>'decision'`,
      isComplaintRaw: sql<string>`${messages.metadata}->'triage'->>'isComplaint'`,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.orgId, orgId),
        eq(messages.role, "user"),
        // Only messages that have been processed by the triage worker
        sql`${messages.metadata} ? 'triage'`
      )
    )

  const total = rows.length
  const autoResolved = rows.filter((r) => r.decision === "auto_send").length
  const escalated = total - autoResolved
  const autoRate = total > 0 ? Math.round((autoResolved / total) * 100) : 0

  // ── By channel ─────────────────────────────────────────────────────────────
  const channelMap = new Map<string, { total: number; autoResolved: number; escalated: number }>()
  for (const row of rows) {
    const ch = row.channel
    const cur = channelMap.get(ch) ?? { total: 0, autoResolved: 0, escalated: 0 }
    cur.total += 1
    if (row.decision === "auto_send") cur.autoResolved += 1
    else cur.escalated += 1
    channelMap.set(ch, cur)
  }

  const byChannel: ChannelBreakdown[] = Array.from(channelMap.entries())
    .map(([channel, s]) => ({
      channel,
      ...s,
      autoRate: s.total > 0 ? Math.round((s.autoResolved / s.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)

  // ── By complaint type ───────────────────────────────────────────────────────
  const byType = {
    complaint: { total: 0, autoResolved: 0, escalated: 0 },
    nonComplaint: { total: 0, autoResolved: 0, escalated: 0 },
  }
  for (const row of rows) {
    const isComplaint = row.isComplaintRaw === "true"
    const bucket = isComplaint ? byType.complaint : byType.nonComplaint
    bucket.total += 1
    if (row.decision === "auto_send") bucket.autoResolved += 1
    else bucket.escalated += 1
  }

  return { total, autoResolved, escalated, autoRate, byChannel, byType }
}

export type TriageBreakdownResult = Awaited<ReturnType<typeof getTriageBreakdown>>
