import { z } from 'zod'
import { and, desc, eq } from 'drizzle-orm'
import { router, protectedProcedure } from '../trpc'
import { PIIMasker } from '@/lib/governance/pii-masker'
import { PolicyClient } from '@/lib/governance/policy-client'
import { db } from '@/lib/db'
import { hitlQueue } from '@/lib/db/schema'
import { CopilotDecisionService } from '@/lib/copilot/decision-service'
// NOTE: insertAgentMessage is imported lazily inside each mutation because it
// transitively imports notificationQueue from lib/queue/queues.ts which throws
// at module-load time when REDIS_URL is not configured. Lazy import keeps
// pendingHitl (a pure DB read) working even without Redis.

// Priority sort order: complaint first, then low_confidence, then policy_fail, then normal
const PRIORITY_ORDER: Record<string, number> = {
  complaint: 0,
  low_confidence: 1,
  policy_fail: 2,
  normal: 3,
}

/**
 * Advan AI Governance Router (Layer 2 -> Layer 3 bridge)
 */
export const governanceRouter = router({
  maskPII: protectedProcedure
    .input(z.object({ text: z.string() }))
    .mutation(({ input }) => {
      const masked = PIIMasker.mask(input.text)
      return { masked }
    }),

  checkPolicy: protectedProcedure
    .input(z.object({
      policyPath: z.string(),
      context: z.any(),
    }))
    .query(async ({ input }) => {
      const decision = await PolicyClient.evaluate(input.policyPath, input.context)
      return decision
    }),

  /**
   * List HITL queue items for this org, with complaint-origin items sorted
   * first so reviewers see the most urgent items at the top.
   */
  pendingHitl: protectedProcedure
    .input(z.object({
      status: z.enum(['pending', 'approved', 'rejected', 'all']).default('pending'),
      limit: z.number().min(1).max(100).default(40),
    }))
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select()
        .from(hitlQueue)
        .where(
          input.status === 'all'
            ? eq(hitlQueue.orgId, ctx.user.orgId)
            : and(eq(hitlQueue.orgId, ctx.user.orgId), eq(hitlQueue.status, input.status))
        )
        .orderBy(desc(hitlQueue.createdAt))
        .limit(input.limit)

      // Sort: complaint before low_confidence before normal; within each
      // bucket preserve the createdAt desc order from the DB.
      return rows.sort(
        (a, b) =>
          (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
      )
    }),

  /**
   * Approve a HITL item: records the decision on the audit log (if available),
   * sends the draft as an agent reply via the shared insertAgentMessage path,
   * and marks the queue item resolved.
   *
   * This is the same path as a human using the Copilot page — both ultimately
   * call insertAgentMessage, which handles email queuing, conversation
   * timestamp updates, and notification fan-out.
   */
  approveHitl: protectedProcedure
    .input(z.object({
      hitlId: z.string().uuid(),
      finalText: z.string().max(20000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const item = await db.query.hitlQueue.findFirst({
        where: and(eq(hitlQueue.id, input.hitlId), eq(hitlQueue.orgId, ctx.user.orgId)),
      })
      if (!item) throw new Error('HITL item not found')
      if (item.status !== 'pending') throw new Error(`Item already ${item.status}`)

      const content = (input.finalText?.trim() || item.draftOutput).trim()
      if (!content) throw new Error('Draft content is empty')

      // 1. Record decision on the audit log if an auditLogId is available.
      const auditLogId = item.classificationMetadata?.auditLogId
      if (auditLogId) {
        try {
          await CopilotDecisionService.apply({
            orgId: ctx.user.orgId,
            userId: ctx.user.id,
            suggestionId: auditLogId,
            action: content !== item.draftOutput ? 'modify' : 'accept',
            finalText: content,
            hitlId: item.id,
          })
        } catch (err) {
          console.warn('[governance.approveHitl] CopilotDecisionService failed (non-fatal):', (err as Error).message)
        }
      }

      // 2. Send the reply via the shared agent message insertion path.
      if (item.conversationId) {
        const { insertAgentMessage } = await import('@/lib/conversations/insert-agent-message')
        await insertAgentMessage({
          orgId: ctx.user.orgId,
          conversationId: item.conversationId,
          content,
          metadata: {
            model: 'advan-copilot-v1',
            confidence: item.classificationMetadata?.draftConfidence,
          },
        })
      }

      // 3. Mark the HITL item resolved (skip if already done by CopilotDecisionService).
      const fresh = await db.query.hitlQueue.findFirst({ where: eq(hitlQueue.id, item.id) })
      if (fresh?.status === 'pending') {
        await db
          .update(hitlQueue)
          .set({ status: 'approved', reviewedBy: ctx.user.id, reviewNote: content, resolvedAt: new Date() })
          .where(eq(hitlQueue.id, item.id))
      }

      // Signal Temporal workflow if this HITL item was created by a custom visual orchestration pipeline
      if (item.temporalWorkflowId) {
        try {
          const { getTemporalClient } = await import('@/lib/temporal/clients/workflow.client')
          const temporalClient = await getTemporalClient()
          const handle = temporalClient.workflow.getHandle(item.temporalWorkflowId)
          await handle.signal('hitl-decision', {
            approved: true,
            editedOutput: content,
          })
          console.log(`[governance.approveHitl] Successfully signaled Temporal workflow=${item.temporalWorkflowId}`)
        } catch (err) {
          console.error('[governance.approveHitl] Failed to signal Temporal workflow:', err instanceof Error ? err.message : String(err))
        }
      }

      // 4. Broadcast resolution to other reviewers.
      try {
        const { publishHitlResolved } = await import('@/lib/realtime/event-bus')
        await publishHitlResolved(ctx.user.orgId, { id: item.id, action: 'approve', editedOutput: content })
      } catch { /* non-fatal */ }

      return { hitlId: item.id, status: 'approved' }
    }),

  /**
   * Reject a HITL item without sending a reply. Records the rejection on the
   * audit log and marks the queue item resolved.
   */
  rejectHitl: protectedProcedure
    .input(z.object({
      hitlId: z.string().uuid(),
      reviewNote: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const item = await db.query.hitlQueue.findFirst({
        where: and(eq(hitlQueue.id, input.hitlId), eq(hitlQueue.orgId, ctx.user.orgId)),
      })
      if (!item) throw new Error('HITL item not found')
      if (item.status !== 'pending') throw new Error(`Item already ${item.status}`)

      const auditLogId = item.classificationMetadata?.auditLogId
      if (auditLogId) {
        try {
          await CopilotDecisionService.apply({
            orgId: ctx.user.orgId,
            userId: ctx.user.id,
            suggestionId: auditLogId,
            action: 'reject',
            hitlId: item.id,
          })
        } catch (err) {
          console.warn('[governance.rejectHitl] CopilotDecisionService failed (non-fatal):', (err as Error).message)
        }
      }

      const fresh = await db.query.hitlQueue.findFirst({ where: eq(hitlQueue.id, item.id) })
      if (fresh?.status === 'pending') {
        await db
          .update(hitlQueue)
          .set({ status: 'rejected', reviewedBy: ctx.user.id, reviewNote: input.reviewNote, resolvedAt: new Date() })
          .where(eq(hitlQueue.id, item.id))
      }

      // Signal Temporal workflow if this HITL item was created by a custom visual orchestration pipeline
      if (item.temporalWorkflowId) {
        try {
          const { getTemporalClient } = await import('@/lib/temporal/clients/workflow.client')
          const temporalClient = await getTemporalClient()
          const handle = temporalClient.workflow.getHandle(item.temporalWorkflowId)
          await handle.signal('hitl-decision', {
            approved: false,
          })
          console.log(`[governance.rejectHitl] Successfully signaled Temporal workflow=${item.temporalWorkflowId}`)
        } catch (err) {
          console.error('[governance.rejectHitl] Failed to signal Temporal workflow:', err instanceof Error ? err.message : String(err))
        }
      }

      try {
        const { publishHitlResolved } = await import('@/lib/realtime/event-bus')
        await publishHitlResolved(ctx.user.orgId, { id: item.id, action: 'reject' })
      } catch { /* non-fatal */ }

      return { hitlId: item.id, status: 'rejected' }
    }),
})
