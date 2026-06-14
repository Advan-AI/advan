import { proxyActivities, condition, setHandler, defineSignal } from "@temporalio/workflow"
import type { AgentActivities } from "../activities/agent-activities"

const { runTriageActivity, runKnowledgeActivity, runComposerActivity } =
  proxyActivities<AgentActivities>({
    startToCloseTimeout: "30 seconds",
    retry: {
      maximumAttempts: 3,
      initialInterval: "1s",
      backoffCoefficient: 2,
      maximumInterval: "30s",
    },
  })

export const hitlDecisionSignal = defineSignal<[{ approved: boolean; editedOutput?: string }]>(
  "hitl-decision"
)

export interface TicketResolutionInput {
  orgId: string
  ticketId: string
  customerInput: string
}

export interface TicketResolutionResult {
  output: string
  confidence: number
  citations: Array<{ source: string; url?: string; confidence: number }>
  hitlRequired: boolean
  approved?: boolean
}

/**
 * Durable ticket resolution workflow.
 * Stages: Ingest → Triage → Knowledge retrieval → Policy check → Compose → Resolve
 * Supports HITL: if confidence is below threshold, workflow pauses and waits
 * for an agent signal before delivering the final response.
 */
export async function ticketResolutionWorkflow(
  input: TicketResolutionInput
): Promise<TicketResolutionResult> {
  // Stage 1: Triage (Claude Haiku — fast intent classification)
  const triage = await runTriageActivity({
    orgId: input.orgId,
    text: input.customerInput,
  })

  // Stage 2: Knowledge retrieval based on classified intent
  const knowledge = await runKnowledgeActivity({
    orgId: input.orgId,
    query: input.customerInput,
    intent: triage.intent,
  })

  // Stage 3: Compose the response (Claude Sonnet)
  const composed = await runComposerActivity({
    orgId: input.orgId,
    input: input.customerInput,
    intent: triage.intent,
    sources: knowledge.sources,
  })

  // Stage 4: HITL gate — pause if confidence below threshold or policy flagged
  const needsHITL = composed.confidence < 85 || composed.policyViolation

  if (needsHITL) {
    let hitlDecision: { approved: boolean; editedOutput?: string } | null = null

    setHandler(hitlDecisionSignal, (decision: { approved: boolean; editedOutput?: string }) => {
      hitlDecision = decision
    })

    // Wait up to 10 minutes for an agent decision
    const resolved = await condition(() => hitlDecision !== null, "10 minutes")

    if (!resolved || !(hitlDecision as unknown as { approved: boolean } | null)?.approved) {
      return {
        output: "This request has been escalated to a human agent. They will follow up shortly.",
        confidence: composed.confidence,
        citations: composed.citations,
        hitlRequired: true,
        approved: false,
      }
    }

    const decision = hitlDecision as unknown as { approved: boolean; editedOutput?: string }
    return {
      output: decision.editedOutput ?? composed.output,
      confidence: composed.confidence,
      citations: composed.citations,
      hitlRequired: true,
      approved: true,
    }
  }

  return {
    output: composed.output,
    confidence: composed.confidence,
    citations: composed.citations,
    hitlRequired: false,
  }
}
