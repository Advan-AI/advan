import { ChatAnthropic } from "@langchain/anthropic"
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk"

/**
 * Central LLM routing config (chat only).
 * Chat: Ollama (OpenAI-compatible /v1) or legacy Anthropic. Fallback chat: Groq (OpenAI-compatible).
 * Text embeddings use Ollama `/api/embeddings` — see `lib/vector/embedding-config.ts` and `.env` OLLAMA_*.
 */

export type LlmChatProvider = "ollama" | "anthropic" | "vertex-anthropic"

export interface LlmRuntimeConfig {
  readonly chatProvider: LlmChatProvider
  readonly ollamaBaseUrl: string
  readonly ollamaTriageModel: string
  readonly ollamaChatModel: string
  readonly groqChatModel: string
  readonly anthropicApiKey: string | undefined
  readonly gcpProjectId: string | undefined
  readonly gcpRegion: string | undefined
  readonly claudeModel: string | undefined
}

const DEFAULT_OLLAMA_BASE = "http://127.0.0.1:11434"
const DEFAULT_OLLAMA_TRIAGE_MODEL = "llama3.2"
const DEFAULT_OLLAMA_CHAT_MODEL = "llama3.2"
const DEFAULT_GROQ_CHAT_MODEL = "llama-3.3-70b-versatile"

function normalizeProvider(raw: string | undefined): LlmChatProvider | undefined {
  const v = raw?.trim().toLowerCase()
  if (v === "anthropic" || v === "ollama" || v === "vertex-anthropic") {
    return v
  }
  return undefined
}

/**
 * Resolve which **chat** stack to use. Knowledge / vector paths use Ollama embeddings + pgvector.
 */
export function getLlmRuntimeConfig(
  env: NodeJS.ProcessEnv = typeof process !== "undefined" && process.env
    ? process.env
    : ({} as NodeJS.ProcessEnv)
): LlmRuntimeConfig {
  const explicit = normalizeProvider(env.LLM_CHAT_PROVIDER)
  let chatProvider: LlmChatProvider
  if (explicit === "anthropic") {
    chatProvider = "anthropic"
  } else if (explicit === "vertex-anthropic") {
    chatProvider = "vertex-anthropic"
  } else if (explicit === "ollama") {
    chatProvider = "ollama"
  } else if (env.GCP_PROJECT_ID?.trim() && (env.LLM_CHAT_PROVIDER === "anthropic" || !env.LLM_CHAT_PROVIDER)) {
    // If GCP project ID is configured and LLM_CHAT_PROVIDER is set to anthropic or not set, prefer vertex-anthropic
    chatProvider = "vertex-anthropic"
  } else if (env.OLLAMA_BASE_URL?.trim() || env.OLLAMA_CHAT_MODEL?.trim() || env.OLLAMA_TRIAGE_MODEL?.trim()) {
    chatProvider = "ollama"
  } else if (env.ANTHROPIC_API_KEY?.trim()) {
    chatProvider = "anthropic"
  } else {
    chatProvider = "ollama"
  }

  return {
    chatProvider,
    ollamaBaseUrl: env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE,
    ollamaTriageModel: env.OLLAMA_TRIAGE_MODEL?.trim() || DEFAULT_OLLAMA_TRIAGE_MODEL,
    ollamaChatModel: env.OLLAMA_CHAT_MODEL?.trim() || DEFAULT_OLLAMA_CHAT_MODEL,
    groqChatModel: env.GROQ_CHAT_MODEL?.trim() || DEFAULT_GROQ_CHAT_MODEL,
    anthropicApiKey: env.ANTHROPIC_API_KEY?.trim() || undefined,
    gcpProjectId: env.GCP_PROJECT_ID?.trim() || undefined,
    gcpRegion: env.GCP_REGION?.trim() || undefined,
    claudeModel: env.CLAUDE_MODEL?.trim() || undefined,
  }
}

/**
 * Creates an Anthropic model instance, handling standard Anthropic vs GCP Vertex AI.
 */
export function createAnthropicModel(
  cfg: LlmRuntimeConfig,
  defaultModelName: string,
  temperature: number = 0,
  streaming: boolean = false
): ChatAnthropic {
  if (cfg.chatProvider === "vertex-anthropic") {
    const projectId = cfg.gcpProjectId || "arslantoor"
    const region = cfg.gcpRegion || "us-east5"
    // Use the model configured in env, or fall back to the defaultModelName
    const modelName = cfg.claudeModel || defaultModelName

    const customClient = new AnthropicVertex({
      projectId,
      region,
    })

    return new ChatAnthropic({
      modelName,
      temperature,
      streaming,
      createClient: () => customClient as any,
    })
  }

  // Fallback to standard Anthropic
  return new ChatAnthropic({
    modelName: defaultModelName,
    temperature,
    apiKey: cfg.anthropicApiKey || "dummy-key-for-build-resilience",
    streaming,
  })
}

