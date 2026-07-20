import type {
  AuditPort,
  ComposerPort,
  GroundingPort,
  HitlPort,
  PolicyPort,
  RetrievalPort,
  ScorerPort,
  Source,
  SuggestionContext,
  SuggestionEvent,
} from "./types"

/**
 * SuggestionService — the single orchestrator for a Co-Pilot suggestion.
 *
 * Single Responsibility: turn a user prompt into a scored, grounded, governed
 * suggestion, emitting progress as a stream of domain events. It owns ZERO
 * transport, persistence, or model concerns — those live behind ports.
 *
 * Pipeline (single pass — no double LLM execution):
 *   1. PII pre-check (policy)
 *   2. Retrieve sources → provisional score
 *   3. Compose (stream tokens, accumulate answer)
 *   4. Ground accumulated answer (citations + hallucination)
 *   5. Final composite score + post-policy
 *   6. HITL gate (enqueue if below threshold)
 *   7. Audit persist → done
 */
export class SuggestionService {
  constructor(
    private readonly retrieval: RetrievalPort,
    private readonly composer: ComposerPort,
    private readonly grounding: GroundingPort,
    private readonly policy: PolicyPort,
    private readonly scorer: ScorerPort,
    private readonly audit: AuditPort,
    private readonly hitl: HitlPort
  ) {}

  async *run(ctx: SuggestionContext): AsyncGenerator<SuggestionEvent> {
    const t0 = Date.now()

    const pre = await this.policy.preCheck(ctx.input)
    if (!pre.allow) {
      yield { type: "error", message: pre.reason ?? "Blocked by safety policy.", recoverable: false }
      return
    }

    // 2) Retrieve + provisional score
    const sources = await this.retrieval.retrieve(ctx.orgId, ctx.input, 6)
    yield { type: "score", stage: "retrieval", value: this.scorer.score({ retrieval: meanScore(sources) }) }

    // 3) Compose — single streaming pass, accumulate for grounding
    let answer = ""
    try {
      for await (const token of this.composer.compose({ input: ctx.input, sources })) {
        answer += token
        yield { type: "token", text: token }
      }
    } catch (err) {
      yield { type: "error", message: `Composition failed: ${asMessage(err)}`, recoverable: true }
      return
    }

    // 4) Ground the accumulated answer against the same sources
    const grounded = await this.grounding.ground(answer, sources, ctx.orgId)
    for (const c of grounded.citations) yield { type: "citation", citation: c }

    // 5) Final composite score
    const confidence = this.scorer.score({
      retrieval: meanScore(sources),
      grounding: grounded.groundingScore,
      hallucination: grounded.hallucination.score,
      policy: undefined, // filled after post-check below
    })
    const checks = await this.policy.postCheck({ answer: grounded.answer, confidence })
    const finalConfidence = this.scorer.score({
      retrieval: meanScore(sources),
      grounding: grounded.groundingScore,
      hallucination: grounded.hallucination.score,
      policy: passRatio(checks.filter((c) => c.rule !== "advan/handoff")),
    })
    yield { type: "score", stage: "final", value: finalConfidence }
    yield { type: "policy", checks }

    // 6) HITL gate
    const needsHitl = finalConfidence < ctx.threshold || checks.some((c) => !c.passed)
    let hitlId: string | undefined
    if (needsHitl) {
      const reason =
        finalConfidence < ctx.threshold
          ? `Confidence ${finalConfidence}% below threshold ${ctx.threshold}%`
          : (checks.find((c) => !c.passed)?.reason ?? "Policy review required")
      hitlId = await this.hitl.enqueue({
        orgId: ctx.orgId,
        ticketId: ctx.ticketId,
        draftOutput: grounded.answer,
        reason,
      })
      yield { type: "hitl", required: true, reason, hitlId }
    } else {
      yield { type: "hitl", required: false }
    }

    // 7) Persist audit + done
    const latencyMs = Date.now() - t0
    const suggestionId = await this.audit.persist({
      ctx,
      answer: grounded.answer,
      confidence: finalConfidence,
      checks,
      citations: grounded.citations,
      hallucinationFlags: grounded.hallucination.flags,
      latencyMs,
    })

    yield { type: "done", suggestionId, latencyMs, finalText: grounded.answer }
  }
}

function meanScore(sources: Source[]): number {
  if (sources.length === 0) return 0.5
  return Math.max(...sources.map((s) => s.score))
}

function passRatio(checks: { passed: boolean }[]): number {
  if (checks.length === 0) return 1
  return checks.filter((c) => c.passed).length / checks.length
}

function asMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
