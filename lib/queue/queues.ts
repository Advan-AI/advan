import { Queue } from "bullmq"

/**
 * BullMQ queue connection via raw Redis URL.
 * For production, set REDIS_URL to your Upstash Redis TLS endpoint:
 *   rediss://default:<token>@<host>.upstash.io:6379
 *
 * BullMQ bundles its own ioredis so we pass the URL directly rather than
 * importing a separate ioredis instance.
 */
function getConnectionConfig() {
  const url = process.env.REDIS_URL
  if (!url) {
    throw new Error("[Queue] REDIS_URL is not set. BullMQ requires a raw Redis connection.")
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
 * Creates a lazy Queue instance using a Proxy.
 * This prevents throwing an error at module load/import time when REDIS_URL is not set
 * (e.g. during next build or static page generation).
 * The connection configuration is evaluated and the Queue is instantiated only when
 * the queue is first accessed/called at runtime.
 */
function createLazyQueue<T>(name: string, defaultOptions?: any): Queue<T> {
  let queueInstance: Queue<T> | null = null

  // Create a base fallback object that implements Queue methods we actually use
  const fallbackQueue = {
    async add(jobName: string, data: any, options?: any) {
      console.warn(`[Queue: ${name}] REDIS_URL not set. Running job '${jobName}' in-process as fallback.`)
      
      // Execute the worker logic asynchronously in the background so it doesn't block the caller
      ;(async () => {
        try {
          const fakeJob = {
            id: `fallback-${name}-${Date.now()}`,
            name: jobName,
            data: data,
            opts: options || {},
          } as any

          if (name === "notification") {
            const { processAgentReplyJob } = await import("./workers/notification-worker")
            await processAgentReplyJob(fakeJob)
          } else if (name === "copilot-triage") {
            const { processTriageJob } = await import("./workers/copilot-triage-worker")
            await processTriageJob(fakeJob)
          } else if (name === "embedding") {
            const { processEmbeddingJob } = await import("./workers/embedding-worker")
            await processEmbeddingJob(fakeJob)
          } else if (name === "billing") {
            const { reportUsageToStripe } = await import("@/lib/billing/usage-reporter")
            await reportUsageToStripe()
          }
        } catch (err: any) {
          console.error(`[Queue: ${name}] Fallback execution of job '${jobName}' failed:`, err.message)
        }
      })()

      return { id: `fallback-${name}-${Date.now()}` } as any
    },
    async close() {},
    async isReady() { return true },
  }

  return new Proxy({} as Queue<T>, {
    get(target, prop) {
      const url = process.env.REDIS_URL
      if (!url) {
        if (prop in fallbackQueue) {
          return (fallbackQueue as any)[prop]
        }
        return undefined
      }

      if (!queueInstance) {
        queueInstance = new Queue<T>(name, {
          connection: getConnectionConfig(),
          ...defaultOptions,
        })
      }
      const val = (queueInstance as any)[prop]
      if (typeof val === "function") {
        return val.bind(queueInstance)
      }
      return val
    },
    set(target, prop, value) {
      const url = process.env.REDIS_URL
      if (!url) {
        return true
      }

      if (!queueInstance) {
        queueInstance = new Queue<T>(name, {
          connection: getConnectionConfig(),
          ...defaultOptions,
        })
      }
      ;(queueInstance as any)[prop] = value
      return true
    },
    getPrototypeOf() {
      return Queue.prototype
    },
  })
}

export type EmbedDocumentJob = {
  knowledgeSourceId: string
  orgId: string
}

export type AgentReplyEmailJob = {
  type: "agent_reply"
  orgId: string
  conversationId: string
  messageId: string
}

export type LegacyNotificationJob = {
  type: "ticket_resolved" | "csat_follow_up"
  recipientEmail: string
  payload: Record<string, unknown>
}

export type NotificationJob = AgentReplyEmailJob | LegacyNotificationJob

/**
 * Queue for generating pgvector embeddings (Ollama) when a KB document is added.
 * Processed by: lib/queue/workers/embedding-worker.ts
 */
export const embeddingQueue = createLazyQueue<EmbedDocumentJob>("embedding", {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
})

/**
 * Queue for async notifications (CSAT follow-ups, resolution emails).
 * Processed by: lib/queue/workers/notification-worker.ts
 */
export const notificationQueue = createLazyQueue<NotificationJob>("notification", {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 50,
    removeOnFail: 200,
  },
})

export type CopilotTriageJob = {
  orgId: string
  ticketId: string
  conversationId: string
  messageId: string
}

/**
 * Dedicated queue for AI copilot triage of inbound customer messages.
 *
 * Kept separate from notificationQueue and embeddingQueue so triage latency
 * is never blocked by unrelated background work (embedding jobs can be slow;
 * notification retries have their own backoff rhythm).
 *
 * Processed by: lib/queue/workers/copilot-triage-worker.ts
 */
export const copilotTriageQueue = createLazyQueue<CopilotTriageJob>("copilot-triage", {
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 200,
    removeOnFail: 500,
  },
})

/**
 * Queue for handling scheduled and metered billing reporting tasks.
 * Processed by: lib/queue/workers/billing-worker.ts
 */
export const billingQueue = createLazyQueue<{ type: "report_usage" }>("billing", {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
})

/**
 * Schedules a repeatable, hourly billing usage reporting job.
 * This runs at minute 0 of every hour (cron: "0 * * * *").
 * This satisfies the "report at least daily" requirement.
 */
export async function scheduleBillingUsageReporting() {
  await billingQueue.add(
    "report_usage",
    { type: "report_usage" },
    {
      repeat: {
        pattern: "0 * * * *", // Hourly cadence
      },
      jobId: "billing_hourly_report", // Keeps the job idempotent across server restarts
    }
  )
  console.log("[BillingQueue] Hourly usage reporting job successfully scheduled.")
}
