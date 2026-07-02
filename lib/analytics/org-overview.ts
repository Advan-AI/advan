import { eq, and, desc, avg, count, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  auditLogs,
  conversations,
  customers,
  hitlQueue,
  tickets,
} from "@/lib/db/schema"
import { getLlmRuntimeConfig } from "@/lib/llm/config"

type TicketStatus = "open" | "pending" | "resolved" | "closed"

function toNumber(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function roundRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 100)
}

/**
 * Confidence values may be stored as a 0–1 probability (e.g. 0.94) or as a
 * 0–100 integer (e.g. 94). Normalise either representation to a 0–100 integer
 * so the UI always shows "94%" for both cases.
 */
function normalizeConfidence(value: number | null): number | null {
  if (value == null) return null
  // 0–1 probability → convert to percentage
  if (value > 0 && value <= 1) return Math.round(value * 100)
  return Math.round(value)
}

export async function getOrgOverview(orgId: string) {
  const [
    statusRows,
    [aiResolvedRow],
    [avgFirstReplyRow],
    [avgTicketConfidenceRow],
    [avgCsatRow],
    [conversationCountRow],
    [hitlPendingRow],
    [avgAuditConfidenceRow],
    [avgCitationsRow],
    [avgLatencyRow],
    latestAudit,
    recentRows,
  ] = await Promise.all([
    // ── Queue status distribution ──────────────────────────────────────
    db
      .select({ status: tickets.status, value: count() })
      .from(tickets)
      .where(eq(tickets.orgId, orgId))
      .groupBy(tickets.status),

    // ── AI-resolved ticket count ───────────────────────────────────────
    db
      .select({ value: count() })
      .from(tickets)
      .where(and(eq(tickets.orgId, orgId), eq(tickets.aiResolved, true))),

    // ── Avg first-reply time (ms) ──────────────────────────────────────
    db
      .select({ value: avg(tickets.firstReplyMs) })
      .from(tickets)
      .where(
        and(eq(tickets.orgId, orgId), sql`${tickets.firstReplyMs} IS NOT NULL`)
      ),

    // ── Avg ticket-level confidence score ─────────────────────────────
    db
      .select({ value: avg(tickets.confidenceScore) })
      .from(tickets)
      .where(
        and(
          eq(tickets.orgId, orgId),
          sql`${tickets.confidenceScore} IS NOT NULL`
        )
      ),

    // ── Avg CSAT across customers ──────────────────────────────────────
    db
      .select({
        value: avg(sql`NULLIF(${customers.csatAvg}, '')::numeric`),
      })
      .from(customers)
      .where(
        and(
          eq(customers.orgId, orgId),
          sql`${customers.csatAvg} IS NOT NULL AND ${customers.csatAvg} <> ''`
        )
      ),

    // ── Open conversation count ────────────────────────────────────────
    db
      .select({ value: count() })
      .from(conversations)
      .where(eq(conversations.orgId, orgId)),

    // ── Pending HITL items ─────────────────────────────────────────────
    db
      .select({ value: count() })
      .from(hitlQueue)
      .where(
        and(eq(hitlQueue.orgId, orgId), eq(hitlQueue.status, "pending"))
      ),

    // ── Avg confidence from audit log metadata ─────────────────────────
    db
      .select({
        value: avg(sql`(${auditLogs.metadata}->>'confidence')::numeric`),
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.orgId, orgId),
          sql`${auditLogs.metadata}->>'confidence' IS NOT NULL`
        )
      ),

    // ── Avg citations (sources) per answer ────────────────────────────
    db
      .select({
        value: avg(
          sql`jsonb_array_length(COALESCE(${auditLogs.metadata}->'citations', '[]'::jsonb))`
        ),
      })
      .from(auditLogs)
      .where(eq(auditLogs.orgId, orgId)),

    // ── Avg AI response latency (ms) ──────────────────────────────────
    db
      .select({
        value: avg(sql`(${auditLogs.metadata}->>'latencyMs')::numeric`),
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.orgId, orgId),
          sql`${auditLogs.metadata}->>'latencyMs' IS NOT NULL`
        )
      ),

    // ── Latest audit log for model name + last-active timestamp ───────
    db.query.auditLogs.findFirst({
      where: eq(auditLogs.orgId, orgId),
      orderBy: [desc(auditLogs.createdAt)],
    }),

    // ── Recent ticket activity feed ────────────────────────────────────
    db
      .select({
        ticket: {
          id: tickets.id,
          subject: tickets.subject,
          status: tickets.status,
          priority: tickets.priority,
          channel: tickets.channel,
          aiResolved: tickets.aiResolved,
          updatedAt: tickets.updatedAt,
          createdAt: tickets.createdAt,
        },
        customer: {
          id: customers.id,
          name: customers.name,
          email: customers.email,
        },
      })
      .from(tickets)
      .leftJoin(customers, eq(tickets.customerId, customers.id))
      .where(eq(tickets.orgId, orgId))
      .orderBy(desc(tickets.updatedAt))
      .limit(8),
  ])

  // ── Build queue totals ─────────────────────────────────────────────────
  const queue = { open: 0, pending: 0, resolved: 0, closed: 0, total: 0 }

  for (const row of statusRows) {
    const status = row.status as TicketStatus
    const value = Number(row.value)
    if (status === "open" || status === "pending" || status === "resolved" || status === "closed") {
      queue[status] = value
    }
    queue.total += value
  }

  const aiResolved = Number(aiResolvedRow.value)
  const avgFirstReplyMs = toNumber(avgFirstReplyRow.value)
  const openConversations = Number(conversationCountRow.value)
  const hitlPending = Number(hitlPendingRow.value)
  const avgCsat = toNumber(avgCsatRow.value)
  const avgSourcesPerAnswer = toNumber(avgCitationsRow.value)
  const avgLatencyMs = toNumber(avgLatencyRow.value)

  // Prefer audit-log confidence (more granular) over ticket-level score.
  // Both are normalised to 0–100 integer.
  const avgConfidence =
    normalizeConfidence(toNumber(avgAuditConfidenceRow.value)) ??
    normalizeConfidence(toNumber(avgTicketConfidenceRow.value))

  const llm = getLlmRuntimeConfig()
  const model =
    latestAudit?.metadata?.model ??
    (llm.chatProvider === "ollama"
      ? llm.ollamaChatModel
      : llm.groqChatModel)

  // Copilot is "active" if it produced output within the last 24 hours,
  // "idle" if it has history but nothing recent, "no_data" if never used.
  // Serialize to ISO string so the type is wire-safe (Date → string via JSON).
  const lastActivityAt = latestAudit?.createdAt?.toISOString() ?? null
  const isRecentlyActive =
    lastActivityAt != null &&
    Date.now() - new Date(lastActivityAt).getTime() < 24 * 60 * 60 * 1000

  const copilotStatus: "active" | "idle" | "no_data" =
    latestAudit == null ? "no_data" : isRecentlyActive ? "active" : "idle"

  return {
    queue,
    metrics: {
      resolved: queue.resolved,
      aiResolved,
      aiResolutionRate: roundRate(aiResolved, queue.total),
      avgFirstReplyMs,
      csat: avgCsat != null ? Math.round(avgCsat * 100) / 100 : null,
      openConversations,
      hitlPending,
    },
    copilot: {
      model,
      avgConfidence,
      avgSourcesPerAnswer:
        avgSourcesPerAnswer != null
          ? Math.round(avgSourcesPerAnswer * 10) / 10
          : null,
      avgLatencyMs: avgLatencyMs != null ? Math.round(avgLatencyMs) : null,
      lastActivityAt,
      status: copilotStatus,
    },
    // Serialize Date fields to ISO strings so OrgOverview is fully wire-safe
    // and the inferred tRPC client type matches the declared return type.
    recentActivity: recentRows.map((row) => ({
      ticket: {
        ...row.ticket,
        updatedAt: row.ticket.updatedAt.toISOString(),
        createdAt: row.ticket.createdAt.toISOString(),
      },
      customer: row.customer?.id ? row.customer : null,
    })),
  }
}

export type OrgOverview = Awaited<ReturnType<typeof getOrgOverview>>
