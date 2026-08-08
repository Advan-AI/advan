import { proxyActivities, condition, setHandler, defineSignal, workflowInfo } from "@temporalio/workflow"
import type { AgentActivities } from "../activities/agent-activities"
import type { SandboxActivities } from "../activities/sandbox-activities"

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

// FC Sandbox lifecycle activities — short timeout, minimal retries. These
// wrap network calls to the sandbox runtime + a DB write; they are not on
// the LLM critical path so they should fail fast rather than hold up HITL.
const {
  createSandboxSessionActivity,
  executeAgentInSandboxActivity,
  hibernateSandboxActivity,
  wakeAndResumeSandboxActivity,
  completeSandboxSessionActivity,
} = proxyActivities<SandboxActivities>({
  startToCloseTimeout: "15 seconds",
  retry: { maximumAttempts: 2, initialInterval: "1s" },
})

export const hitlDecisionSignal = defineSignal<[{ approved: boolean; editedOutput?: string }]>(
  "hitl-decision"
)

export interface TicketResolutionInput {
  orgId: string
  ticketId: string
  customerInput: string
  /** Hibernation policy: minutes to wait for a human decision before
   *  auto-escalating (default 10). Resolved once at workflow start — read
   *  from input, never from `process.env`, so replay stays deterministic. */
  hitlTimeoutMinutes?: number
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
 *
 * FC Sandbox extension: while paused for HITL, the composed draft is run
 * inside an FC Sandbox session, which is then hibernated for the wait (no
 * compute billed while idle) and woken + resumed once a human approves —
 * see docs/FC_SANDBOX.md and the /demo/fc-sandbox page.
 */
export async function ticketResolutionWorkflow(
  input: TicketResolutionInput
): Promise<TicketResolutionResult> {
  const workflowId = workflowInfo().workflowId

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
    const hitlTimeoutMinutes = input.hitlTimeoutMinutes ?? 10

    // 4a. Sandbox created + agent executed inside it, then hibernated for the wait.
    const sandbox = await createSandboxSessionActivity({
      workflowId,
      ticketId: input.ticketId,
      hitlTimeoutMinutes,
    })
    await executeAgentInSandboxActivity({ workflowId, ...sandbox, payload: composed.output })
    await hibernateSandboxActivity({ workflowId, ...sandbox })

    let hitlDecision: { approved: boolean; editedOutput?: string } | null = null

    setHandler(hitlDecisionSignal, (decision: { approved: boolean; editedOutput?: string }) => {
      hitlDecision = decision
    })

    // Wait up to the configured hibernation policy window for a human
    // decision — the sandbox stays hibernated for this entire span, this is
    // the "Waiting for Approval" phase. Signal-driven (Temporal `condition`),
    // not a polling loop.
    const resolved = await condition(() => hitlDecision !== null, `${hitlTimeoutMinutes} minutes`)

    if (!resolved || !(hitlDecision as unknown as { approved: boolean } | null)?.approved) {
      await completeSandboxSessionActivity({ workflowId, ...sandbox, status: "escalated" })
      return {
        output: "This request has been escalated to a human agent. They will follow up shortly.",
        confidence: composed.confidence,
        citations: composed.citations,
        hitlRequired: true,
        approved: false,
      }
    }

    // 4b. Human approved — wake the same sandbox session and resume execution.
    const decision = hitlDecision as unknown as { approved: boolean; editedOutput?: string }
    const resumeResult = await wakeAndResumeSandboxActivity({
      workflowId,
      ...sandbox,
      priorOutput: composed.output,
    })
    await completeSandboxSessionActivity({ workflowId, ...sandbox, status: "completed" })

    return {
      output: decision.editedOutput ?? resumeResult.output,
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
