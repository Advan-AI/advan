-- Migration 0010: conversations.chat_offline_delivery
--
-- Marks chat conversations that were created when no agent was online.
-- When true, agent replies are routed through notificationQueue (email)
-- rather than Socket.IO, since the visitor has likely left the page.
--
-- Cleared to false by the /chat-widget namespace connection handler when:
--   1. The visitor reconnects via WebSocket, AND
--   2. At least one agent is currently online for the org.
-- This restores live socket delivery for all subsequent messages without
-- requiring any state stored in the browser.

ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "chat_offline_delivery" boolean NOT NULL DEFAULT false;
