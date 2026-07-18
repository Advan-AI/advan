import { ChatAnthropic } from "@langchain/anthropic"
import { ChatOpenAI } from "@langchain/openai"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { getLlmRuntimeConfig, createAnthropicModel } from "@/lib/llm/config"
import { createOllamaChatOpenAI } from "@/lib/llm/ollama-openai"
import { getGroqOpenAIClient, getGroqChatModel } from "@/lib/llm/groq-client"

// ─── Public types ──────────────────────────────────────────────────────────────

export interface ComplaintClassification {
  isComplaint: boolean
  severity: "low" | "medium" | "high"
  sentiment: "positive" | "neutral" | "negative"
  reasoning: string
}

// ─── Fail-safe constant ────────────────────────────────────────────────────────

/**
 * Returned whenever parsing fails or the LLM call throws.
 *
 * Biases hard toward human review: a parse failure must NEVER result in an
 * unreviewed auto-reply to what might be a complaint. Silence is not safe —
 * always escalate to the queue on any ambiguity.
 */
const FAIL_SAFE: ComplaintClassification = {
  isComplaint: true,
  severity: "medium",
  sentiment: "negative",
  reasoning: "Classification unavailable — defaulted to human review",
}

// ─── Prompt ────────────────────────────────────────────────────────────────────

const CLASSIFIER_SYSTEM = `You are a customer-support message classifier.
Analyse the message and return ONLY valid JSON — no markdown fences, no prose, no wrapper text.
Return exactly this shape:
{
  "isComplaint": boolean,
  "severity": "low" | "medium" | "high",
  "sentiment": "positive" | "neutral" | "negative",
  "reasoning": string
}

Severity guide:
- "high": refund demands, repeated failures, threats to escalate or leave, urgent distress.
- "medium": clear frustration, service-quality concerns, a single reported failure.
- "low": mild dissatisfaction, gentle feedback, minor inconvenience, or non-complaints.

Set isComplaint=true for any message that expresses dissatisfaction, requests remediation,
or reports a problem that harms the customer. When in doubt, set isComplaint=true.`

function buildUserMessage(content: string, conversationHistory?: string[]): string {
  const historyBlock =
    conversationHistory && conversationHistory.length > 0
      ? `\n\nConversation history (oldest first):\n${conversationHistory.map((m, i) => `[${i + 1}] ${m}`).join("\n")}`
      : ""
  return `${historyBlock}\n\nMessage to classify:\n${content}`.trim()
}

// ─── Parser (exported for unit testing) ───────────────────────────────────────

/**
 * Parse raw LLM text into a ComplaintClassification.
 *
 * Strips optional markdown code fences the model may include.
 * Returns FAIL_SAFE on any parse or schema-validation error.
 * Exported so tests can exercise defensive parsing directly.
 */
export function parseClassification(raw: string): ComplaintClassification {
  try {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim()

    const parsed = JSON.parse(cleaned) as Record<string, unknown>

    const { isComplaint, severity, sentiment, reasoning } = parsed
    if (
      typeof isComplaint !== "boolean" ||
      !["low", "medium", "high"].includes(severity as string) ||
      !["positive", "neutral", "negative"].includes(sentiment as string) ||
      typeof reasoning !== "string"
    ) {
      return FAIL_SAFE
    }

    return {
      isComplaint,
      severity: severity as ComplaintClassification["severity"],
      sentiment: sentiment as ComplaintClassification["sentiment"],
      reasoning,
    }
  } catch {
    return FAIL_SAFE
  }
}

// ─── LLM invoker ──────────────────────────────────────────────────────────────

/**
 * Call the LLM with the classifier prompt and return raw model text.
 *
 * LATENCY TRADE-OFF: This is an additional LLM round-trip separate from the
 * draft-generation pass in SuggestionService. The current SuggestionService is
 * a single-pass streaming AsyncGenerator with no multi-turn tool-call or
 * structured-output side-channel, so two calls are unavoidable here.
 *
 * Typical overhead: ~150–400 ms (Anthropic API) or ~200–600 ms (local Ollama).
 * The copilot triage latency target must account for this. If the budget is
 * tight, run classification in parallel with the retrieval step rather than
 * sequentially before draft composition.
 *
 * Uses `ollamaTriageModel` for local runs (typically a smaller/faster model
 * than the chat model) and falls back through Groq if the primary call fails.
 */
async function invokeLlm(content: string, conversationHistory?: string[]): Promise<string> {
  const cfg = getLlmRuntimeConfig()
  const systemMsg = new SystemMessage(CLASSIFIER_SYSTEM)
  const userMsg = new HumanMessage(buildUserMessage(content, conversationHistory))

  // Use a smaller/faster model for triage classification than for draft composition.
  // Anthropic: Haiku (cheapest, ~100ms) vs Sonnet used for drafting.
  // Ollama: ollamaTriageModel (defaults to "llama3.2") vs ollamaChatModel for drafts.
  const model =
    cfg.chatProvider === "anthropic" || cfg.chatProvider === "vertex-anthropic"
      ? createAnthropicModel(cfg, "claude-3-haiku-20240307", 0)
      : createOllamaChatOpenAI(cfg, cfg.ollamaTriageModel)

  try {
    const response = await model.invoke([systemMsg, userMsg])
    return response?.content?.toString() ?? ""
  } catch {
    // Groq fallback (OpenAI-compatible)
    const groq = getGroqOpenAIClient()
    if (!groq) throw new Error("All LLM providers unavailable for complaint classification")
    const completion = await groq.chat.completions.create({
      model: getGroqChatModel(),
      messages: [
        { role: "system", content: CLASSIFIER_SYSTEM },
        { role: "user", content: buildUserMessage(content, conversationHistory) },
      ],
      temperature: 0,
    })
    return completion.choices[0]?.message?.content ?? ""
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Classify a customer message as a complaint or non-complaint with severity and
 * sentiment. Runs as part of the copilot triage pipeline.
 *
 * On any LLM error or JSON parse failure the function returns the FAIL_SAFE
 * default (isComplaint=true, severity="medium") to guarantee human review.
 * It never silently auto-approves a draft that might be responding to a
 * complaint.
 *
 * @param content             - The customer message text.
 * @param conversationHistory - Optional prior messages (oldest-first) for
 *                              context. Helps with ambiguous follow-ups.
 * @param _invoker            - Internal test seam. Pass a stub that returns
 *                              controlled raw text. Do not use in production.
 */
export async function classifyMessage(
  content: string,
  conversationHistory?: string[],
  _invoker?: (content: string, history?: string[]) => Promise<string>
): Promise<ComplaintClassification> {
  try {
    const raw = await (_invoker ?? invokeLlm)(content, conversationHistory)
    return parseClassification(raw)
  } catch {
    return FAIL_SAFE
  }
}
