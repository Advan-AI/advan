-- Migration 0008: widget_configs table + conversations.visitor_session_id
--
-- Adds the data model for the embedded chat widget channel:
--   widget_configs  — one row per widget deployment (public embed key,
--                     origin allowlist, branding overrides).
--   conversations   — visitor_session_id ties a chat conversation to a
--                     browser session for reconnect, parallel to the way
--                     email_reply_to_address ties email threads.

CREATE TABLE IF NOT EXISTS "widget_configs" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id"               uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "widget_key"           text NOT NULL,
  "allowed_origins"      jsonb NOT NULL DEFAULT '[]'::jsonb,
  "pre_chat_form_enabled" boolean NOT NULL DEFAULT true,
  "branding_config"      jsonb,
  "created_at"           timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "widget_configs"
  ADD CONSTRAINT "widget_configs_widget_key_unique" UNIQUE("widget_key");
--> statement-breakpoint
ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "visitor_session_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_visitor_session_idx"
  ON "conversations" USING btree ("visitor_session_id");
