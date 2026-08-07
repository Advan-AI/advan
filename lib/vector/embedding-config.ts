import { requireEnv, requireIntEnv } from "@/lib/env/required"

/** Default matches pgvector column `vector(768)` and Ollama `nomic-embed-text`. */
export const DEFAULT_OLLAMA_EMBEDDING_MODEL = "nomic-embed-text"
export const DEFAULT_EMBEDDING_DIMENSION = 768

export function getOllamaHttpBase(): string {
  return requireEnv("OLLAMA_BASE_URL").replace(/\/$/, "")
}

export function getOllamaEmbeddingModel(): string {
  return requireEnv("OLLAMA_EMBEDDING_MODEL")
}

export function getEmbeddingDimension(): number {
  return requireIntEnv("EMBEDDING_DIMENSION", process.env, { min: 1 })
}
