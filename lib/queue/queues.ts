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
export const embeddingQueue = new Queue<EmbedDocumentJob>("embedding", {
  connection: getConnectionConfig(),
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
export const notificationQueue = new Queue<NotificationJob>("notification", {
  connection: getConnectionConfig(),
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
export const copilotTriageQueue = new Queue<CopilotTriageJob>("copilot-triage", {
  connection: getConnectionConfig(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 200,
    removeOnFail: 500,
  },
})
