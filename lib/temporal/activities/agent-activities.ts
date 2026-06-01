import Anthropic from "@anthropic-ai/sdk"
import { ChatAnthropic } from "@langchain/anthropic"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { getLlmRuntimeConfig } from "@/lib/llm/config"
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
    if (cfg.chatProvider === "anthropic" && cfg.anthropicApiKey) {
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

  const systemPrompt = `You are Advan AI, a transparent customer support specialist.
Always base your answers on the provided knowledge sources. Never fabricate information.
If the sources don't cover the question, say so clearly.

Knowledge sources:
${sourcesContext || "No sources retrieved — answer from general knowledge only if safe."}

Intent: ${input.intent}`

  const cfg = getLlmRuntimeConfig()

  try {
    if (cfg.chatProvider === "anthropic" && cfg.anthropicApiKey) {
      const sonnet = new ChatAnthropic({
        modelName: "claude-3-5-sonnet-20240620",
        temperature: 0,
        apiKey: cfg.anthropicApiKey,
      })
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
