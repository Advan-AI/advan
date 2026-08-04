export type TicketStatus = "open" | "pending" | "resolved" | "closed" | null | undefined
export type CustomerSessionStatus = "active" | "waiting" | "resolved"

export function getCustomerSessionStatus(input: {
  ticketStatus: TicketStatus
  awaitingHumanReview: boolean
}): CustomerSessionStatus {
  const { ticketStatus, awaitingHumanReview } = input

  if (ticketStatus === "resolved" || ticketStatus === "closed") {
    return "resolved"
  }

  if ((ticketStatus === "open" || ticketStatus === "pending") && awaitingHumanReview) {
    return "waiting"
  }

  return "active"
}
