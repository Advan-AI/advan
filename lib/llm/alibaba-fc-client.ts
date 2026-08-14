/**
 * Chat completions for Temporal agents.
 *
 * Deployed Function Compute HTTP (`ALIBABA_FC_URL`) currently 502s on the
 * chat payload, so Temporal uses DashScope Qwen directly — the same Alibaba
 * Model Studio API the FC handler is supposed to wrap. Groq/Ollama are not used.
 */
export interface AlibabaFcChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export function getAlibabaFcUrl(): string | null {
  const url = (process.env.ALIBABA_FC_URL || process.env.NEXT_PUBLIC_ALIBABA_FC_URL || "").trim()
  return url.startsWith("http") ? url.replace(/\/$/, "") : null
}

export async function invokeAlibabaFcChat(input: {
  orgId: string
  messages: AlibabaFcChatMessage[]
  systemPrompt?: string
  temperature?: number
  conversationId?: string
}): Promise<string> {
  const { getChatCompletion } = await import("@/lib/alibaba/model-studio-client")
  const completion = await getChatCompletion(input.messages, {
    systemPrompt: input.systemPrompt,
    temperature: input.temperature ?? 0,
  })
  if (!completion.text.trim()) {
    throw new Error("Alibaba DashScope returned an empty completion.")
  }
  return completion.text.trim()
}
