export const UNNAMED_VISITOR_LABEL = "Unnamed visitor"

function nonEmpty(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function resolveDashboardCustomerName(input: {
  channel?: string | null
  customerDisplayName?: string | null
  customerName?: string | null
  fallback?: string
}): string | null {
  const chatDisplayName = nonEmpty(input.customerDisplayName)
  const customerName = nonEmpty(input.customerName)

  if (input.channel === "chat") {
    return chatDisplayName ?? customerName ?? (input.fallback ?? UNNAMED_VISITOR_LABEL)
  }

  return customerName ?? chatDisplayName ?? null
}
