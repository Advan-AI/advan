import "dotenv/config"
import { setDefaultResultOrder } from "node:dns"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

/**
 * Advan AI Data Layer (Layer 5)
 * Multi-tenant client initialization with Supabase RLS compatibility.
 *
 * Dev note: `npm run dev:all` starts Next.js plus several workers, each importing
 * this module. Keep pools small and HMR-stable so we do not exhaust the
 * Supabase transaction pooler (or trip intermittent DNS / CONNECT_TIMEOUT).
 */

try {
  // Prefer IPv4 first — dual-stack lookups via some home routers surface as EAI_AGAIN.
  setDefaultResultOrder("ipv4first")
} catch {
  // Node < 17
}

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/advan_ai"

function resolveMaxConnections(): number {
  if (process.env.DB_MAX_CONNECTIONS) {
    const parsed = parseInt(process.env.DB_MAX_CONNECTIONS, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  // Workers share the pooler quota with Next.js — keep idle pools tiny.
  if (process.env.DB_POOL_ROLE === "worker") return 2
  return 3
}

function resolveSsl(url: string): boolean | "require" {
  const flag = process.env.DB_SSL?.trim().toLowerCase()
  if (flag === "0" || flag === "false" || flag === "disable") return false
  if (flag === "1" || flag === "true" || flag === "require") return "require"

  // Prefer substring checks — passwords with `#`/`%` can break `new URL(...)`.
  if (/@(localhost|127\.0\.0\.1|\[::1\])[:/]/i.test(url)) return false
  if (/supabase\.com/i.test(url) || /pooler\.supabase/i.test(url)) return "require"
  return false
}

type PgClient = ReturnType<typeof postgres>
type GlobalDb = typeof globalThis & { __ADVAN_PG__?: PgClient }

function createClient(): PgClient {
  return postgres(connectionString!, {
    prepare: false,
    max: resolveMaxConnections(),
    idle_timeout: 20,
    // Fail faster than the old 15s default so UI retries recover sooner.
    connect_timeout: 10,
    max_lifetime: 60 * 15,
    ssl: resolveSsl(connectionString!),
    connection: {
      application_name: process.env.DB_APP_NAME ?? "advan",
    },
  })
}

const globalDb = globalThis as GlobalDb
const client = globalDb.__ADVAN_PG__ ?? createClient()

// Persist across Next.js / Turbopack HMR so we do not leak pools per reload.
if (process.env.NODE_ENV !== "production") {
  globalDb.__ADVAN_PG__ = client
}

export const db = drizzle(client, { schema })

/**
 * Multi-tenant query helper.
 * Ensures every query is scoped to an organization ID.
 */
export const withOrg = (orgId: string) => {
  return {
    workflows: {
      findMany: () =>
        db.query.workflows.findMany({
          where: (workflows, { eq }) => eq(workflows.orgId, orgId),
        }),
      findById: (id: string) =>
        db.query.workflows.findFirst({
          where: (workflows, { eq, and }) =>
            and(eq(workflows.id, id), eq(workflows.orgId, orgId)),
        }),
    },
    auditLogs: {
      findMany: () =>
        db.query.auditLogs.findMany({
          where: (auditLogs, { eq }) => eq(auditLogs.orgId, orgId),
        }),
    },
  }
}
