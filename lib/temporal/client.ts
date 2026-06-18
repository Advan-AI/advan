/**
 * Backwards-compatible barrel — prefer `@/lib/temporal/clients/workflow.client` for new code.
 */
export { getTemporalClient, signalHITLDecision } from "./clients/workflow.client"
