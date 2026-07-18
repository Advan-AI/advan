ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "title" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "pinned_at" timestamp;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "unread_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_org_archived_updated_idx" ON "conversations" USING btree ("org_id","archived_at","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_org_pinned_idx" ON "conversations" USING btree ("org_id","pinned_at");
