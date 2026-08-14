-- AgentRun state moves into Postgres — see lib/agent-run/execute-ticket.ts
-- and lib/agent-run/resume-ticket.ts, which replace the Temporal workflow
-- as the orchestrator for this flow on Vercel (stateless functions can't
-- host a Temporal worker; execute and resume now run as two independent
-- invocations that agree on state purely via this table).

ALTER TABLE "sandbox_sessions" ADD COLUMN IF NOT EXISTS "draft_output" text;
--> statement-breakpoint
ALTER TABLE "sandbox_sessions" ADD COLUMN IF NOT EXISTS "draft_confidence" integer;
--> statement-breakpoint
ALTER TABLE "sandbox_sessions" ADD COLUMN IF NOT EXISTS "draft_citations" jsonb;
--> statement-breakpoint
ALTER TABLE "sandbox_sessions" ADD COLUMN IF NOT EXISTS "final_output" text;
