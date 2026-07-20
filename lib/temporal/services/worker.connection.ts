import { NativeConnection, type NativeConnectionOptions } from "@temporalio/worker"
import type { TemporalEnvConfig } from "../config/environment.validator"
import { resolveTemporalTls } from "./connection-tls"

/**
 * gRPC connection bootstrap for the Temporal **worker** daemon only.
 * Import from worker scripts — not from Next.js app code.
 */
export class TemporalWorkerConnectionManager {
  constructor(private readonly config: TemporalEnvConfig) {}

  private workerOptions(): NativeConnectionOptions {
    const tls = resolveTemporalTls(this.config)
    return {
      address: this.config.address,
      tls: tls ?? false,
    }
  }

  async createWorkerConnection(): Promise<NativeConnection> {
    return NativeConnection.connect(this.workerOptions())
  }
}
