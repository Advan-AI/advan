import { PIIMasker } from "@/lib/governance/pii-masker"
import { queryEmbeddings } from "@/lib/vector/store"
import { invokeAlibabaFcChat } from "@/lib/llm/alibaba-fc-client"
import { getEmbedding } from "@/lib/alibaba/model-studio-client"

export interface TriageInput {
  orgId: string
  text: string
}

export interface TriageResult {
  intent: string
  confidence: number
}

export interface KnowledgeInput {
  orgId: string
  query: string
  intent: string
}

export interface KnowledgeResult {
  sources: Array<{ id: string; title: string; url?: string; snippet: string; score: number }>
}

export interface ComposerInput {
  orgId: string
  input: string
  intent: string
  sources: KnowledgeResult["sources"]
}

export interface ComposerResult {
  output: string
  confidence: number
  policyViolation: boolean
  citations: Array<{ source: string; url?: string; confidence: number }>
}

const TRIAGE_SYSTEM =
  "You are an intent classifier. Respond with a single JSON object: {\"intent\": string, \"confidence\": number}. " +
  "Intent categories: billing, technical, account, general, policy. JSON only."

function parseTriageJson(text: string): TriageResult {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] ?? text) as { intent?: string; confidence?: number }
    return { intent: parsed.intent ?? "general", confidence: parsed.confidence ?? 80 }
  } catch {
    return { intent: "general", confidence: 70 }
  }
}

const DEMO_ORG_ID = "demo-org-fc-sandbox"

/**
 * Triage — Alibaba DashScope Qwen (no Groq / Ollama).
 * Demo org falls back to a billing intent so /demo/fc-sandbox can still
 * reach sandbox hibernation if the LLM call fails.
 */
async function runTriageActivity(input: TriageInput): Promise<TriageResult> {
  const maskedText = PIIMasker.mask(input.text)
  try {
    const text = await invokeAlibabaFcChat({
      orgId: input.orgId,
      systemPrompt: TRIAGE_SYSTEM,
      conversationId: `${input.orgId}-triage`,
      messages: [
        { role: "system", content: TRIAGE_SYSTEM },
        { role: "user", content: maskedText },
      ],
    })
    return parseTriageJson(text)
  } catch (err) {
    if (input.orgId === DEMO_ORG_ID) {
      console.warn("[runTriageActivity] LLM failed; using demo fallback", err)
      return { intent: "billing", confidence: 70 }
    }
    throw err
  }
}

/**
 * Knowledge — DashScope embeddings + pgvector. Empty sources if retrieval fails.
 */
async function runKnowledgeActivity(input: KnowledgeInput): Promise<KnowledgeResult> {
  try {
    const queryVector = await getEmbedding(`${input.intent}: ${input.query}`)
    const matches = await queryEmbeddings(input.orgId, queryVector, 5)

    return {
      sources: matches.map((m) => ({
        id: m.id,
        title: (m.metadata?.title as string) ?? "Untitled",
        url: (m.metadata?.url as string) ?? undefined,
        snippet: "",
        score: m.score ?? 0,
      })),
    }
  } catch {
    return { sources: [] }
  }
}

function mapComposerSuccess(
  output: string,
  input: ComposerInput
): ComposerResult {
  const avgScore =
    input.sources.length > 0
      ? input.sources.reduce((sum, s) => sum + s.score, 0) / input.sources.length
      : 0.62
  const confidence = Math.round(avgScore * 100)

  return {
    output,
    confidence,
    policyViolation: false,
    citations: input.sources.map((s) => ({
      source: s.title,
      url: s.url,
      confidence: Math.round(s.score * 100),
    })),
  }
}

/**
 * Composer — Qwen via Alibaba Function Compute only.
 */
async function runComposerActivity(input: ComposerInput): Promise<ComposerResult> {
  const maskedInput = PIIMasker.mask(input.input)
  const sourcesContext = input.sources
    .map((s, i) => `[${i + 1}] ${s.title}: ${s.snippet || "(retrieved context)"}`)
    .join("\n")

  const systemPrompt = `You are a human customer support agent at Advan.
Respond directly, professionally, and empathetically like a real human.
Follow these strict support rules:
1. HUMAN TONE: Keep replies concise (1-3 short sentences). Never use robotic preambles (do NOT say "As an AI...", "As a bot...", or "As a language model"). Speak as a real human support team member.
2. STRICT COMPLIANCE: Strictly adhere to company policies (e.g., standard 30-day refund window; never offer exceptions or authorize actions outside rules without verifying details or escalating). Never fabricate or make up facts.
3. DEEP TECHNICAL SUPPORT: When a technical issue arises (e.g., API keys, HMAC webhook signature verification, network timeouts, or code integrations), provide precise, expert-level debugging and configuration support based exclusively on the provided sources. Do not speculate.
4. SOLUTION-ORIENTED: Always prioritize delivering an immediate, direct solution or actionable troubleshooting steps. Never loop on questions or ask a user for information you can infer or that they already provided.
5. NO REPETITIVE QUESTIONS: Do not ask clarifying questions repeatedly. If a source or detail is missing, provide the best possible general solution or instructions based on what you know first, and only ask a single optional follow-up question if absolutely critical. Never ask the same question twice.

Knowledge sources:
${sourcesContext || "No sources retrieved — answer from general knowledge only if safe."}

Intent: ${input.intent}`

  try {
    const output = await invokeAlibabaFcChat({
      orgId: input.orgId,
      systemPrompt,
      conversationId: `${input.orgId}-composer`,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: maskedInput },
      ],
    })
    return mapComposerSuccess(output, input)
  } catch (err) {
    if (input.orgId === DEMO_ORG_ID) {
      console.warn("[runComposerActivity] LLM failed; using demo fallback", err)
      return mapComposerSuccess(
        "I can look into that invoice total. Please hold while we verify the charge against your last bill.",
        input
      )
    }
    throw err
  }
}

export type AgentActivities = {
  runTriageActivity: typeof runTriageActivity
  runKnowledgeActivity: typeof runKnowledgeActivity
  runComposerActivity: typeof runComposerActivity
}

export const agentActivities: AgentActivities = {
  runTriageActivity,
  runKnowledgeActivity,
  runComposerActivity,
}
