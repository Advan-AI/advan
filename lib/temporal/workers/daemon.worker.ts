import { existsSync } from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { Worker } from "@temporalio/worker"
import { agentActivities } from "../activities/agent-activities"
import { pipelineActivities } from "../activities/pipeline-activities"
import { sandboxActivities } from "../activities/sandbox-activities"
import { parseTemporalConfig } from "../config/environment.validator"
import { TemporalWorkerConnectionManager } from "../services/worker.connection"

const DEFAULT_TASK_QUEUE = "advan-agents"
const SHUTDOWN_GRACE_MS = 30_000
function resolveWorkflowBundlePath(): string {
  const fromEnv = process.env.TEMPORAL_WORKFLOW_BUNDLE_PATH?.trim()
  if (fromEnv && fromEnv.length > 0) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.join(process.cwd(), fromEnv)
  }
  return path.join(process.cwd(), "lib", "temporal", "dist", "workflow-bundle.js")
}

function resolveDevWorkflowsPath(): string {
  const require = createRequire(import.meta.url)
  return require.resolve("../workflows/workflows-entry.ts")
}

/**
 * Standalone Temporal worker daemon (safe to import; no auto-start).
 * Run: `npm run temporal:worker` or `npx tsx lib/temporal/worker.ts`
 */
export async function runTemporalWorkerDaemon(): Promise<void> {
  const envConfig = parseTemporalConfig()
  const connectionManager = new TemporalWorkerConnectionManager(envConfig)
  const connection = await connectionManager.createWorkerConnection()

  const isProduction = process.env.NODE_ENV === "production"
  const bundlePath = resolveWorkflowBundlePath()
  const bundleExists = existsSync(bundlePath)

  let workflowLoader: { workflowBundle: { codePath: string } } | { workflowsPath: string }
  if (isProduction) {
    if (!bundleExists) {
      throw new Error(
        `[TemporalWorker] Production mode requires a pre-built workflow bundle at ${bundlePath}. ` +
          `Run \`npm run temporal:bundle\` or set TEMPORAL_WORKFLOW_BUNDLE_PATH.`
      )
    }
    workflowLoader = { workflowBundle: { codePath: bundlePath } }
  } else {
    workflowLoader = { workflowsPath: resolveDevWorkflowsPath() }
  }

  const worker = await Worker.create({
    ...workflowLoader,
    connection,
    namespace: envConfig.namespace,
    activities: { ...agentActivities, ...pipelineActivities, ...sandboxActivities },
    taskQueue: process.env.TEMPORAL_TASK_QUEUE?.trim() || DEFAULT_TASK_QUEUE,
    shutdownGraceTime: SHUTDOWN_GRACE_MS,
  })

  let shutdownRequested = false
  const requestShutdown = (): void => {
    if (shutdownRequested) {
      return
    }
    shutdownRequested = true
    void worker.shutdown()
  }

  process.once("SIGINT", requestShutdown)
  process.once("SIGTERM", requestShutdown)

  try {
    // eslint-disable-next-line no-console
    console.log(
      `[TemporalWorker] Polling task queue "${process.env.TEMPORAL_TASK_QUEUE?.trim() || DEFAULT_TASK_QUEUE}" ` +
        `(${isProduction ? `bundle: ${bundlePath}` : "dev workflowsPath"})`
    )
    await worker.run()
  } finally {
    await connection.close()
  }
}
