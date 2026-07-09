import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { conversations, customers, messages, tickets } from "@/lib/db/schema"
import { notificationQueue } from "@/lib/queue/queues"
import { publishChatAgentReply } from "@/lib/realtime/event-bus"

type MessageMetadata = NonNullable<typeof messages.$inferInsert.metadata>

export interface InsertAgentMessageArgs {
  orgId: string
  conversationId: string
  content: string
  /**
   * Optional extra metadata merged onto the message row.
   * The `email` sub-key is managed internally — do not pass it.
   */
  metadata?: Omit<MessageMetadata, "email">
}

export interface InsertAgentMessageResult {
  message: typeof messages.$inferSelect
  emailQueued: boolean
  /** True when a chat:agent_reply event was published to the event bus. */
  chatEmitted: boolean
}

/**
 * Insert an agent-role reply into a conversation.
 *
 * Shared by:
 *   - `conversations.addMessage` tRPC mutation (agent-role path)
 *   - `copilot-triage-worker` auto-send path
 *
 * Behaviour mirrors the original addMessage mutation exactly:
 *   1. Load the conversation (org-scoped) + ticket + customer in one JOIN.
 *   2. For email channels OR offline-chat conversations (chatOfflineDelivery=true):
 *      stamp `email.deliveryStatus = "queued"` on the message metadata
 *      (or "failed" when no customer email is on file).
 *   3. Insert the message with role="agent".
 *   4. Bump `conversations.updatedAt`.
 *   5. After the transaction:
 *      - email or offline-chat → enqueue `agent_reply` to notificationQueue.
 *      - online-chat → publish to CHAT_AGENT_REPLY_CHANNEL (Socket.IO delivery).
 *
 * Keeping both callers on this function prevents the two paths from drifting.
 */
export async function insertAgentMessage(
  args: InsertAgentMessageArgs
): Promise<InsertAgentMessageResult> {
  const { orgId, conversationId, content, metadata } = args

  const { msg, shouldEnqueue, shouldChatEmit } = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        channel: conversations.channel,
        chatOfflineDelivery: conversations.chatOfflineDelivery,
        customerEmail: customers.email,
        conversationId: conversations.id,
      })
      .from(conversations)
      .innerJoin(tickets, eq(conversations.ticketId, tickets.id))
      .leftJoin(customers, eq(conversations.customerId, customers.id))
      .where(and(eq(conversations.id, conversationId), eq(conversations.orgId, orgId)))
      .limit(1)

    if (!row) {
      throw new Error(
        `Conversation ${conversationId} not found for org ${orgId}`
      )
    }

    const customerEmail = row.customerEmail?.trim()
    const isEmailChannel = row.channel === "email"
    const isInternal = (metadata as MessageMetadata | undefined)?.isInternal === true

    // Chat conversations created when no agent was online are flagged for
    // email delivery. The visitor likely navigated away; deliver via email
    // (same suppression / deliverability checks as the literal email channel).
    // This flag is cleared when the visitor reconnects with an agent online,
    // restoring live socket delivery.
    const isChatOffline = row.channel === "chat" && row.chatOfflineDelivery === true

    // Any path that needs email delivery (literal email channel OR offline chat)
    const useEmailDelivery = isEmailChannel || isChatOffline

    let finalMetadata: MessageMetadata | undefined = metadata as MessageMetadata | undefined

    if (useEmailDelivery && !isInternal) {
      finalMetadata = {
        ...(finalMetadata ?? {}),
        email: {
          deliveryStatus: customerEmail ? "queued" : "failed",
          ...(customerEmail ? {} : { error: "No customer email on file" }),
        },
      }
    }

    const [msg] = await tx
      .insert(messages)
      .values({
        conversationId,
        role: "agent",
        content,
        metadata: finalMetadata,
      })
      .returning()

    await tx
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId))

    // Enqueue for email delivery when:
    //   - literal email channel, OR
    //   - offline chat (visitor provided email, no agent was online)
    // Suppression / deliverability checks in the notification worker apply in
    // both cases — we don't bypass them for offline chat.
    const shouldEnqueue = useEmailDelivery && !isInternal && Boolean(customerEmail)

    // Emit via socket only for online chat (not offline, not email, not internal).
    const shouldChatEmit = row.channel === "chat" && !isChatOffline && !isInternal

    return { msg, shouldEnqueue, shouldChatEmit }
  })

  // ── Email delivery ───────────────────────────────────────────────────────
  if (shouldEnqueue) {
    await notificationQueue.add(
      "agent_reply",
      { type: "agent_reply", orgId, conversationId, messageId: msg.id },
      { jobId: msg.id }
    )
  }

  // ── Chat delivery ────────────────────────────────────────────────────────
  // Emit to the visitor's /chat-widget room via Redis pub/sub so the widget
  // receives the reply in real time regardless of which process inserted the
  // message. Mirrors the email path's notification queue enqueue above.
  // Covers both: auto-triage auto-send AND human agent manual/HITL replies.
  let chatEmitted = false
  if (shouldChatEmit) {
    try {
      await publishChatAgentReply(orgId, {
        conversationId,
        messageId: msg.id,
        content,
      })
      chatEmitted = true
    } catch (err) {
      // Non-fatal: visitor will see the message on reconnect / next poll.
      console.warn("[insertAgentMessage] publishChatAgentReply failed:", (err as Error).message)
    }
  }

  return { message: msg, emailQueued: shouldEnqueue, chatEmitted }
}

// Re-export the metadata type so callers don't need to import from schema directly.
export type { MessageMetadata }
