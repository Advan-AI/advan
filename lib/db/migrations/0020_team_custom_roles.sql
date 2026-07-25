CREATE TABLE IF NOT EXISTS "org_roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "key" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "base_role" text NOT NULL,
  "permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_system" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "org_roles_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade,
  CONSTRAINT "org_roles_base_role_check"
    CHECK ("base_role" IN ('admin', 'member', 'viewer'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "org_roles_org_key_unique"
  ON "org_roles" ("org_id", "key");

CREATE UNIQUE INDEX IF NOT EXISTS "org_roles_org_name_unique"
  ON "org_roles" ("org_id", "name");

CREATE INDEX IF NOT EXISTS "org_roles_org_idx"
  ON "org_roles" ("org_id");

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "role_id" uuid;

ALTER TABLE "users"
  ADD CONSTRAINT "users_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "org_roles"("id") ON DELETE set null;

CREATE INDEX IF NOT EXISTS "users_org_role_id_idx"
  ON "users" ("org_id", "role_id");
