import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  integer,
  boolean,
  customType,
} from "drizzle-orm/pg-core"

// ─── pgvector custom type ─────────────────────────────────────────────────────
// Uses the `vector` extension in Supabase/Postgres.
// Run: CREATE EXTENSION IF NOT EXISTS vector; in your Supabase SQL editor.
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(768)"
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`
  },
  fromDriver(value: string): number[] {
    return value
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map(Number)
  },
})

// ─── Layer 5: Multi-tenant core ───────────────────────────────────────────────

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"),
  role: text("role", { enum: ["admin", "member", "viewer"] })
    .default("member")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ─── CRM tables ───────────────────────────────────────────────────────────────

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  email: text("email").notNull(),
  name: text("name"),
  company: text("company"),
  tier: text("tier", { enum: ["free", "growth", "enterprise"] })
    .default("free")
    .notNull(),
  csmId: uuid("csm_id").references(() => users.id),
  stripeCustomerId: text("stripe_customer_id"),
  totalTickets: integer("total_tickets").default(0).notNull(),
  csatAvg: text("csat_avg"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const tickets = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  customerId: uuid("customer_id").references(() => customers.id),
  subject: text("subject").notNull(),
  status: text("status", {
    enum: ["open", "pending", "resolved", "closed"],
  })
    .default("open")
    .notNull(),
  priority: text("priority", { enum: ["low", "medium", "high", "urgent"] })
    .default("medium")
    .notNull(),
  channel: text("channel", {
    enum: ["email", "chat", "voice", "slack", "portal"],
  })
    .default("email")
    .notNull(),
  assignedTo: uuid("assigned_to").references(() => users.id),
  aiResolved: boolean("ai_resolved").default(false).notNull(),
  confidenceScore: integer("confidence_score"),
  firstReplyMs: integer("first_reply_ms"),
  resolutionMs: integer("resolution_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  ticketId: uuid("ticket_id")
    .references(() => tickets.id, { onDelete: "cascade" })
    .notNull(),
  channel: text("channel", {
    enum: ["email", "chat", "voice", "slack", "portal"],
  })
    .default("chat")
    .notNull(),
  customerId: uuid("customer_id").references(() => customers.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" })
    .notNull(),
  role: text("role", { enum: ["user", "assistant", "agent"] }).notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<{
    citations?: Array<{ source: string; url?: string; confidence: number }>
    confidence?: number
    policyChecks?: Array<{ rule: string; passed: boolean }>
    latencyMs?: number
    model?: string
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ─── AI / Orchestration tables ────────────────────────────────────────────────

export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  definition: jsonb("definition").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  version: integer("version").default(1).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  workflowId: uuid("workflow_id").references(() => workflows.id),
  ticketId: uuid("ticket_id").references(() => tickets.id),
  input: text("input").notNull(),
  output: text("output").notNull(),
  metadata: jsonb("metadata")
    .$type<{
      confidence: number
      citations: Array<{ source: string; content: string; score: number; url?: string }>
      policyChecks: Array<{ rule: string; passed: boolean; reason?: string }>
      latencyMs: number
      model?: string
      hallucinationFlags?: string[]
    }>()
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ─── Knowledge Base ───────────────────────────────────────────────────────────

export const knowledgeSources = pgTable("knowledge_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  url: text("url"),
  s3Key: text("s3_key"),
  sourceType: text("source_type", {
    enum: ["document", "website", "ticket"],
  }).notNull(),
  embeddingStatus: text("embedding_status", {
    enum: ["pending", "processing", "completed", "failed"],
  })
    .default("pending")
    .notNull(),
  // pgvector — Ollama embedding dimension (default nomic-embed-text @ 768); must match EMBEDDING_DIMENSION
  embedding: vector("embedding"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ─── Governance / HITL ────────────────────────────────────────────────────────

export const hitlQueue = pgTable("hitl_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  ticketId: uuid("ticket_id").references(() => tickets.id),
  workflowRunId: text("workflow_run_id"),
  temporalWorkflowId: text("temporal_workflow_id"),
  draftOutput: text("draft_output").notNull(),
  reason: text("reason").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] })
    .default("pending")
    .notNull(),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
})

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type", {
    enum: ["embed_document", "send_notification", "export_audit"],
  }).notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status", {
    enum: ["queued", "processing", "done", "failed"],
  })
    .default("queued")
    .notNull(),
  attempts: integer("attempts").default(0).notNull(),
  lastError: text("last_error"),
  nextRetryAt: timestamp("next_retry_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
