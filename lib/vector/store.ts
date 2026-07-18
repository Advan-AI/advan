import { and, eq, isNotNull, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { knowledgeSources } from "@/lib/db/schema"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type VectorSearchMatch = {
  id: string
  score?: number
  metadata?: { title?: string; url?: string; sourceType?: string; [key: string]: unknown }
}

function assertUuid(orgId: string): void {
  if (!UUID_RE.test(orgId)) {
    throw new Error("[VectorStore] Invalid orgId")
  }
}

function vectorSql(embedding: number[]) {
  for (const x of embedding) {
    if (typeof x !== "number" || !Number.isFinite(x)) {
      throw new Error("[VectorStore] Embedding contains non-finite values")
    }
  }
  return sql.raw(`'[${embedding.join(",")}]'::vector`)
}

/**
 * Cosine similarity search over `knowledge_sources.embedding` (pgvector).
 * Compatible with former Pinecone match shape for callers.
 */
export async function queryEmbeddings(
  orgId: string,
  embedding: number[],
  topK = 5
): Promise<VectorSearchMatch[]> {
  assertUuid(orgId)
  const k = Math.min(Math.max(1, Math.floor(topK)), 50)
  const v = vectorSql(embedding)

  const rows = await db
    .select({
      id: knowledgeSources.id,
      score: sql<number>`(1 - (${knowledgeSources.embedding} <=> ${v}))::double precision`.as("score"),
      title: knowledgeSources.title,
      content: knowledgeSources.content,
      url: knowledgeSources.url,
      sourceType: knowledgeSources.sourceType,
    })
    .from(knowledgeSources)
    .where(
      and(eq(knowledgeSources.orgId, orgId), isNotNull(knowledgeSources.embedding))
    )
    .orderBy(sql`${knowledgeSources.embedding} <=> ${v}`)
    .limit(k)

  return rows.map((r) => ({
    id: r.id,
    score: typeof r.score === "number" ? r.score : 0,
    metadata: {
      title: r.title ?? "Untitled",
      snippet: truncateSnippet(r.content ?? ""),
      url: r.url ?? undefined,
      sourceType: r.sourceType,
    },
  }))
}

function truncateSnippet(content: string, maxLen = 1200): string {
  const trimmed = content.trim()
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.slice(0, maxLen)}…`
}

/** Legacy hook: vectors live only in Postgres; row delete clears them. */
export async function deleteEmbedding(_orgId: string, _docId: string): Promise<void> {
  return
}
