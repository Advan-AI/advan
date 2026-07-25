import "dotenv/config"
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Advan AI Data Layer (Layer 5)
 * Multi-tenant client initialization with Supabase RLS compatibility.
 */

const connectionString = process.env.DATABASE_URL!;
const maxConnections = process.env.DB_MAX_CONNECTIONS
  ? parseInt(process.env.DB_MAX_CONNECTIONS, 10)
  : 5;

// Disable prefetch as it is not supported for "Transaction" mode in Supabase/Neon.
// Keep the pool small: Next.js + workers share the same Supabase pooler quota.
const client = postgres(connectionString, {
  prepare: false,
  max: Number.isFinite(maxConnections) && maxConnections > 0 ? maxConnections : 5,
  idle_timeout: 20,
  connect_timeout: 15,
  max_lifetime: 60 * 30,
});

export const db = drizzle(client, { schema });

/**
 * Multi-tenant query helper.
 * Ensures every query is scoped to an organization ID.
 */
export const withOrg = (orgId: string) => {
  return {
    workflows: {
      findMany: () => db.query.workflows.findMany({
        where: (workflows, { eq }) => eq(workflows.orgId, orgId),
      }),
      findById: (id: string) => db.query.workflows.findFirst({
        where: (workflows, { eq, and }) => and(eq(workflows.id, id), eq(workflows.orgId, orgId)),
      }),
    },
    auditLogs: {
      findMany: () => db.query.auditLogs.findMany({
        where: (auditLogs, { eq }) => eq(auditLogs.orgId, orgId),
      }),
    },
  };
};
