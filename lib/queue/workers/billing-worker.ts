import { Worker, type Job } from "bullmq"
import { reportUsageToStripe } from "@/lib/billing/usage-reporter"
import { scheduleBillingUsageReporting } from "../queues"

function getConnectionConfig() {
  const url = process.env.REDIS_URL
  if (!url) {
    throw new Error("[BillingWorker] REDIS_URL is not set. Redis is required for BullMQ.")
  }
  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    tls: url.startsWith("rediss://") ? {} : undefined,
    maxRetriesPerRequest: null as null,
    enableReadyCheck: false,
    family: 0,
  }
}

/**
 * Worker to process scheduled billing tasks (such as hourly usage reporting sweeps).
 */
export function startBillingWorker() {
  const worker = new Worker<{ type: "report_usage" }>(
    "billing",
    async (job: Job<{ type: "report_usage" }>) => {
      console.log(`[BillingWorker] Processing billing job: ${job.name} (ID: ${job.id})`)

      if (job.name === "report_usage") {
        const results = await reportUsageToStripe()
        console.log(`[BillingWorker] Usage sweep completed. Repor results:`, results)
      } else {
        console.warn(`[BillingWorker] Received unknown job type: ${job.name}`)
      }
    },
    {
      connection: getConnectionConfig(),
      concurrency: 1, // Single-threaded processing to avoid any race condition on Stripe reports
    }
  )

  worker.on("completed", (job) => {
    console.log(`[BillingWorker] Job ${job.id} completed successfully.`)
  })

  worker.on("failed", (job, err) => {
    console.error(`[BillingWorker] Job ${job?.id} failed with error:`, err.message)
  })

  // Proactively register the hourly repeatable job on startup
  scheduleBillingUsageReporting().catch((err) => {
    console.error("[BillingWorker] Failed to schedule hourly repeatable job:", err.message)
  })

  return worker
}

const isMain =
  typeof process !== "undefined" &&
  process.argv[1]?.includes("billing-worker")

if (isMain) {
  console.log("[BillingWorker] Initializing Billing background service...")
  startBillingWorker()
}
