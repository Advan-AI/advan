import { db } from "../lib/db"
import { knowledgeSources } from "../lib/db/schema"

async function main() {
  const rows = await db
    .select({
      id: knowledgeSources.id,
      title: knowledgeSources.title,
      embeddingStatus: knowledgeSources.embeddingStatus,
      hasEmbedding: knowledgeSources.embedding,
    })
    .from(knowledgeSources)

  console.log("KNOWLEDGE BASE STATUS:")
  for (const row of rows) {
    console.log(`- Title: "${row.title}"`)
    console.log(`  ID: ${row.id}`)
    console.log(`  Status: ${row.embeddingStatus}`)
    console.log(`  Has Embedding: ${row.hasEmbedding ? "YES (length " + row.hasEmbedding.length + ")" : "NO"}`)
    console.log("")
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
