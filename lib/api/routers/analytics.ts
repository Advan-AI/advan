import { z } from "zod"
import { eq, and, desc, gte, sql, count, avg } from "drizzle-orm"
import { protectedProcedure, router } from "../trpc"
import { auditLogs, tickets } from "@/lib/db/schema"
import { db } from "@/lib/db"
import { getOrgOverview } from "@/lib/analytics/org-overview"

function normalizeConfidence(value: unknown): number | null {
  if (value == null) return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  if (numeric > 0 && numeric <= 1) return Math.round(numeric * 100)
  return Math.round(numeric)
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function buildDayWindow(days: number) {
  const end = new Date()
  const start = new Date(end)
  start.setDate(end.getDate() - (days - 1))
  start.setHours(0, 0, 0, 0)

  const buckets: Array<{
    date: string
    tickets: number
    resolved: number
    aiResolved: number
    avgFirstReplyMs: number | null
    avgConfidence: number | null
    aiDecisions: number
    auditConfidence: number | null
    avgSources: number | null
    avgLatencyMs: number | null
    flags: number
  }> = []

  for (let index = 0; index < days; index += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    buckets.push({
      date: dayKey(date),
      tickets: 0,
      resolved: 0,
      aiResolved: 0,
      avgFirstReplyMs: null,
      avgConfidence: null,
      aiDecisions: 0,
      auditConfidence: null,
      avgSources: null,
      avgLatencyMs: null,
      flags: 0,
    })
  }

  return { start, buckets }
}

export const analyticsRouter = router({
  overview: protectedProcedure.query(async ({ ctx }) => {
    return getOrgOverview(ctx.user.orgId)
  }),

  summary: protectedProcedure.query(async ({ ctx }) => {
    const data = await getOrgOverview(ctx.user.orgId)
    return {
      totalTickets: data.queue.total,
      resolvedTickets: data.metrics.resolved,
      aiResolutionRate: data.metrics.aiResolutionRate,
      avgConfidence: data.copilot.avgConfidence ?? 0,
      csat: data.metrics.csat ?? 0,
    }
  }),

  report: protectedProcedure
    .input(
      z.object({
        days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const { start, buckets } = buildDayWindow(input.days)

      const [
        overview,
        ticketTrendRows,
        statusRows,
        priorityRows,
        channelRows,
        auditRows,
      ] = await Promise.all([
        getOrgOverview(ctx.user.orgId),
        db
          .select({
            day: sql<string>`to_char(${tickets.createdAt}, 'YYYY-MM-DD')`,
            tickets: count(),
            resolved: sql<number>`SUM(CASE WHEN ${tickets.status} = 'resolved' THEN 1 ELSE 0 END)`,
            aiResolved: sql<number>`SUM(CASE WHEN ${tickets.aiResolved} THEN 1 ELSE 0 END)`,
            avgFirstReplyMs: avg(tickets.firstReplyMs),
            avgConfidence: avg(tickets.confidenceScore),
          })
          .from(tickets)
          .where(and(eq(tickets.orgId, ctx.user.orgId), gte(tickets.createdAt, start)))
          .groupBy(sql`to_char(${tickets.createdAt}, 'YYYY-MM-DD')`)
          .orderBy(sql`to_char(${tickets.createdAt}, 'YYYY-MM-DD')`),
        db
          .select({ name: tickets.status, value: count() })
          .from(tickets)
          .where(eq(tickets.orgId, ctx.user.orgId))
          .groupBy(tickets.status),
        db
          .select({ name: tickets.priority, value: count() })
          .from(tickets)
          .where(eq(tickets.orgId, ctx.user.orgId))
          .groupBy(tickets.priority),
        db
          .select({ name: tickets.channel, value: count() })
          .from(tickets)
          .where(eq(tickets.orgId, ctx.user.orgId))
          .groupBy(tickets.channel),
        db
          .select({
            id: auditLogs.id,
            metadata: auditLogs.metadata,
            createdAt: auditLogs.createdAt,
          })
          .from(auditLogs)
          .where(and(eq(auditLogs.orgId, ctx.user.orgId), gte(auditLogs.createdAt, start)))
          .orderBy(desc(auditLogs.createdAt))
          .limit(500),
      ])

      const byDate = new Map(buckets.map((bucket) => [bucket.date, bucket]))

      for (const row of ticketTrendRows) {
        const bucket = byDate.get(row.day)
        if (!bucket) continue
        bucket.tickets = Number(row.tickets)
        bucket.resolved = Number(row.resolved ?? 0)
        bucket.aiResolved = Number(row.aiResolved ?? 0)
        bucket.avgFirstReplyMs = row.avgFirstReplyMs == null ? null : Math.round(Number(row.avgFirstReplyMs))
        bucket.avgConfidence = normalizeConfidence(row.avgConfidence)
      }

      const auditAccumulator = new Map<
        string,
        { count: number; confidence: number; confidenceCount: number; sources: number; latency: number; latencyCount: number; flags: number }
      >()

      for (const row of auditRows) {
        const date = dayKey(row.createdAt)
        const metadata = row.metadata ?? {}
        const current = auditAccumulator.get(date) ?? {
          count: 0,
          confidence: 0,
          confidenceCount: 0,
          sources: 0,
          latency: 0,
          latencyCount: 0,
          flags: 0,
        }
        const confidence = normalizeConfidence(metadata.confidence)
        current.count += 1
        if (confidence != null) {
          current.confidence += confidence
          current.confidenceCount += 1
        }
        current.sources += metadata.citations?.length ?? 0
        if (metadata.latencyMs != null) {
          current.latency += Number(metadata.latencyMs)
          current.latencyCount += 1
        }
        current.flags += metadata.hallucinationFlags?.length ?? 0
        current.flags += metadata.policyChecks?.filter((check) => !check.passed).length ?? 0
        auditAccumulator.set(date, current)
      }

      for (const [date, aggregate] of auditAccumulator.entries()) {
        const bucket = byDate.get(date)
        if (!bucket) continue
        bucket.aiDecisions = aggregate.count
        bucket.auditConfidence =
          aggregate.confidenceCount > 0 ? Math.round(aggregate.confidence / aggregate.confidenceCount) : null
        bucket.avgSources =
          aggregate.count > 0 ? Math.round((aggregate.sources / aggregate.count) * 10) / 10 : null
        bucket.avgLatencyMs =
          aggregate.latencyCount > 0 ? Math.round(aggregate.latency / aggregate.latencyCount) : null
        bucket.flags = aggregate.flags
      }

      return {
        days: input.days,
        generatedAt: new Date().toISOString(),
        overview,
        trend: buckets,
        distributions: {
          status: statusRows.map((row) => ({ name: row.name, value: Number(row.value) })),
          priority: priorityRows.map((row) => ({ name: row.name, value: Number(row.value) })),
          channel: channelRows.map((row) => ({ name: row.name, value: Number(row.value) })),
        },
        audit: {
          total: auditRows.length,
          flagged: auditRows.filter((row) => {
            const metadata = row.metadata ?? {}
            return (
              (metadata.hallucinationFlags?.length ?? 0) > 0 ||
              (metadata.policyChecks?.some((check) => !check.passed) ?? false)
            )
          }).length,
          recent: auditRows.slice(0, 8),
        },
      }
    }),

  auditLogs: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.orgId, ctx.user.orgId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(input.limit)
        .offset(input.offset)

      return rows
    }),

  latestAuditLog: protectedProcedure
    .input(z.object({ ticketId: z.string().uuid().optional() }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(auditLogs.orgId, ctx.user.orgId)]
      if (input.ticketId) {
        conditions.push(eq(auditLogs.ticketId, input.ticketId))
      }

      const row = await db.query.auditLogs.findFirst({
        where: and(...conditions),
        orderBy: [desc(auditLogs.createdAt)],
      })

      return row ?? null
    }),
})
