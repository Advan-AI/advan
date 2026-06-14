/** Default matches pgvector column `vector(768)` and Ollama `nomic-embed-text`. */
export const DEFAULT_OLLAMA_EMBEDDING_MODEL = "nomic-embed-text"
export const DEFAULT_EMBEDDING_DIMENSION = 768

export function getOllamaHttpBase(): string {
  return process.env.OLLAMA_BASE_URL?.trim().replace(/\/$/, "") || "http://127.0.0.1:11434"
}

export function getOllamaEmbeddingModel(): string {
  return process.env.OLLAMA_EMBEDDING_MODEL?.trim() || DEFAULT_OLLAMA_EMBEDDING_MODEL
}

export function getEmbeddingDimension(): number {
  const raw = process.env.EMBEDDING_DIMENSION?.trim()
  if (raw) {
    const n = parseInt(raw, 10)
    if (Number.isFinite(n) && n > 0) {
      return n
    }
  }
  return DEFAULT_EMBEDDING_DIMENSION
}
