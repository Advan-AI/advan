-- FC Sandbox hardening: idempotent session creation + wake-latency metric +
-- per-run configurable hibernation policy. See lib/db/schema.ts
-- `sandboxSessions` and docs/FC_SANDBOX.md ("Fault tolerance" section).
--
-- Hand-written for the same reason as 0021 (no live DATABASE_URL here to run
-- `drizzle-kit generate`). Re-run drizzle-kit against a real DB to reconcile
-- the journal if it drifts.

ALTER TABLE "sandbox_sessions" ADD COLUMN IF NOT EXISTS "wake_latency_ms" integer;
--> statement-breakpoint
ALTER TABLE "sandbox_sessions" ADD COLUMN IF NOT EXISTS "hitl_timeout_minutes" integer DEFAULT 10 NOT NULL;
--> statement-breakpoint
-- Drop 0021's plain (non-unique) index — the UNIQUE constraint below creates
-- its own backing index that serves the same lookup, so keeping both would
-- be a redundant duplicate index on the same column.
DROP INDEX IF EXISTS "sandbox_sessions_workflow_idx";
--> statement-breakpoint
-- Idempotency: at most one sandbox session per workflow run. If this fails
-- because duplicate rows already exist from before this migration, dedupe
-- first, e.g.:
--   DELETE FROM sandbox_sessions a USING sandbox_sessions b
--     WHERE a.workflow_id = b.workflow_id AND a.created_at < b.created_at;
ALTER TABLE "sandbox_sessions" ADD CONSTRAINT "sandbox_sessions_workflow_unique" UNIQUE ("workflow_id");
