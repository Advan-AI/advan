import { describe, expect, it } from "vitest"
import { resolveDashboardCustomerName, UNNAMED_VISITOR_LABEL } from "./customer-display-name"

describe("customer display name across dashboard surfaces", () => {
  it("conversations surface prefers chat customerDisplayName", () => {
    const label = resolveDashboardCustomerName({
      channel: "chat",
      customerDisplayName: "Alex Johnson",
      customerName: "Visitor 4f1a2b3c",
    })
    expect(label).toBe("Alex Johnson")
  })

  it("HITL queue review surface falls back safely for legacy null chat names", () => {
    const label = resolveDashboardCustomerName({
      channel: "chat",
      customerDisplayName: null,
      customerName: null,
    })
    expect(label).toBe(UNNAMED_VISITOR_LABEL)
  })

  it("Tap Box audit detail surface uses customerDisplayName for chat rows", () => {
    const label = resolveDashboardCustomerName({
      channel: "chat",
      customerDisplayName: "Maya Patel",
      customerName: "Visitor d0a9f102",
    })
    expect(label).toBe("Maya Patel")
  })

  it("tickets list surface keeps non-chat behavior and avoids undefined labels", () => {
    const chatLabel = resolveDashboardCustomerName({
      channel: "chat",
      customerDisplayName: "",
      customerName: "",
    })
    const emailLabel = resolveDashboardCustomerName({
      channel: "email",
      customerDisplayName: "Session Name",
      customerName: "Dana",
    })

    expect(chatLabel).toBe(UNNAMED_VISITOR_LABEL)
    expect(emailLabel).toBe("Dana")
  })
})
