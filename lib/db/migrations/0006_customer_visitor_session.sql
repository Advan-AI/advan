ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "visitor_session_id" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_org_visitor_session_idx" ON "customers" USING btree ("org_id","visitor_session_id");
