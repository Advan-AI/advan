import { orchestrationEngine } from "./engine"
import { db } from "@/lib/db"
import { auditLogs } from "@/lib/db/schema"
import { CitationEngine } from "@/lib/governance/citation-engine"
import { HallucinationDetector } from "@/lib/governance/hallucination-detector"
import { PolicyClient } from "@/lib/governance/policy-client"
import { PIIMasker } from "@/lib/governance/pii-masker"
import { HumanMessage } from "@langchain/core/messages"

/**
 * Advan AI Workflow Executor (Layer 4)
 *
 * Execution pipeline:
 * 1. PII masking (Presidio pattern)
 * 2. Policy pre-check (OPA safety + intent)
 * 3. LangGraph multi-agent execution
 * 4. Citation Engine verification
 * 5. Hallucination detection
 * 6. Policy post-check (confidence / handoff)
 * 7. Audit log persistence
 */
export class WorkflowExecutor {
  static async run(orgId: string, input: string, ticketId?: string) {
    const start = Date.now()
    console.log(`[Executor] Starting workflow for org: ${orgId}`)

    // Stage 1: PII masking
    const maskedInput = PIIMasker.mask(input)

    // Stage 2: Pre-execution policy check
    const prePolicy = await PolicyClient.evaluate("advan/safety/intent", {
      intent: maskedInput.slice(0, 200),
      emergency_lock: false,
      toxic: false,
    })

    if (!prePolicy.allow) {
      return {
        answer: prePolicy.remediation ?? "Request blocked by safety policy.",
        citations: [],
        overallConfidence: 0,
        policyBlock: true,
        reason: prePolicy.reason,
      }
    }

    // Stage 3: LangGraph execution
    const result = await orchestrationEngine.invoke({
      messages: [new HumanMessage(maskedInput)],
    })
    const lastMessage = result.messages[result.messages.length - 1]
    const rawAnswer = lastMessage.content?.toString() ?? ""

    // Stage 4: Citation verification
    const grounded = await CitationEngine.verify(rawAnswer, [], orgId)

    // Stage 5: Hallucination detection
    const hallucinationResult = await HallucinationDetector.detect(
      grounded.answer,
      grounded.citations.map((c) => ({
        id: c.sourceId,
        title: c.title,
        snippet: c.snippet,
        score: c.confidence / 100,
      })),
      orgId
    )

    // Stage 6: Post-execution policy checks (confidence + PII in output)
    const handoffPolicy = await PolicyClient.evaluate("advan/handoff", {
      confidence: grounded.overallConfidence,
    })

    const piiPolicy = await PolicyClient.evaluate("advan/privacy/pii", {
      has_pii: PIIMasker.hasPII(grounded.answer),
      masked: false,
    })

    const policyChecks = [
      { rule: "advan/safety/intent", passed: prePolicy.allow },
      { rule: "advan/handoff", passed: handoffPolicy.allow, reason: handoffPolicy.reason },
      { rule: "advan/privacy/pii", passed: piiPolicy.allow, reason: piiPolicy.reason },
    ]

    // Stage 7: Persist audit log
    const latencyMs = Date.now() - start

    await db.insert(auditLogs).values({
      orgId,
      ticketId: ticketId ?? null,
      input: maskedInput,
      output: grounded.answer,
      metadata: {
        confidence: grounded.overallConfidence,
        citations: grounded.citations.map((c) => ({
          source: c.title,
          content: c.snippet,
          score: c.confidence,
          url: c.url,
        })),
        policyChecks,
        latencyMs,
        hallucinationFlags: hallucinationResult.flags,
        model: "claude-3-5-sonnet-20240620",
      },
    })

    return {
      ...grounded,
      hallucinationResult,
      policyChecks,
      latencyMs,
      hitlRequired: !handoffPolicy.allow,
      hitlReason: handoffPolicy.reason,
    }
  }

  /**
   * Streams the graph execution steps (for real-time UI updates via SSE).
   */
  static async *stream(orgId: string, input: string) {
    const maskedInput = PIIMasker.mask(input)
    const stream = await orchestrationEngine.stream({
      messages: [new HumanMessage(maskedInput)],
    })

    for await (const step of stream) {
      yield step
    }
  }
}
