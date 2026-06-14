import { Connection, type ConnectionOptions } from "@temporalio/client"
import { NativeConnection, type NativeConnectionOptions, type TLSConfig } from "@temporalio/worker"
import type { TemporalEnvConfig } from "../config/environment.validator"

/**
 * Encapsulates gRPC connection bootstrapping for Temporal Client and Worker.
 * Business code depends on this class + {@link TemporalEnvConfig}, not raw env reads.
 */
export class TemporalConnectionManager {
  constructor(private readonly config: TemporalEnvConfig) {}

  /**
   * Decodes env-provided certificate material: base64-wrapped PEM, escaped PEM, or raw PEM.
   */
  private decodeCertificate(base64Str: string | undefined): Buffer | undefined {
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

  private assertPairedTlsMaterial(): void {
    const { certBase64, keyBase64 } = this.config
    if ((certBase64 && !keyBase64) || (!certBase64 && keyBase64)) {
      throw new Error(
        "[TemporalConnectionManager] TEMPORAL_CERT and TEMPORAL_KEY must both be set for mTLS, or both omitted for plaintext."
      )
    }
  }

  private resolveTls(): TLSConfig | undefined {
    this.assertPairedTlsMaterial()
    const { certBase64, keyBase64 } = this.config
    if (!certBase64 || !keyBase64) {
      return undefined
    }

    const crt = this.decodeCertificate(certBase64)
    const key = this.decodeCertificate(keyBase64)
    if (!crt?.length || !key?.length) {
      throw new Error("[TemporalConnectionManager] Failed to decode TEMPORAL_CERT / TEMPORAL_KEY material.")
    }

    return {
      clientCertPair: { crt, key },
    }
  }

  private clientOptions(): ConnectionOptions {
    const tls = this.resolveTls()
    return {
      address: this.config.address,
      tls: tls ?? false,
    }
  }

  private workerOptions(): NativeConnectionOptions {
    const tls = this.resolveTls()
    return {
      address: this.config.address,
      tls: tls ?? false,
    }
  }

  async createClientConnection(): Promise<Connection> {
    return Connection.connect(this.clientOptions())
  }

  async createWorkerConnection(): Promise<NativeConnection> {
    return NativeConnection.connect(this.workerOptions())
  }
}
