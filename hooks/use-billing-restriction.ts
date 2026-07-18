"use client"

import { api } from "@/lib/api/trpc-client"

/**
 * Single source of truth for the client-side billing restriction check.
 * Returns true when the org's subscription is past_due or canceled,
 * meaning non-essential write operations should be blocked in the UI.
 *
 * Inbound message processing and triage are never blocked — only dashboard
 * write actions (KB uploads, workflow edits, team invites) are restricted.
 */
export function useBillingRestriction() {
  const { data: billing, isLoading } = api.auth.getBillingStatus.useQuery(undefined, {
    staleTime: 30_000,
  })

  const isRestricted =
    billing?.subscriptionStatus === "past_due" ||
    billing?.subscriptionStatus === "canceled"

  return { isRestricted, subscriptionStatus: billing?.subscriptionStatus, isLoading }
}
