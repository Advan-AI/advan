ALTER TABLE "usage_events" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_events" ADD COLUMN "stripe_usage_record_id" text;