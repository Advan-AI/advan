import type { ConfidenceSignals, ScorerPort } from "./types"

/**
 * Composite confidence scorer.
 *
 *   confidence = Σ (wᵢ · signalᵢ) / Σ wᵢ   over the signals that are present.
 *
 * Re-normalising over present signals means an early (retrieval-only) score and
 * a late (fully-grounded) score are both well-formed 0–100 values — enabling the
 * progressive "provisional → final" ring animation in the UI without ever
 * computing on the client.
 */
export class WeightedConfidenceScorer implements ScorerPort {
  private static readonly WEIGHTS: Required<ConfidenceSignals> = {
    retrieval: 0.25,
    grounding: 0.35,
    hallucination: 0.3,
    policy: 0.1,
  }

  score(signals: ConfidenceSignals): number {
    const w = WeightedConfidenceScorer.WEIGHTS
    let num = 0
    let den = 0
    for (const key of Object.keys(w) as (keyof ConfidenceSignals)[]) {
      const v = signals[key]
      if (typeof v === "number" && Number.isFinite(v)) {
        num += w[key] * clamp01(v)
        den += w[key]
      }
    }
    if (den === 0) return 0
    return Math.round((num / den) * 100)
  }
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

export const confidenceScorer = new WeightedConfidenceScorer()
