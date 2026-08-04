import { describe, expect, it } from "vitest"
import {
  buildChatTicketSubject,
  formatTicketSubjectForDisplay,
  summarizeChatOpening,
} from "./ticket-subject"

describe("chat ticket subjects", () => {
  it("pairs visitor name with the opening issue", () => {
    expect(
      buildChatTicketSubject({
        displayName: "Smith",
        initialMessage: "I need help with my order status",
      }),
    ).toBe("Smith · I need help with my order status")
  })

  it("uses Chat with {Name} when there is no real issue yet", () => {
    expect(buildChatTicketSubject({ displayName: "Smith", initialMessage: "Hi" })).toBe(
      "Chat with Smith",
    )
    expect(buildChatTicketSubject({ displayName: "Smith" })).toBe("Chat with Smith")
  })

  it("falls back to Live chat only when name and topic are both missing", () => {
    expect(buildChatTicketSubject({ initialMessage: "   " })).toBe("Live chat")
    expect(buildChatTicketSubject({})).toBe("Live chat")
  })

  it("truncates long openings cleanly", () => {
    const long =
      "Hello I have been waiting for my package for three weeks and nobody has replied to my emails about the tracking number"
    const subject = summarizeChatOpening(long)!
    expect(subject.length).toBeLessThanOrEqual(57)
    expect(subject.endsWith("…")).toBe(true)
  })

  it("rewrites legacy Chat session — Name subjects using name + latest preview", () => {
    expect(
      formatTicketSubjectForDisplay({
        channel: "chat",
        subject: "Chat session — Smith",
        customerName: "Smith",
        lastMessagePreview: "Where is my refund?",
      }),
    ).toBe("Smith · Where is my refund?")

    expect(
      formatTicketSubjectForDisplay({
        channel: "chat",
        subject: "Chat session — Smith",
      }),
    ).toBe("Chat with Smith")
  })

  it("pairs customer name onto plain chat subjects for display", () => {
    expect(
      formatTicketSubjectForDisplay({
        channel: "email",
        subject: "Billing question",
      }),
    ).toBe("Billing question")

    expect(
      formatTicketSubjectForDisplay({
        channel: "chat",
        subject: "Password reset help",
        customerName: "Dana",
      }),
    ).toBe("Dana · Password reset help")
  })
})
