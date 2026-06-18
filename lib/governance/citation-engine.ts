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

        const citations: Citation[] = sources.map((s) => ({
          sourceId: s.id,
          title: s.title,
          url: s.url,
          snippet: s.snippet ?? "Referenced context chunk",
          confidence: Math.round((scoreMap.get(s.id) ?? s.score ?? 0.7) * 100),
        }))

        const overall =
          citations.length > 0
            ? Math.round(citations.reduce((sum, c) => sum + c.confidence, 0) / citations.length)
            : 70

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
      const confidence = Math.min(95, Math.round(60 + (overlap / Math.max(sourceWords.length, 1)) * 40))

      return {
        sourceId: s.id,
        title: s.title,
        url: s.url,
        snippet: s.snippet ?? "Referenced context chunk",
        confidence: s.score ? Math.round(s.score * 100) : confidence,
      }
    })

    const overall =
      citations.length > 0
        ? Math.round(citations.reduce((sum, c) => sum + c.confidence, 0) / citations.length)
        : 70

    return { answer, citations, overallConfidence: overall }
  }
}
