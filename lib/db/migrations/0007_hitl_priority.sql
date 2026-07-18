-- Migration 0007: hitl_queue priority, source, conversationId, classificationMetadata
--
-- Adds the columns needed to distinguish complaint-origin HITL items from
-- routine low-confidence items, and to carry the conversationId so the
-- approval path can call insertAgentMessage without a separate lookup.
--
-- All columns have safe defaults so existing rows remain valid.

ALTER TABLE "hitl_queue"
  ADD COLUMN IF NOT EXISTS "conversation_id" uuid REFERENCES "conversations"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "priority" text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS "classification_metadata" jsonb;
