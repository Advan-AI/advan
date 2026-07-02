import { z } from "zod"
import { eq, and, desc } from "drizzle-orm"
import { protectedProcedure, router } from "../trpc"
import { auditLogs } from "@/lib/db/schema"
import { db } from "@/lib/db"
import { getOrgOverview } from "@/lib/analytics/org-overview"

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
