import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { auditLogs, hitlQueue } from "@/lib/db/schema"
import { signalHITLDecision } from "@/lib/temporal/client"
import { publishHitlResolved } from "@/lib/realtime/event-bus"

export type DecisionAction = "accept" | "reject" | "modify"

export interface ApplyDecisionArgs {
  orgId: string
  userId: string
  suggestionId: string
  action: DecisionAction
  finalText?: string
  hitlId?: string
}

export interface ApplyDecisionResult {
  suggestionId: string
  action: DecisionAction
  hitlResolved: boolean
}

/**
 * CopilotDecisionService — Single Responsibility: durably record an agent's
 * accept/reject/modify decision on a suggestion, and (if the suggestion was
 * gated) resolve the linked HITL item, signal the waiting Temporal workflow,
 * and broadcast the resolution to other reviewers.
 *
 * Replaces the old fake `setTimeout` "Send Reply" in the Copilot page.
 */
export class CopilotDecisionService {
  static async apply(args: ApplyDecisionArgs): Promise<ApplyDecisionResult> {
    const { orgId, userId, suggestionId, action, finalText, hitlId } = args

    const log = await db.query.auditLogs.findFirst({
      where: and(eq(auditLogs.id, suggestionId), eq(auditLogs.orgId, orgId)),
    })
    if (!log) throw new Error("Suggestion not found")

    // 1) Record decision on the audit log (jsonb merge — no migration needed).
    await db
      .update(auditLogs)
      .set({
        metadata: {
          ...log.metadata,
          decision: { action, finalText, by: userId, at: new Date().toISOString() },
        },
        ...(finalText && action !== "reject" ? { output: finalText } : {}),
      })
      .where(eq(auditLogs.id, suggestionId))

    // 2) Resolve a linked HITL item, if present.
    let hitlResolved = false
    if (hitlId) {
      const item = await db.query.hitlQueue.findFirst({
        where: and(eq(hitlQueue.id, hitlId), eq(hitlQueue.orgId, orgId)),
      })
      if (item && item.status === "pending") {
        if (item.temporalWorkflowId) {
          try {
            await signalHITLDecision(item.temporalWorkflowId, {
              approved: action !== "reject",
              editedOutput: finalText,
            })
          } catch (err) {
            console.warn("[Decision] Temporal signal failed:", (err as Error).message)
          }
        }
        await db
          .update(hitlQueue)
          .set({
            status: action === "reject" ? "rejected" : "approved",
            reviewedBy: userId,
            reviewNote: finalText,
            resolvedAt: new Date(),
          })
          .where(eq(hitlQueue.id, hitlId))
        await publishHitlResolved(orgId, {
          id: hitlId,
          action: action === "reject" ? "reject" : "approve",
          editedOutput: finalText,
        })
        hitlResolved = true
      }
    }

    return { suggestionId, action, hitlResolved }
  }
}
