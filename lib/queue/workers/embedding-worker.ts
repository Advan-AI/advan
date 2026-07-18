import { Worker, type Job } from "bullmq"
import { db } from "@/lib/db"
import { knowledgeSources } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { embedWithOllama } from "@/lib/vector/ollama-embeddings"
import { type EmbedDocumentJob } from "../queues"

/**
 * BullMQ worker — processes KB document embedding jobs.
 * 1. Fetches the knowledge source from DB
 * 2. Generates an embedding via Ollama (`OLLAMA_EMBEDDING_MODEL`, default nomic-embed-text @ 768)
 * 3. Stores vector in Postgres pgvector (`knowledge_sources.embedding`)
 * 4. Updates embeddingStatus to 'completed'
 *
 * Run: npx tsx lib/queue/workers/embedding-worker.ts
 */

function getConnectionConfig() {
  const url = process.env.REDIS_URL
  if (!url) throw new Error("[EmbeddingWorker] REDIS_URL is not set")
  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    tls: url.startsWith("rediss://") ? {} : undefined,
    maxRetriesPerRequest: null as null,
    enableReadyCheck: false,
    family: 0,
  }
}

async function processEmbeddingJob(job: Job<EmbedDocumentJob>) {
  const { knowledgeSourceId, orgId } = job.data
  console.log(`[EmbeddingWorker] Processing ${knowledgeSourceId}`)

  await db
    .update(knowledgeSources)
    .set({ embeddingStatus: "processing" })
    .where(eq(knowledgeSources.id, knowledgeSourceId))

  try {
    const source = await db.query.knowledgeSources.findFirst({
      where: eq(knowledgeSources.id, knowledgeSourceId),
    })

    if (!source) {
      throw new Error(`Knowledge source ${knowledgeSourceId} not found`)
    }

    const textToEmbed = `${source.title}\n\n${source.content}`
    const embedding = await embedWithOllama(textToEmbed)

    await db
      .update(knowledgeSources)
      .set({
        embedding,
        embeddingStatus: "completed",
      })
      .where(eq(knowledgeSources.id, knowledgeSourceId))

    console.log(`[EmbeddingWorker] ✓ Embedded ${source.title}`)
  } catch (err: any) {
    console.error(`[EmbeddingWorker] Error processing ${knowledgeSourceId}:`, err.message)
    await db
      .update(knowledgeSources)
      .set({ embeddingStatus: "failed" })
      .where(eq(knowledgeSources.id, knowledgeSourceId))
    throw err
  }
}

export function startEmbeddingWorker() {
  const worker = new Worker<EmbedDocumentJob>(
    "embedding",
    processEmbeddingJob,
    {
      connection: getConnectionConfig(),
      concurrency: 3,
    }
  )

  worker.on("completed", (job) => {
    console.log(`[EmbeddingWorker] Job ${job.id} completed`)
  })

  worker.on("failed", (job, err) => {
    console.error(`[EmbeddingWorker] Job ${job?.id} failed:`, err.message)
  })

  return worker
}

const isMain =
  typeof process !== "undefined" &&
  process.argv[1]?.includes("embedding-worker")

if (isMain) {
  console.log("[EmbeddingWorker] Starting...")
  startEmbeddingWorker()
}
