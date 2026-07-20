/**
 * Manual E2E: addMessage → BullMQ → notification-worker → Resend.
 *
 * Usage (requires real RESEND_* env + REDIS_URL + seeded DB):
 *   set -a && source .env && set +a
 *   npx tsx scripts/test-outbound-email-e2e.ts [recipient@email.com]
 *
 * Starts a one-shot worker, enqueues via the same path as addMessage, waits for completion.
 */
import { QueueEvents } from "bullmq"
import { eq } from "drizzle-orm"
import { appRouter } from "@/lib/api/root"
import { db } from "@/lib/db"
import { conversations, customers, messages, organizations, users } from "@/lib/db/schema"
import { startNotificationWorker } from "@/lib/queue/workers/notification-worker"

function getConnectionConfig() {
  const url = process.env.REDIS_URL
  if (!url) throw new Error("REDIS_URL is not set")
  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    tls: url.startsWith("rediss://") ? {} : undefined,
    maxRetriesPerRequest: null as null,
    enableReadyCheck: false,
  }
}

async function main() {
  const overrideRecipient = process.argv[2]

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, "acme"),
  })
  if (!org) {
    throw new Error("Seed org 'acme' not found — run: npx tsx lib/db/seed.ts")
  }

  const agent = await db.query.users.findFirst({
    where: eq(users.orgId, org.id),
  })
  if (!agent) throw new Error("No agent user in org")

  const emailConv = await db
    .select({
      conversationId: conversations.id,
      channel: conversations.channel,
      customerEmail: customers.email,
    })
    .from(conversations)
    .innerJoin(customers, eq(conversations.customerId, customers.id))
    .where(eq(conversations.orgId, org.id))

  const target = emailConv.find(
    (c) =>
      c.channel === "email" &&
      c.customerEmail?.includes("@") &&
      c.customerEmail.length > 3,
  )
  if (!target) {
    throw new Error("No email conversation with customer email found in seed data")
  }

  if (overrideRecipient) {
    console.log(`Note: recipient override ${overrideRecipient} — worker still uses DB customer email`)
  }

  console.log(`Org: ${org.id}`)
  console.log(`Conversation: ${target.conversationId}`)
  console.log(`Customer email: ${target.customerEmail}`)

  const worker = startNotificationWorker()
  const connection = getConnectionConfig()
  const queueEvents = new QueueEvents("notification", { connection })

  const caller = appRouter.createCaller({
    user: { id: agent.id, orgId: org.id, role: agent.role },
  })

  const msg = await caller.conversations.addMessage({
    conversationId: target.conversationId,
    role: "agent",
    content: `E2E test reply at ${new Date().toISOString()}`,
  })

  console.log(`Message inserted: ${msg.id}`)
  console.log(`Delivery status: ${msg.metadata?.email?.deliveryStatus ?? "n/a"}`)

  if (msg.metadata?.email?.deliveryStatus === "failed") {
    throw new Error(`addMessage failed immediately: ${msg.metadata.email.error}`)
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for agent_reply job (60s)"))
    }, 60_000)

    queueEvents.on("completed", async ({ jobId }) => {
      if (jobId !== msg.id) return
      clearTimeout(timeout)
      resolve()
    })

    queueEvents.on("failed", ({ jobId, failedReason }) => {
      if (jobId !== msg.id) return
      clearTimeout(timeout)
      reject(new Error(`Job failed: ${failedReason}`))
    })
  })

  const finalMsg = await db.query.messages.findFirst({
    where: eq(messages.id, msg.id),
  })

  console.log("\nFinal message metadata:", JSON.stringify(finalMsg?.metadata?.email, null, 2))

  if (finalMsg?.metadata?.email?.deliveryStatus !== "sent") {
    throw new Error("Expected deliveryStatus=sent after worker completed")
  }

  console.log("\n✓ E2E outbound email sent via Resend")
  console.log(`  resendId: ${finalMsg.metadata.email.resendId}`)

  await worker.close()
  await queueEvents.close()
  process.exit(0)
}

main().catch((err) => {
  console.error("\n✗ E2E test failed:", err.message)
  process.exit(1)
})
