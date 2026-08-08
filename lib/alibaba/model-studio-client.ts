import "dotenv/config";
import OpenAI from "openai";
import { requireEnv } from "@/lib/env/required";

/**
 * Model Studio Configuration
 */
const CHAT_BASE_URL = requireEnv("DASHSCOPE_CHAT_BASE_URL");
const EMBEDDING_ENDPOINT = requireEnv("DASHSCOPE_EMBEDDING_ENDPOINT");

export const CHAT_MODEL = requireEnv("DASHSCOPE_CHAT_MODEL");
export const EMBEDDING_MODEL = requireEnv("DASHSCOPE_EMBEDDING_MODEL");

function getApiKey(): string {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      "Missing DASHSCOPE_API_KEY in environment. Please set DASHSCOPE_API_KEY before invoking Model Studio functions."
    );
  }
  return apiKey.trim();
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface ChatResponse {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const WORKSPACE_ID = process.env.DASHSCOPE_WORKSPACE_ID;

function getExtraHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (WORKSPACE_ID && WORKSPACE_ID.trim() !== "") {
    headers["X-DashScope-WorkSpace"] = WORKSPACE_ID.trim();
  }
  return headers;
}

/**
 * 1. Chat Completion via OpenAI-Compatible Endpoint
 */
export async function getChatCompletion(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options: ChatOptions = {}
): Promise<ChatResponse> {
  const apiKey = getApiKey();
  const openai = new OpenAI({
    apiKey,
    baseURL: CHAT_BASE_URL,
    defaultHeaders: getExtraHeaders(),
  });

  const formattedMessages = [...messages];
  if (options.systemPrompt) {
    formattedMessages.unshift({
      role: "system",
      content: options.systemPrompt,
    });
  }

  const response = await openai.chat.completions.create({
    model: options.model || CHAT_MODEL,
    messages: formattedMessages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens,
  });

  const choice = response.choices[0];
  const text = choice?.message?.content || "";
  const usage = response.usage || {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };

  return {
    text,
    usage: {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    },
  };
}

/**
 * 2. Vector Embedding via Native DashScope REST Endpoint
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = getApiKey();
  const globalEndpoint = requireEnv("DASHSCOPE_GLOBAL_EMBEDDING_ENDPOINT");

  // Attempt 1: Call Native Global DashScope REST Endpoint
  try {
    const response = await fetch(globalEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: {
          texts: [text],
        },
        parameters: {
          text_type: "document",
        },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const embedding = data?.output?.embeddings?.[0]?.embedding;
      if (Array.isArray(embedding) && embedding.length > 0) {
        return embedding;
      }
    }
  } catch (err: any) {
    console.warn(`⚠️ Global DashScope Embedding Endpoint error: ${err.message}. Trying workspace endpoint...`);
  }

  // Attempt 2: Fallback to Workspace DashScope REST Endpoint
  const wsEndpoint = EMBEDDING_ENDPOINT;
  const workspaceId = process.env.DASHSCOPE_WORKSPACE_ID;
  const fetchHeaders: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (workspaceId) {
    fetchHeaders["X-DashScope-WorkSpace"] = workspaceId;
  }

  const wsResponse = await fetch(wsEndpoint, {
    method: "POST",
    headers: fetchHeaders,
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: {
        texts: [text],
      },
      parameters: {
        text_type: "document",
      },
    }),
  });

  if (!wsResponse.ok) {
    const errorText = await wsResponse.text();
    throw new Error(`DashScope Embedding API error (status ${wsResponse.status}): ${errorText}`);
  }

  const wsData = await wsResponse.json();
  const wsEmbedding = wsData?.output?.embeddings?.[0]?.embedding;
  if (!Array.isArray(wsEmbedding) || wsEmbedding.length === 0) {
    throw new Error("DashScope Embedding API returned malformed or empty embedding array.");
  }

  return wsEmbedding;
}
