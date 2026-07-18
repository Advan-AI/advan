-- Rollback for 0002_email_integration.sql
-- Apply manually in reverse order if drizzle-kit migrate cannot be reversed.

DROP INDEX IF EXISTS "conversations_email_reply_to_address_idx";
--> statement-breakpoint
ALTER TABLE "conversations" DROP COLUMN IF EXISTS "email_reply_to_address";
--> statement-breakpoint
ALTER TABLE "conversations" DROP COLUMN IF EXISTS "email_root_message_id";
--> statement-breakpoint
DROP TABLE IF EXISTS "email_events";
