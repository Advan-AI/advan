/**
 * Apply Drizzle SQL migrations without drizzle-kit's `pg` driver.
 *
 * `npx drizzle-kit migrate` hangs against Supabase (transaction pooler
 * advisory locks, and session-pooler TLS). This uses postgres.js with
 * `prepare: false`, which already works on :6543.
 */
import { config } from "dotenv"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import postgres from "postgres"

config({ path: ".env", override: true })

const JOURNAL_PATH = join("lib/db/migrations", "meta/_journal.json")
const MIGRATIONS_DIR = "lib/db/migrations"

type Journal = {
  entries: Array<{ tag: string }>
}

function hashFile(filename: string): string {
  return createHash("sha256").update(readFileSync(join(MIGRATIONS_DIR, filename))).digest("hex")
}

function splitSql(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((part) => part.trim())
    .filter(Boolean)
}

function isIgnorable(message: string): boolean {
  return /already exists|duplicate key|multiple primary keys/i.test(message)
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL is not set")
  }

  const host = url.replace(/^postgres(ql)?:\/\//i, "").replace(/^[^@]+@/, "").split("/")[0]
  console.log(`Connecting to ${host} (postgres.js, prepare: false)`)

  const sql = postgres(url, {
    max: 1,
    prepare: false,
    ssl: /supabase|pooler/i.test(url) ? "require" : false,
    connect_timeout: 15,
    onnotice: () => {},
  })

  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS drizzle`)
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `)

  const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as Journal
  const files = journal.entries.map((entry) => `${entry.tag}.sql`)

  const appliedRows = await sql.unsafe<{ hash: string }[]>(`SELECT hash FROM drizzle.__drizzle_migrations`)
  const applied = new Set(appliedRows.map((row) => row.hash))

  let appliedNow = 0
  for (const file of files) {
    const hash = hashFile(file)
    if (applied.has(hash)) continue

    const body = readFileSync(join(MIGRATIONS_DIR, file), "utf8")
    for (const stmt of splitSql(body)) {
      try {
        await sql.unsafe(stmt)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (!isIgnorable(message)) {
          throw new Error(`${file}: ${message}`)
        }
      }
    }
    await sql.unsafe(
      `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('${hash}', '${Date.now()}')`
    )
    applied.add(hash)
    appliedNow += 1
    console.log(`applied ${file}`)
  }

  await sql.end({ timeout: 5 })
  if (appliedNow === 0) {
    console.log(`Already up to date (${applied.size}/${files.length} migrations).`)
  } else {
    console.log(`Done. Applied ${appliedNow} migration(s). History ${applied.size}/${files.length}.`)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
