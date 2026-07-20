import { describe, expect, it } from "vitest"
import {
  assessConversationEscalation,
  type ConversationTurn,
} from "./conversation-escalation"

describe("assessConversationEscalation", () => {
  it("escalates after repeated frustration following AI replies", () => {
    const turns: ConversationTurn[] = [
      { role: "user", content: "What are the API rate limits?" },
      { role: "agent", content: "Growth plan is 1000 req/min." },
      { role: "user", content: "That doesn't help, my integration still fails." },
      { role: "agent", content: "Please check your API key." },
      { role: "user", content: "Still not working — this is the third time." },
    ]
    const result = assessConversationEscalation(turns)
    expect(result.shouldEscalate).toBe(true)
    expect(result.unresolvedFollowUps).toBeGreaterThanOrEqual(1)
  })

  it("escalates on explicit human request", () => {
    const turns: ConversationTurn[] = [
      { role: "user", content: "I need to speak to a human agent please." },
    ]
    expect(assessConversationEscalation(turns).shouldEscalate).toBe(true)
  })

  it("does not escalate on a first vague greeting", () => {
    const turns: ConversationTurn[] = [{ role: "user", content: "hi" }]
    expect(assessConversationEscalation(turns).shouldEscalate).toBe(false)
  })
})
