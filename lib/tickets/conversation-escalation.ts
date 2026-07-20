export interface ConversationTurn {
  role: "user" | "agent" | "assistant"
  content: string
}

export interface EscalationAssessment {
  shouldEscalate: boolean
  unresolvedFollowUps: number
  signals: string[]
}

const FRUSTRATION_PATTERNS: RegExp[] = [
  /\bnot resolved\b/i,
  /\bstill (not |doesn't|does not|hasn't|have not) (work|help|fix)/i,
  /\bdoesn't help\b/i,
  /\bgetting nowhere\b/i,
  /\bthis is (the )?(third|3rd|fourth|4th|fifth|5th) time\b/i,
  /\bspeak to (a )?(human|person|manager|supervisor)\b/i,
  /\b(real|live) (agent|person|human)\b/i,
  /\bescalat(e|ion)\b/i,
  /\bunacceptable\b/i,
  /\bthis is ridiculous\b/i,
  /\byou('re| are) not helping\b/i,
  /\bissue (is )?not fixed\b/i,
]

const HUMAN_REQUEST_PATTERNS: RegExp[] = [
  /\b(speak|talk) to (a )?(human|person|agent)\b/i,
  /\bconnect me\b/i,
  /\btransfer me\b/i,
]

/**
 * Detect when a customer has tried several times and needs a human to join
 * the conversation alongside the AI (collaborative handoff).
 */
export function assessConversationEscalation(turns: ConversationTurn[]): EscalationAssessment {
  const signals: string[] = []
  let unresolvedFollowUps = 0
  let lastWasAgent = false

  for (const turn of turns) {
    if (turn.role === "user") {
      const matched = FRUSTRATION_PATTERNS.filter((re) => re.test(turn.content))
      if (matched.length > 0 && lastWasAgent) {
        unresolvedFollowUps += 1
        signals.push(`Follow-up frustration after AI reply: "${turn.content.slice(0, 80)}"`)
      } else if (matched.length > 0) {
        signals.push(`Frustration signal: "${turn.content.slice(0, 80)}"`)
      }

      if (HUMAN_REQUEST_PATTERNS.some((re) => re.test(turn.content))) {
        signals.push("Explicit human-agent request")
      }
    }
    lastWasAgent = turn.role === "agent" || turn.role === "assistant"
  }

  const explicitHuman = turns.some(
    (t) => t.role === "user" && HUMAN_REQUEST_PATTERNS.some((re) => re.test(t.content))
  )
  const repeatedFrustration = unresolvedFollowUps >= 1 && turns.filter((t) => t.role === "user").length >= 2
  const shouldEscalate = explicitHuman || unresolvedFollowUps >= 2 || repeatedFrustration

  return { shouldEscalate, unresolvedFollowUps, signals }
}
