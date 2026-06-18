/**
 * Co-Pilot domain contract (Feature 1).
 *
 * Defines the transport-agnostic event stream and the hexagonal ports that the
 * SuggestionService depends on. Adapters (LangChain, pgvector, OPA, Drizzle)
 * implement these ports — the service and the route never import a concretion.
 *
 * This is the Dependency Inversion boundary: swap any provider without touching
 * orchestration logic.
 */

export interface Citation {
  sourceId: string
  title: string
  url?: string
  snippet: string
  confidence: number // 0–100
}

export interface PolicyCheck {
  rule: string
  passed: boolean
  reason?: string
}

export interface Source {
  id: string
  title: string
  url?: string
  snippet: string
  score: number // 0–1 cosine similarity
}

/** Discriminated union streamed to the client over SSE. */
export type SuggestionEvent =
  | { type: "token"; text: string }
  | { type: "citation"; citation: Citation }
  | { type: "score"; stage: "retrieval" | "final"; value: number }
  | { type: "policy"; checks: PolicyCheck[] }
  | { type: "hitl"; required: boolean; reason?: string; hitlId?: string }
  | { type: "done"; suggestionId: string; latencyMs: number; finalText: string }
  | { type: "error"; message: string; recoverable: boolean }

export interface SuggestionContext {
  orgId: string
  userId: string
  input: string
  ticketId?: string
  /** Confidence threshold (0–100) below which HITL review is required. */
  threshold: number
}

/** Raw signals fed to the scorer. All 0–1. Missing signals are ignored. */
export interface ConfidenceSignals {
  retrieval?: number
  grounding?: number
  hallucination?: number
  policy?: number
}

// ─── Ports (hexagonal boundaries) ────────────────────────────────────────────

export interface RetrievalPort {
  retrieve(orgId: string, query: string, k: number): Promise<Source[]>
}

export interface ComposerPort {
  /** Streams answer tokens. Implementations MUST be a single pass. */
  compose(input: { input: string; intent?: string; sources: Source[] }): AsyncIterable<string>
}

export interface GroundingResult {
  answer: string
  citations: Citation[]
  groundingScore: number // 0–1
  hallucination: { isHallucination: boolean; score: number; flags: string[] }
}

export interface GroundingPort {
  ground(answer: string, sources: Source[], orgId: string): Promise<GroundingResult>
}

export interface PolicyPort {
  preCheck(input: string): Promise<{ allow: boolean; reason?: string }>
  postCheck(args: { answer: string; confidence: number }): Promise<PolicyCheck[]>
}

export interface AuditPort {
  persist(args: {
    ctx: SuggestionContext
    answer: string
    confidence: number
    checks: PolicyCheck[]
    citations: Citation[]
    hallucinationFlags: string[]
    latencyMs: number
  }): Promise<string>
}

export interface HitlPort {
  /** Enqueue a review item; returns the queue id and broadcasts hitl:new. */
  enqueue(args: {
    orgId: string
    ticketId?: string
    draftOutput: string
    reason: string
  }): Promise<string>
}

export interface ScorerPort {
  score(signals: ConfidenceSignals): number // 0–100
}
