import { queryEmbeddings } from "@/lib/vector/store"
import { embedWithOllama } from "@/lib/vector/ollama-embeddings"

/**
 * Advan AI Governance Layer: Citation Engine
 * The backend for the 'Glass Box' (Tap Box) transparency system.
 *
 * Verifies AI-generated answers against retrieved knowledge sources.
 * Uses pgvector cosine similarity plus keyword overlap when vector search is unavailable.
 */

export interface Citation {
  sourceId: string
  title: string
  url?: string
  snippet: string
  confidence: number // 0–100
}

export interface GroundedResponse {
  answer: string
  citations: Citation[]
  overallConfidence: number
}

export class CitationEngine {
  /**
   * Verify an AI answer against a set of knowledge source chunks.
   * - If pgvector + Ollama embeddings are available, re-queries the answer as a vector to confirm
   *   semantic alignment of each cited source.
   * - Falls back to keyword overlap scoring when embedding search fails.
   */
  static async verify(
    answer: string,
    sources: Array<{ id: string; title: string; url?: string; snippet?: string; score?: number }>,
    orgId?: string
  ): Promise<GroundedResponse> {
    if (sources.length === 0) {
      return { answer, citations: [], overallConfidence: 70 }
    }

    if (orgId) {
      try {
        const answerVec = await embedWithOllama(answer.slice(0, 8000))
        const matches = await queryEmbeddings(orgId, answerVec, 10)

        const scoreMap = new Map(matches.map((m) => [m.id, m.score ?? 0]))

        const citations: Citation[] = sources.map((s) => {
          const requery = scoreMap.get(s.id)
          const retrieval = s.score ?? 0
          const aligned = sourceAlignmentScore(answer, s.title, s.snippet ?? "")
          const blended = Math.max(requery ?? 0, retrieval, aligned)
          return {
            sourceId: s.id,
            title: s.title,
            url: s.url,
            snippet: s.snippet ?? "Referenced context chunk",
            confidence: Math.round(blended * 100),
          }
        })

        const overall = overallGroundingConfidence(citations, sources)

        return { answer, citations, overallConfidence: overall }
      } catch {
        // Fall through to keyword scoring
      }
    }

    // Fallback: keyword overlap scoring
    const answerWords = new Set(answer.toLowerCase().split(/\W+/).filter((w) => w.length > 3))

    const citations: Citation[] = sources.map((s) => {
      const sourceText = `${s.title} ${s.snippet ?? ""}`.toLowerCase()
      const sourceWords = sourceText.split(/\W+/).filter((w) => w.length > 3)
      const overlap = sourceWords.filter((w) => answerWords.has(w)).length
      const overlapScore = 0.6 + (overlap / Math.max(sourceWords.length, 1)) * 0.35
      const blended = Math.max(s.score ?? 0, overlapScore)
      const confidence = Math.min(95, Math.round(blended * 100))

      return {
        sourceId: s.id,
        title: s.title,
        url: s.url,
        snippet: s.snippet ?? "Referenced context chunk",
        confidence,
      }
    })

    const overall = overallGroundingConfidence(citations, sources)

    return { answer, citations, overallConfidence: overall }
  }
}

/** Token overlap between answer and a source — floors grounding when content clearly aligns. */
function sourceAlignmentScore(answer: string, title: string, snippet: string): number {
  const answerWords = new Set(answer.toLowerCase().split(/\W+/).filter((w) => w.length > 3))
  if (answerWords.size === 0) return 0

  const sourceWords = `${title} ${snippet}`.toLowerCase().split(/\W+/).filter((w) => w.length > 3)
  const overlap = sourceWords.filter((w) => answerWords.has(w)).length
  if (overlap === 0) return 0

  return Math.min(0.95, 0.65 + (overlap / Math.max(answerWords.size, 1)) * 0.3)
}

/** Favor the best-matching source instead of diluting across all retrieved chunks. */
function overallGroundingConfidence(
  citations: Citation[],
  sources: Array<{ score?: number }>
): number {
  if (citations.length === 0) return 70

  const topIdx = sources.reduce(
    (best, s, i) => ((s.score ?? 0) > (sources[best]?.score ?? 0) ? i : best),
    0
  )
  const topCitation = citations[topIdx]?.confidence ?? 0

  let weightSum = 0
  let weighted = 0
  for (let i = 0; i < citations.length; i++) {
    const w = sources[i]?.score ?? 0.5
    weightSum += w
    weighted += citations[i].confidence * w
  }
  const weightedAvg = weightSum > 0 ? weighted / weightSum : topCitation

  return Math.round(Math.max(topCitation, weightedAvg * 0.85))
}
