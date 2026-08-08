import { ChatAnthropic } from "@langchain/anthropic"
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk"
import { requireEnv } from "@/lib/env/required"

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
  } else if (env.GCP_PROJECT_ID?.trim()) {
    chatProvider = "vertex-anthropic"
  } else if (env.OLLAMA_BASE_URL?.trim() && env.OLLAMA_CHAT_MODEL?.trim() && env.OLLAMA_TRIAGE_MODEL?.trim()) {
    chatProvider = "ollama"
  } else if (env.ANTHROPIC_API_KEY?.trim()) {
    chatProvider = "anthropic"
  } else {
    throw new Error(
      "Unable to resolve LLM_CHAT_PROVIDER from environment. Set LLM_CHAT_PROVIDER to ollama, anthropic, or vertex-anthropic and provide required variables."
    )
  }

  const ollamaBaseUrl = requireEnv("OLLAMA_BASE_URL", env)
  const ollamaTriageModel = requireEnv("OLLAMA_TRIAGE_MODEL", env)
  const ollamaChatModel = requireEnv("OLLAMA_CHAT_MODEL", env)
  const groqChatModel = requireEnv("GROQ_CHAT_MODEL", env)

  const anthropicApiKey = env.ANTHROPIC_API_KEY?.trim() || undefined
  const gcpProjectId = env.GCP_PROJECT_ID?.trim() || undefined
  const gcpRegion = env.GCP_REGION?.trim() || undefined
  const claudeModel = env.CLAUDE_MODEL?.trim() || undefined

  if (chatProvider === "anthropic" && !anthropicApiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY for LLM_CHAT_PROVIDER=anthropic")
  }

  if (chatProvider === "vertex-anthropic") {
    if (!gcpProjectId) throw new Error("Missing GCP_PROJECT_ID for LLM_CHAT_PROVIDER=vertex-anthropic")
    if (!gcpRegion) throw new Error("Missing GCP_REGION for LLM_CHAT_PROVIDER=vertex-anthropic")
    if (!claudeModel) throw new Error("Missing CLAUDE_MODEL for LLM_CHAT_PROVIDER=vertex-anthropic")
  }

  return {
    chatProvider,
    ollamaBaseUrl,
    ollamaTriageModel,
    ollamaChatModel,
    groqChatModel,
    anthropicApiKey,
    gcpProjectId,
    gcpRegion,
    claudeModel,
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
    const projectId = cfg.gcpProjectId!
    const region = cfg.gcpRegion!
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
    apiKey: cfg.anthropicApiKey,
    streaming,
  })
}

