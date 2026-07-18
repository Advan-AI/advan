import type { TemporalEnvConfig } from "../config/environment.validator"

export type TlsClientCertPair = {
  clientCertPair: { crt: Buffer; key: Buffer }
}

/**
 * Shared TLS material decoding for Temporal client and worker connections.
 */
export function decodeTemporalCertificate(base64Str: string | undefined): Buffer | undefined {
  if (!base64Str?.trim()) {
    return undefined
  }
  const trimmed = base64Str.trim()

  if (trimmed.includes("-----BEGIN")) {
    const normalized = trimmed.replace(/\\n/g, "\n").replace(/\r\n/g, "\n")
    return Buffer.from(normalized, "utf8")
  }

  const fromBase64 = Buffer.from(trimmed, "base64")
  const asUtf8 = fromBase64.toString("utf8")
  if (asUtf8.includes("-----BEGIN")) {
    return Buffer.from(asUtf8.replace(/\r\n/g, "\n"), "utf8")
  }

  return fromBase64
}

export function resolveTemporalTls(config: TemporalEnvConfig): TlsClientCertPair | undefined {
  const { certBase64, keyBase64 } = config
  if ((certBase64 && !keyBase64) || (!certBase64 && keyBase64)) {
    throw new Error(
      "[Temporal] TEMPORAL_CERT and TEMPORAL_KEY must both be set for mTLS, or both omitted for plaintext."
    )
  }
  if (!certBase64 || !keyBase64) {
    return undefined
  }

  const crt = decodeTemporalCertificate(certBase64)
  const key = decodeTemporalCertificate(keyBase64)
  if (!crt?.length || !key?.length) {
    throw new Error("[Temporal] Failed to decode TEMPORAL_CERT / TEMPORAL_KEY material.")
  }

  return { clientCertPair: { crt, key } }
}
