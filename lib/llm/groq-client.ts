import OpenAI from "openai"

const GROQ_OPENAI_BASE_URL = "https://api.groq.com/openai/v1"

/**
 * Groq exposes an OpenAI-compatible HTTP API. Use for **chat completions** only in this codebase.
 */
export function getGroqOpenAIClient(): OpenAI | null {
  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) {
    return null
  }
  return new OpenAI({
    apiKey,
    baseURL: GROQ_OPENAI_BASE_URL,
  })
}

export function getGroqChatModel(): string {
  return process.env.GROQ_CHAT_MODEL?.trim() || "llama-3.3-70b-versatile"
}
