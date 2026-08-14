import "dotenv/config"
import { setDefaultResultOrder } from "node:dns"
import { defineConfig } from "drizzle-kit"

try {
  setDefaultResultOrder("ipv4first")
} catch {
  // Node < 17
}

/**
 * drizzle-kit migrate takes a session advisory lock. Supabase transaction
 * pooler (:6543) never grants it, so the CLI sits on "applying migrations...".
 * Session mode is the same pooler host on :5432.
 *
 * `sslmode=require` on current `pg` is treated as verify-full and can hang
 * the TLS handshake against the pooler; uselibpqcompat restores libpq require.
 */
function migrateDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL is not set")
  }
  let next = url.replace(/:6543(\/|\?|$)/, ":5432$1")
  if (!/[?&]uselibpqcompat=/.test(next)) {
    next += next.includes("?") ? "&uselibpqcompat=true" : "?uselibpqcompat=true"
  }
  return next
}

const migrateUrl = migrateDatabaseUrl()
try {
  const host = new URL(migrateUrl.replace(/^postgres(ql)?:/i, "http:")).host
  console.error(`[drizzle-kit] migrate target ${host} (session pooler, not :6543)`)
} catch {
  console.error("[drizzle-kit] migrate target configured")
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: migrateDatabaseUrl(),
  },
})
