import { ChatOpenAI } from "@langchain/openai"
import type { LlmRuntimeConfig } from "./config"

/**
 * Ollama serves an OpenAI-compatible Chat Completions API under `{base}/v1`.
 */
export function ollamaOpenAiCompatibleBaseUrl(ollamaBaseUrl: string): string {
  const trimmed = ollamaBaseUrl.trim().replace(/\/$/, "")
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`
}

/**
 * LangChain chat model backed by a local Ollama instance (OpenAI compatibility layer).
 */
export function createOllamaChatOpenAI(config: LlmRuntimeConfig, modelName: string): ChatOpenAI {
  return new ChatOpenAI({
    model: modelName,
    temperature: 0,
    apiKey: "ollama",
    maxRetries: 0, // Fail fast to fallback to Groq instantly
    timeout: 4000, // 4-second timeout limit for local CPU runs
    configuration: {
      baseURL: ollamaOpenAiCompatibleBaseUrl(config.ollamaBaseUrl),
    },
  })
}
