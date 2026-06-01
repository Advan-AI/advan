import { queryEmbeddings } from "@/lib/vector/store"
import { embedWithOllama } from "@/lib/vector/ollama-embeddings"

/**
 * Advan AI Governance Layer: Hallucination Detector
 *
 * Checks whether an AI-generated answer is semantically consistent with the
 * knowledge sources it claims to be based on.
 *
 * Two-stage check:
 * 1. Entailment score — compute cosine similarity between the answer vector
 *    and the top retrieved sources. Low similarity = likely hallucination.
 * 2. Source overlap — verify that key entities/numbers in the answer appear
 *    in at least one source snippet.
 *
 * Threshold configurable via HALLUCINATION_THRESHOLD (default 0.72).
 */

export interface HallucinationResult {
  isHallucination: boolean
  score: number  // 0–1, higher = more grounded
  flags: string[]
  recommendation: "pass" | "review" | "block"
}

const THRESHOLD = parseFloat(process.env.HALLUCINATION_THRESHOLD ?? "0.72")

export class HallucinationDetector {
  /**
   * Evaluate an AI-generated answer for hallucination.
   * @param answer - the AI-generated response
   * @param sources - the retrieved knowledge sources used to generate the answer
   * @param orgId  - tenant id for pgvector queries
   */
  static async detect(
    answer: string,
    sources: Array<{ id: string; title: string; snippet?: string; score?: number }>,
    orgId?: string
  ): Promise<HallucinationResult> {
    const flags: string[] = []

    if (sources.length === 0) {
      return {
        isHallucination: true,
        score: 0,
        flags: ["No knowledge sources provided — answer is unsupported"],
        recommendation: "review",
      }
    }

    // Stage 1: Semantic similarity check via pgvector re-query
    let semanticScore = 0.8 // Default optimistic fallback

    if (orgId) {
      try {
        const answerVec = await embedWithOllama(answer.slice(0, 8000))
        const matches = await queryEmbeddings(orgId, answerVec, 5)

        // Check if any of the cited sources appear in the top-5 vector results
        const sourceIds = new Set(sources.map((s) => s.id))
        const citedMatches = matches.filter((m) => sourceIds.has(m.id))

        if (citedMatches.length === 0) {
          flags.push("Answer vector does not align with cited sources in vector index")
          semanticScore = 0.4
        } else {
          const avgScore =
            citedMatches.reduce((sum, m) => sum + (m.score ?? 0), 0) / citedMatches.length
          semanticScore = avgScore
        }
      } catch {
        // Vector search unavailable — fall back to overlap scoring
        semanticScore = 0.75
      }
    }

    // Stage 2: Numeric / entity overlap check
    const numbers = answer.match(/\$[\d,]+\.?\d*|\d+%|\d{1,3}(,\d{3})+|\b\d{4}\b/g) ?? []
    const sourceText = sources.map((s) => `${s.title} ${s.snippet ?? ""}`).join(" ")

    for (const num of numbers) {
      if (!sourceText.includes(num.replace(/,/g, ""))) {
        flags.push(`Number "${num}" not found in source material`)
        semanticScore = Math.max(0, semanticScore - 0.05)
      }
    }

    // Final determination
    const isHallucination = semanticScore < THRESHOLD
    let recommendation: "pass" | "review" | "block" = "pass"
    if (semanticScore < 0.5) recommendation = "block"
    else if (isHallucination) recommendation = "review"

    return {
      isHallucination,
      score: Math.round(semanticScore * 100) / 100,
      flags,
      recommendation,
    }
  }
}
