/**
 * Central LLM routing config (chat only).
 * Chat: Ollama (OpenAI-compatible /v1) or legacy Anthropic. Fallback chat: Groq (OpenAI-compatible).
 * Text embeddings use Ollama `/api/embeddings` — see `lib/vector/embedding-config.ts` and `.env` OLLAMA_*.
 */

export type LlmChatProvider = "ollama" | "anthropic"

export interface LlmRuntimeConfig {
  readonly chatProvider: LlmChatProvider
  readonly ollamaBaseUrl: string
  readonly ollamaTriageModel: string
  readonly ollamaChatModel: string
  readonly groqChatModel: string
  readonly anthropicApiKey: string | undefined
}

const DEFAULT_OLLAMA_BASE = "http://127.0.0.1:11434"
const DEFAULT_OLLAMA_TRIAGE_MODEL = "llama3.2"
const DEFAULT_OLLAMA_CHAT_MODEL = "llama3.2"
const DEFAULT_GROQ_CHAT_MODEL = "llama-3.3-70b-versatile"

function normalizeProvider(raw: string | undefined): LlmChatProvider | undefined {
  const v = raw?.trim().toLowerCase()
  if (v === "anthropic" || v === "ollama") {
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
  } else if (explicit === "ollama") {
    chatProvider = "ollama"
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
  }
}
