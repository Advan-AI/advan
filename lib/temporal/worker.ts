/**
 * Temporal worker CLI entry — thin wrapper over the hardened daemon.
 *
 * Start: `npx tsx lib/temporal/worker.ts`
 * or: `npm run temporal:worker`
 */
import { runTemporalWorkerDaemon } from "./workers/daemon.worker"

void runTemporalWorkerDaemon().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error("[TemporalWorker] Fatal error:", err)
  process.exit(1)
})
