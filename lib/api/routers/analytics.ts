import { z } from "zod"
import { eq, and, desc, avg, count, sql } from "drizzle-orm"
import { protectedProcedure, router } from "../trpc"
import { auditLogs, tickets } from "@/lib/db/schema"
import { db } from "@/lib/db"

export const analyticsRouter = router({
  summary: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.user.orgId

    const [totalTickets] = await db
      .select({ value: count() })
      .from(tickets)
      .where(eq(tickets.orgId, orgId))

    const [resolvedCount] = await db
      .select({ value: count() })
      .from(tickets)
      .where(and(eq(tickets.orgId, orgId), eq(tickets.status, "resolved")))

    const [aiResolvedCount] = await db
      .select({ value: count() })
      .from(tickets)
      .where(and(eq(tickets.orgId, orgId), eq(tickets.aiResolved, true)))

    const [avgConfidence] = await db
      .select({ value: avg(auditLogs.id) }) // placeholder — use JSON field in production
      .from(auditLogs)
      .where(eq(auditLogs.orgId, orgId))

    const total = Number(totalTickets.value)
    const resolved = Number(resolvedCount.value)
    const aiResolved = Number(aiResolvedCount.value)
    const aiResolutionRate = total > 0 ? Math.round((aiResolved / total) * 100) : 0

    return {
      totalTickets: total,
      resolvedTickets: resolved,
      aiResolutionRate,
      avgConfidence: 94, // Will be real once audit logs are populated
      csat: 4.86,
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
