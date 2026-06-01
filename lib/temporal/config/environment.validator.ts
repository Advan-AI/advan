/**
 * Pure configuration model for Temporal connectivity.
 * Decoupled from transport (gRPC / SDK connection objects).
 */

export interface TemporalEnvConfig {
  /** TEMPORAL_ADDRESS — host:port of Temporal frontend */
  readonly address: string
  /** TEMPORAL_NAMESPACE — logical namespace on the cluster */
  readonly namespace: string
  /** TEMPORAL_CERT — optional base64-encoded client certificate material (PEM) */
  readonly certBase64: string | undefined
  /** TEMPORAL_KEY — optional base64-encoded client private key material (PEM) */
  readonly keyBase64: string | undefined
}

export const DEFAULT_TEMPORAL_ADDRESS = "localhost:7233"
export const DEFAULT_TEMPORAL_NAMESPACE = "default"

/**
 * Type-safe extraction of Temporal settings from a process-like env bag.
 * Defaults favor local Temporal dev server (no TLS).
 */
export function parseTemporalConfig(
  env: NodeJS.ProcessEnv = typeof process !== "undefined" && process.env
    ? process.env
    : ({} as NodeJS.ProcessEnv)
): TemporalEnvConfig {
  const rawAddress = env.TEMPORAL_ADDRESS?.trim()
  const rawNamespace = env.TEMPORAL_NAMESPACE?.trim()
  const certBase64 = env.TEMPORAL_CERT?.trim() || undefined
  const keyBase64 = env.TEMPORAL_KEY?.trim() || undefined

  const address = rawAddress && rawAddress.length > 0 ? rawAddress : DEFAULT_TEMPORAL_ADDRESS
  const namespace =
    rawNamespace && rawNamespace.length > 0 ? rawNamespace : DEFAULT_TEMPORAL_NAMESPACE

  return {
    address,
    namespace,
    certBase64,
    keyBase64,
  }
}
