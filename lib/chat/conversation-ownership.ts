import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { conversations } from "@/lib/db/schema"

export interface ConversationOwnershipInput {
  orgId: string
  visitorId: string
  conversationId: string
}

export async function findOwnedConversation(input: ConversationOwnershipInput): Promise<{
  id: string
  orgId: string
  visitorId: string | null
} | null> {
  const row = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.id, input.conversationId),
      eq(conversations.orgId, input.orgId),
      eq(conversations.visitorId, input.visitorId),
    ),
    columns: {
      id: true,
      orgId: true,
      visitorId: true,
    },
  })

  return row ?? null
}

export async function isConversationOwnedByVisitor(
  input: ConversationOwnershipInput,
): Promise<boolean> {
  const row = await findOwnedConversation(input)
  return Boolean(row)
}
