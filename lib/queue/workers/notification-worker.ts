import { Worker, UnrecoverableError, type Job } from "bullmq"
import { and, asc, eq, ne } from "drizzle-orm"
import { db } from "@/lib/db"
import { conversations, emailEvents, messages, tickets, customers } from "@/lib/db/schema"
import {
  EmailSendError,
  sendAgentReply,
} from "@/lib/email/send-agent-reply"
import { buildReplyToAddress, type PriorMessageEmailMeta } from "@/lib/email/threading"
import { type AgentReplyEmailJob } from "../queues"

/**
 * BullMQ worker — agent reply emails via Resend.
 *
 * Run: npx tsx lib/queue/workers/notification-worker.ts
 */

function getConnectionConfig() {
  const url = process.env.REDIS_URL
  if (!url) throw new Error("[NotificationWorker] REDIS_URL is not set")
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

async function findExistingOutboundEvent(messageId: string) {
  return db.query.emailEvents.findFirst({
    where: and(
      eq(emailEvents.direction, "outbound"),
      eq(emailEvents.messageId, messageId),
      eq(emailEvents.status, "sent"),
    ),
  })
}

export async function markMessageEmailFailed(
  messageId: string,
  error: string,
): Promise<void> {
  const msg = await db.query.messages.findFirst({
    where: eq(messages.id, messageId),
  })
  if (!msg) return

  await db
    .update(messages)
    .set({
      metadata: {
        ...(msg.metadata ?? {}),
        email: {
          ...(msg.metadata?.email ?? {}),
          deliveryStatus: "failed",
          error,
        },
      },
    })
    .where(eq(messages.id, messageId))
}

function priorEmailMetadata(
  rows: Array<{ metadata: typeof messages.$inferSelect.metadata; role: string }>,
): PriorMessageEmailMeta[] {
  // Only inbound (user-role) messages have reliable RFC Message-IDs.
  // AWS SES overwrites outbound Message-IDs even when we pass them in headers
  // (see threading.ts comment), so referencing our own outbound IDs in
  // In-Reply-To / References would send IDs the customer's email client
  // has never seen — breaking Gmail/Outlook thread grouping.
  return rows
    .filter((row) => row.role === "user")
    .map((row) => row.metadata?.email)
    .filter((email): email is NonNullable<typeof email> => Boolean(email?.messageId))
    .map((email) => ({
      messageId: email.messageId,
      inReplyTo: email.inReplyTo,
    }))
}

export async function processAgentReplyJob(job: Job<AgentReplyEmailJob>) {
  const { orgId, conversationId, messageId } = job.data
  console.log(`[NotificationWorker] agent_reply message=${messageId}`)

  const existing = await findExistingOutboundEvent(messageId)
  if (existing) {
    console.log(
      `[NotificationWorker] Skipping duplicate job — outbound event exists (${existing.status})`,
    )
    return
  }

  const rows = await db
    .select({
      message: messages,
      ticketSubject: tickets.subject,
      customerEmail: customers.email,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .innerJoin(tickets, eq(conversations.ticketId, tickets.id))
    .leftJoin(customers, eq(conversations.customerId, customers.id))
    .where(
      and(
        eq(messages.id, messageId),
        eq(conversations.id, conversationId),
        eq(conversations.orgId, orgId),
      ),
    )
    .limit(1)

  const row = rows[0]
  if (!row) {
    throw new UnrecoverableError(
      `Message ${messageId} not found for conversation ${conversationId}`,
    )
  }

  const customerEmail = row.customerEmail?.trim()
  if (!customerEmail) {
    await markMessageEmailFailed(messageId, "No customer email on file")
    throw new UnrecoverableError("No customer email on file")
  }

  const priorRows = await db
    .select({ metadata: messages.metadata, role: messages.role })
    .from(messages)
    .where(
      and(eq(messages.conversationId, conversationId), ne(messages.id, messageId)),
    )
    .orderBy(asc(messages.createdAt))

  let result
  try {
    result = await sendAgentReply({
      orgId,
      conversationId,
      to: customerEmail,
      ticketSubject: row.ticketSubject,
      agentMessage: row.message.content,
      priorMessages: priorEmailMetadata(priorRows),
    })
  } catch (err) {
    if (err instanceof EmailSendError && !err.retryable) {
      await markMessageEmailFailed(messageId, err.message)
      throw new UnrecoverableError(err.message)
    }
    throw err
  }

  const replyToAddress = buildReplyToAddress(conversationId)

  await db.transaction(async (tx) => {
    const fresh = await tx.query.messages.findFirst({
      where: eq(messages.id, messageId),
    })
    if (!fresh) {
      throw new Error(`Message ${messageId} disappeared during send`)
    }

    await tx.insert(emailEvents).values({
      orgId,
      conversationId,
      messageId,
      direction: "outbound",
      providerId: result.resendId,
      status: "sent",
      payload: {
        rfcMessageId: result.messageId,
      },
    })

    await tx
      .update(messages)
      .set({
        metadata: {
          ...(fresh.metadata ?? {}),
          email: {
            ...(fresh.metadata?.email ?? {}),
            deliveryStatus: "sent",
            resendId: result.resendId,
            messageId: result.messageId,
          },
        },
      })
      .where(eq(messages.id, messageId))

    const conv = await tx.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    })

    if (conv && (!conv.emailReplyToAddress || !conv.emailRootMessageId)) {
      await tx
        .update(conversations)
        .set({
          emailReplyToAddress: conv.emailReplyToAddress ?? replyToAddress,
          emailRootMessageId: conv.emailRootMessageId ?? result.messageId,
        })
        .where(eq(conversations.id, conversationId))
    }
  })

  console.log(`[NotificationWorker] ✓ Sent agent reply ${result.resendId}`)
}

export function startNotificationWorker() {
  const worker = new Worker<NotificationJobPayload>(
    "notification",
    async (job) => {
      if (job.data.type !== "agent_reply") {
        console.warn(
          `[NotificationWorker] Skipping unimplemented job type: ${(job.data as { type: string }).type}`,
        )
        return
      }
      await processAgentReplyJob(job as Job<AgentReplyEmailJob>)
    },
    {
      connection: getConnectionConfig(),
      concurrency: 5,
    },
  )

  worker.on("completed", (job) => {
    console.log(`[NotificationWorker] Job ${job.id} completed`)
  })

  worker.on("failed", async (job, err) => {
    console.error(`[NotificationWorker] Job ${job?.id} failed:`, err.message)
    if (!job || !isAgentReplyJobPayload(job.data)) return

    const maxAttempts = job.opts.attempts ?? 3
    if (job.attemptsMade >= maxAttempts && !(err instanceof UnrecoverableError)) {
      await markMessageEmailFailed(job.data.messageId, err.message)
    }
  })

  return worker
}

type NotificationJobPayload = AgentReplyEmailJob | { type: string }

function isAgentReplyJobPayload(data: NotificationJobPayload): data is AgentReplyEmailJob {
  return data.type === "agent_reply" && "messageId" in data
}

const isMain =
  typeof process !== "undefined" &&
  process.argv[1]?.includes("notification-worker")

if (isMain) {
  console.log("[NotificationWorker] Starting...")
  startNotificationWorker()
}
