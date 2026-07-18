ALTER TABLE "email_events" ALTER COLUMN "org_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "email_events" ALTER COLUMN "conversation_id" DROP NOT NULL;
