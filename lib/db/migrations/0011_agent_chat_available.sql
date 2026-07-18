-- Migration: 0011_agent_chat_available
--
-- Adds a per-agent "available for chat" toggle to the users table.
--
-- When false, the agent is excluded from the organisation's chat availability
-- check even if their socket session is connected — useful for agents who are
-- logged in but busy on other work and don't want new chat conversations routed
-- to them.
--
-- Default TRUE so existing agents remain available without any action on
-- their part after the migration.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "chat_available" boolean NOT NULL DEFAULT true;
