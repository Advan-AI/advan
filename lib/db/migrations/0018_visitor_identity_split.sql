CREATE TABLE "visitors" (
  "id" uuid PRIMARY KEY NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "widget_key" text NOT NULL,
  "first_seen_at" timestamp DEFAULT now() NOT NULL,
  "last_seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "visitors_org_widget_idx" ON "visitors" ("org_id", "widget_key");
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "visitor_id" uuid REFERENCES "visitors"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "customer_display_name" text;
--> statement-breakpoint
CREATE INDEX "conversations_visitor_id_idx" ON "conversations" ("visitor_id");
--> statement-breakpoint
UPDATE "conversations" AS c
SET "customer_display_name" = NULLIF(TRIM(cu."name"), '')
FROM "customers" AS cu
WHERE c."customer_id" = cu."id"
  AND c."customer_display_name" IS NULL;
--> statement-breakpoint
UPDATE "conversations" AS c
SET "customer_display_name" = src."visitor_name"
FROM (
  SELECT
    m."conversation_id",
    MAX(NULLIF(TRIM(m."metadata"->>'visitorName'), '')) AS "visitor_name"
  FROM "messages" AS m
  WHERE m."metadata" IS NOT NULL
    AND jsonb_typeof(m."metadata") = 'object'
    AND m."metadata" ? 'visitorName'
  GROUP BY m."conversation_id"
) AS src
WHERE c."id" = src."conversation_id"
  AND c."customer_display_name" IS NULL;
