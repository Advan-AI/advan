import { Connection, type ConnectionOptions } from "@temporalio/client"
import type { TemporalEnvConfig } from "../config/environment.validator"
import { resolveTemporalTls } from "./connection-tls"

/**
 * gRPC connection bootstrap for the Temporal **client** (Next.js / API routes).
 * Does not import `@temporalio/worker` — safe for Next.js bundling.
 */
export class TemporalClientConnectionManager {
  constructor(private readonly config: TemporalEnvConfig) {}

  private clientOptions(): ConnectionOptions {
    const tls = resolveTemporalTls(this.config)
    return {
      address: this.config.address,
      tls: tls ?? false,
    }
  }

  async createClientConnection(): Promise<Connection> {
    return Connection.connect(this.clientOptions())
  }
}
