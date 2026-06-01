import { Client } from "@temporalio/client"
import { parseTemporalConfig } from "../config/environment.validator"
import { TemporalConnectionManager } from "../services/connection.manager"

type GlobalWithTemporal = typeof globalThis & {
  __ADVAN_TEMPORAL_CLIENT__?: Client
  __ADVAN_TEMPORAL_CLIENT_PROMISE__?: Promise<Client> | undefined
}

function getGlobalStore(): GlobalWithTemporal {
  return globalThis as GlobalWithTemporal
}

async function instantiateClient(): Promise<Client> {
  const envConfig = parseTemporalConfig()
  const connectionManager = new TemporalConnectionManager(envConfig)
  const connection = await connectionManager.createClientConnection()
  return new Client({
    connection,
    namespace: envConfig.namespace,
  })
}

/**
 * Lazily constructs a singleton {@link Client} for the app process.
 * Uses `globalThis` so Next.js dev HMR does not register duplicate channels.
 */
export async function getTemporalClient(): Promise<Client> {
  const g = getGlobalStore()
  if (g.__ADVAN_TEMPORAL_CLIENT__) {
    return g.__ADVAN_TEMPORAL_CLIENT__
  }
  if (!g.__ADVAN_TEMPORAL_CLIENT_PROMISE__) {
    g.__ADVAN_TEMPORAL_CLIENT_PROMISE__ = instantiateClient().catch((err: unknown) => {
      g.__ADVAN_TEMPORAL_CLIENT_PROMISE__ = undefined
      throw err
    })
  }
  const client = await g.__ADVAN_TEMPORAL_CLIENT_PROMISE__
  g.__ADVAN_TEMPORAL_CLIENT__ = client
  g.__ADVAN_TEMPORAL_CLIENT_PROMISE__ = undefined
  return client
}

/**
 * Signal a running HITL workflow to resume after agent approval/rejection.
 */
export async function signalHITLDecision(
  workflowId: string,
  decision: { approved: boolean; editedOutput?: string }
): Promise<void> {
  const client = await getTemporalClient()
  const handle = client.workflow.getHandle(workflowId)
  await handle.signal("hitl-decision", decision)
}
