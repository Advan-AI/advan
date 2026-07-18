-- Migration 0009: partial unique index on customers(org_id, visitor_session_id)
--
-- Prevents rapid-fire chat messages from racing to create duplicate anonymous
-- customer rows for the same visitor session. The partial index covers only
-- rows where visitor_session_id IS NOT NULL so email customers (which have
-- NULL visitor_session_id) remain unaffected.
--
-- auto-intake.ts uses INSERT ... ON CONFLICT DO NOTHING with a fallback SELECT
-- to handle the conflict gracefully without throwing.

CREATE UNIQUE INDEX IF NOT EXISTS "customers_org_visitor_session_unique"
  ON "customers" ("org_id", "visitor_session_id")
  WHERE "visitor_session_id" IS NOT NULL;
