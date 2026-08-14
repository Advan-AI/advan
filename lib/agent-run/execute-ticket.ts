import { agentActivities } from "@/lib/temporal/activities/agent-activities"
import {
  createSandboxSessionActivity,
  executeAgentInSandboxActivity,
  hibernateSandboxActivity,
} from "@/lib/temporal/activities/sandbox-activities"
import { db } from "@/lib/db"
import { sandboxSessions } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

/**
 * AgentRun orchestration — Postgres-backed replacement for the Temporal
 * workflow (lib/temporal/workflows/ticket-resolution.ts), for deployments
 * where no reachable Temporal server exists (e.g. Vercel serverless: no
 * persistent worker process to hold workflow state).
 *
 * Same pipeline, same activity functions (they were always plain async
 * functions — Temporal's `proxyActivities` was a call wrapper, not a
 * requirement) — just orchestrated as one HTTP request instead of a
 * long-lived workflow. The "hibernate and wait" step ends this function
 * (and the request) entirely; lib/agent-run/resume-ticket.ts is invoked
 * later, in a completely separate invocation, driven only by what's in
 * `sandbox_sessions` — no in-memory state survives between the two.
 */

export interface ExecuteTicketInput {
  orgId: string
  ticketId: string
  customerInput: string
  agentRunId: string
  hitlTimeoutMinutes?: number
}

export interface ExecuteTicketResult {
  agentRunId: string
  status: "completed" | "awaiting_approval"
  hitlRequired: boolean
  output?: string
  confidence?: number
  citations?: Array<{ source: string; url?: string; confidence: number }>
}

export async function executeTicketAgentRun(input: ExecuteTicketInput): Promise<ExecuteTicketResult> {
  const triage = await agentActivities.runTriageActivity({ orgId: input.orgId, text: input.customerInput })
  const knowledge = await agentActivities.runKnowledgeActivity({
    orgId: input.orgId,
    query: input.customerInput,
    intent: triage.intent,
  })
  const composed = await agentActivities.runComposerActivity({
    orgId: input.orgId,
    input: input.customerInput,
    intent: triage.intent,
    sources: knowledge.sources,
  })

  const needsHITL = composed.confidence < 85 || composed.policyViolation

  if (!needsHITL) {
    return {
      agentRunId: input.agentRunId,
      status: "completed",
      hitlRequired: false,
      output: composed.output,
      confidence: composed.confidence,
      citations: composed.citations,
    }
  }

  const hitlTimeoutMinutes = input.hitlTimeoutMinutes ?? 10

  // Execute -> Sandbox Created -> Hibernate — same activities the Temporal
  // path used, called directly instead of via proxyActivities.
  const sandbox = await createSandboxSessionActivity({
    workflowId: input.agentRunId,
    ticketId: input.ticketId,
    hitlTimeoutMinutes,
  })
  await executeAgentInSandboxActivity({ workflowId: input.agentRunId, ...sandbox, payload: composed.output })
  await hibernateSandboxActivity({ workflowId: input.agentRunId, ...sandbox })

  // Persist the draft to Postgres — this is what lets resume-ticket.ts
  // continue correctly from a different invocation/container. (The dynamic
  // mount in fc-sandbox-client.ts's simulated backend also writes this to
  // local disk, but local disk does not survive across separate serverless
  // invocations, only within one long-lived process — this DB write is the
  // one that's actually load-bearing here.)
  await db
    .update(sandboxSessions)
    .set({
      draftOutput: composed.output,
      draftConfidence: composed.confidence,
      draftCitations: composed.citations,
    })
    .where(eq(sandboxSessions.workflowId, input.agentRunId))

  return { agentRunId: input.agentRunId, status: "awaiting_approval", hitlRequired: true }
}
