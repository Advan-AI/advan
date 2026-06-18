import { SuggestionService } from "./suggestion-service"
import { confidenceScorer } from "./scorer"
import {
  DrizzleAudit,
  DrizzleHitl,
  GovernanceGrounding,
  OpaPolicy,
  PgVectorRetrieval,
  StreamingComposer,
} from "./adapters"

/**
 * Composition root (Dependency Injection).
 *
 * The ONLY place that knows about concrete adapters. Tests can build a
 * SuggestionService with fakes; the route handler calls this. Swap a provider
 * here without touching the service or the transport layer.
 */
export function buildSuggestionService(): SuggestionService {
  return new SuggestionService(
    new PgVectorRetrieval(),
    new StreamingComposer(),
    new GovernanceGrounding(),
    new OpaPolicy(),
    confidenceScorer,
    new DrizzleAudit(),
    new DrizzleHitl()
  )
}
