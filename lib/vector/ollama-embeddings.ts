import { getEmbeddingDimension, getOllamaEmbeddingModel, getOllamaHttpBase } from "./embedding-config"

interface OllamaEmbedResponse {
  embedding?: number[]
}

/**
 * Single text embedding via Ollama `/api/embeddings` (no OpenAI / Pinecone).
 */
export async function embedWithOllama(text: string): Promise<number[]> {
  const base = getOllamaHttpBase()
  const model = getOllamaEmbeddingModel()
  const expectedDim = getEmbeddingDimension()

  const res = await fetch(`${base}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: text }),
    signal: AbortSignal.timeout(30000), // Fail embedding after 30 seconds
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`[OllamaEmbeddings] ${res.status} ${res.statusText}: ${body.slice(0, 500)}`)
  }

  const data = (await res.json()) as OllamaEmbedResponse
  const embedding = data.embedding
  if (!embedding?.length) {
    throw new Error("[OllamaEmbeddings] Response missing embedding array")
  }
  if (embedding.length !== expectedDim) {
    throw new Error(
      `[OllamaEmbeddings] Dimension mismatch: model returned ${embedding.length}, expected ${expectedDim} (set EMBEDDING_DIMENSION or use a model matching the DB vector column).`
    )
  }
  return embedding
}
