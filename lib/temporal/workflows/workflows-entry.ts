/**
 * Stable entry module for the Temporal workflow bundler / dev worker.
 * Keeps `require.resolve(...)` in the worker daemon deterministic.
 */
export { ticketResolutionWorkflow } from "./ticket-resolution"
