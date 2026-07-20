import Anthropic from "@anthropic-ai/sdk"
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk"
import { ChatAnthropic } from "@langchain/anthropic"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { getLlmRuntimeConfig, createAnthropicModel } from "@/lib/llm/config"
import { getGroqChatModel, getGroqOpenAIClient } from "@/lib/llm/groq-client"
import { createOllamaChatOpenAI } from "@/lib/llm/ollama-openai"
import { PIIMasker } from "@/lib/governance/pii-masker"
import { queryEmbeddings } from "@/lib/vector/store"
import { embedWithOllama } from "@/lib/vector/ollama-embeddings"

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
  "Intent categories: billing, technical, account, general, policy."

function parseTriageJson(text: string): TriageResult {
  try {
    const parsed = JSON.parse(text) as { intent?: string; confidence?: number }
    return { intent: parsed.intent ?? "general", confidence: parsed.confidence ?? 80 }
  } catch {
    return { intent: "general", confidence: 70 }
  }
}

/**
 * Triage activity — fast intent classification (Anthropic Haiku or local Ollama).
 */
async function runTriageActivity(input: TriageInput): Promise<TriageResult> {
  const maskedText = PIIMasker.mask(input.text)
  const cfg = getLlmRuntimeConfig()

  try {
    if (cfg.chatProvider === "vertex-anthropic") {
      const anthropic = new AnthropicVertex({
        projectId: cfg.gcpProjectId || "arslantoor",
        region: cfg.gcpRegion || "us-east5",
      })
      const response = await anthropic.messages.create({
        model: cfg.claudeModel || "claude-3-5-sonnet-v2@20241022",
        max_tokens: 64,
        system: TRIAGE_SYSTEM,
        messages: [{ role: "user", content: maskedText }],
      })
      const content = response.content[0]
      if (content.type === "text") {
        return parseTriageJson(content.text)
      }
    } else if (cfg.chatProvider === "anthropic" && cfg.anthropicApiKey) {
      const anthropic = new Anthropic({ apiKey: cfg.anthropicApiKey })
      const response = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 64,
        system: TRIAGE_SYSTEM,
        messages: [{ role: "user", content: maskedText }],
      })
      const content = response.content[0]
      if (content.type === "text") {
        return parseTriageJson(content.text)
      }
    } else {
      const model = createOllamaChatOpenAI(cfg, cfg.ollamaTriageModel)
      const response = await model.invoke([
        new SystemMessage(TRIAGE_SYSTEM),
        new HumanMessage(maskedText),
      ])
      return parseTriageJson(response.content.toString())
    }
  } catch {
    // fall through
  }

  return { intent: "general", confidence: 70 }
}

/**
 * Knowledge activity — vector search via pgvector + Ollama embeddings.
 */
async function runKnowledgeActivity(input: KnowledgeInput): Promise<KnowledgeResult> {
  try {
    const queryVector = await embedWithOllama(`${input.intent}: ${input.query}`)
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
      : 0.7
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
 * Composer activity — primary: Anthropic Sonnet or Ollama; fallback: Groq (OpenAI-compatible).
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

  const cfg = getLlmRuntimeConfig()

  try {
    if (cfg.chatProvider === "anthropic" || cfg.chatProvider === "vertex-anthropic") {
      const sonnet = createAnthropicModel(cfg, "claude-3-5-sonnet-20240620", 0)
      const response = await sonnet.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(maskedInput),
      ])
      return mapComposerSuccess(response.content.toString(), input)
    }

    const ollama = createOllamaChatOpenAI(cfg, cfg.ollamaChatModel)
    const response = await ollama.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(maskedInput),
    ])
    return mapComposerSuccess(response.content.toString(), input)
  } catch (primaryErr: unknown) {
    const groq = getGroqOpenAIClient()
    if (groq) {
      const completion = await groq.chat.completions.create({
        model: getGroqChatModel(),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: maskedInput },
        ],
        temperature: 0,
      })
      const text = completion.choices[0]?.message?.content ?? ""
      return {
        output: text,
        confidence: 75,
        policyViolation: false,
        citations: input.sources.map((s) => ({ source: s.title, url: s.url, confidence: 75 })),
      }
    }
    throw primaryErr
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
