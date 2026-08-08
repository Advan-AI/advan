-- FC Sandbox HITL sessions — see lib/db/schema.ts `sandboxSessions` and
-- docs/FC_SANDBOX.md. Hand-written (not drizzle-kit generated) because this
-- environment has no live DATABASE_URL to run `drizzle-kit generate`
-- against. Re-run `npx drizzle-kit generate` once connected to a real
-- database to reconcile the migrations journal if it drifts.

CREATE TABLE IF NOT EXISTS "sandbox_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" text NOT NULL,
	"ticket_id" text NOT NULL,
	"trace_id" text NOT NULL,
	"sandbox_id" text NOT NULL,
	"session_id" text NOT NULL,
	"state" text DEFAULT 'created' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"executed_at" timestamp,
	"hibernated_at" timestamp,
	"woken_at" timestamp,
	"resumed_at" timestamp,
	"completed_at" timestamp,
	"compute_ms_estimate" integer DEFAULT 0 NOT NULL,
	"compute_saved_ms_estimate" integer DEFAULT 0 NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sandbox_sessions_workflow_idx" ON "sandbox_sessions" USING btree ("workflow_id");
