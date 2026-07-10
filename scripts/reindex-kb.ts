#!/usr/bin/env tsx
/**
 * Re-queue embedding jobs for all knowledge sources missing vectors.
 * Requires: REDIS_URL, DATABASE_URL, Ollama with OLLAMA_EMBEDDING_MODEL pulled,
 *             embedding-worker running (npm run dev:all).
 *
 * Usage: npx tsx scripts/reindex-kb.ts
 */
import { existsSync, readFileSync } from "fs"
import { resolve } from "path"

/** Load .env / .env.local before queue imports (queues.ts reads REDIS_URL at import time). */
function loadEnvFiles() {
  const root = resolve(import.meta.dirname, "..")
  for (const file of [".env", ".env.local"]) {
    const path = resolve(root, file)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = value
    }
  }
}

loadEnvFiles()

async function main() {
  const { isNull } = await import("drizzle-orm")
  const { db } = await import("../lib/db")
  const { knowledgeSources } = await import("../lib/db/schema")
  const { embeddingQueue } = await import("../lib/queue/queues")

  if (!process.env.REDIS_URL) {
    console.error("REDIS_URL is not set. Add it to .env or run: set -a && source .env && set +a")
    process.exit(1)
  }

  const rows = await db
    .select({ id: knowledgeSources.id, orgId: knowledgeSources.orgId, title: knowledgeSources.title })
    .from(knowledgeSources)
    .where(isNull(knowledgeSources.embedding))

  if (rows.length === 0) {
    console.log("All knowledge sources already have embeddings.")
    process.exit(0)
  }

  console.log(`Queueing ${rows.length} embedding job(s)…`)
  for (const row of rows) {
    await embeddingQueue.add(
      `reindex-${row.id}`,
      { knowledgeSourceId: row.id, orgId: row.orgId },
      { jobId: `reindex-${row.id}` },
    )
    console.log(`  ✓ ${row.title}`)
  }
  console.log("Done. Watch: tail -f scripts/logs/embedding-worker.log")
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
