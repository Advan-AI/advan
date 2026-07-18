import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { suppressedEmails } from "@/lib/db/schema"

export type SuppressionReason = "bounce" | "complaint"

export function normalizeEmailAddress(email: string): string {
  return email.trim().toLowerCase()
}

export async function findSuppressedEmail(orgId: string, email: string) {
  const normalized = normalizeEmailAddress(email)
  if (!normalized) return null

  return db.query.suppressedEmails.findFirst({
    where: and(
      eq(suppressedEmails.orgId, orgId),
      eq(suppressedEmails.email, normalized),
    ),
  })
}

export async function suppressEmail(input: {
  orgId: string
  email: string
  reason: SuppressionReason
}) {
  const normalized = normalizeEmailAddress(input.email)
  if (!normalized) return

  await db
    .insert(suppressedEmails)
    .values({
      orgId: input.orgId,
      email: normalized,
      reason: input.reason,
    })
    .onConflictDoNothing()
}
