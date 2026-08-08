import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  integer,
  boolean,
  customType,
  index,
  unique,
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

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  seatLimit: integer("seat_limit").notNull(),
  includedMessages: integer("included_messages").notNull(),
  monthlyPriceCents: integer("monthly_price_cents").notNull(),
  stripePriceId: text("stripe_price_id").notNull(),
  stripeMeteredPriceId: text("stripe_metered_price_id").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  inboundEmailAlias: text("inbound_email_alias").unique(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planId: uuid("plan_id").references(() => plans.id),
  subscriptionStatus: text("subscription_status"),
  trialEndsAt: timestamp("trial_ends_at"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    type: text("type").notNull(),
    quantity: integer("quantity").default(1).notNull(),
    stripeUsageRecordId: text("stripe_usage_record_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("usage_events_org_type_created_idx").on(table.orgId, table.type, table.createdAt),
  ],
)

export const orgRoles = pgTable(
  "org_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    baseRole: text("base_role", { enum: ["admin", "member", "viewer"] }).notNull(),
    permissions: jsonb("permissions").$type<string[]>().default([]).notNull(),
    isSystem: boolean("is_system").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("org_roles_org_key_unique").on(table.orgId, table.key),
    unique("org_roles_org_name_unique").on(table.orgId, table.name),
    index("org_roles_org_idx").on(table.orgId),
  ],
)

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"),
  emailVerified: boolean("email_verified").default(false).notNull(),
  role: text("role", { enum: ["admin", "member", "viewer"] })
    .default("member")
    .notNull(),
  roleId: uuid("role_id").references(() => orgRoles.id, { onDelete: "set null" }),
  /**
   * Per-agent "available for live chat" toggle.
   * When false, this agent is excluded from the org availability check
   * even while their socket session is connected. Defaults to true so
   * existing agents remain available without any migration action.
   */
  chatAvailable: boolean("chat_available").default(true).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ─── Email verification OTPs ─────────────────────────────────────────────────

export const emailVerifications = pgTable("email_verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  otp: text("otp").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ─── CRM tables ───────────────────────────────────────────────────────────────

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    email: text("email").notNull(),
    visitorSessionId: text("visitor_session_id"),
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
  },
  (table) => [
    // Partial unique index enforced via migration 0009.
    // Prevents duplicate anonymous customer rows for the same visitor session
    // when rapid-fire messages race to create customers. NULL rows (email
    // customers) are excluded so normal customer creation is unaffected.
    index("customers_org_visitor_session_idx").on(table.orgId, table.visitorSessionId),
  ],
)

export const visitors = pgTable(
  "visitors",
  {
    /**
     * Persistent chat visitor identity.
     * This UUID is generated/held by the embed script on the parent origin.
     */
    id: uuid("id").primaryKey(),
    orgId: uuid("org_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    /** Public widget key used to scope visitor identity to a deployment. */
    widgetKey: text("widget_key").notNull(),
    firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  },
  (table) => [index("visitors_org_widget_idx").on(table.orgId, table.widgetKey)],
)

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

export const conversations = pgTable(
  "conversations",
  {
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
    /**
     * Ties a chat conversation to a browser visitor session, enabling
     * reconnect. Parallel to how emailReplyToAddress ties email threads.
     * Set by the chat widget on first message; carried in the session JWT.
     */
    visitorSessionId: text("visitor_session_id"),
    /**
     * Persistent visitor identity for chat conversations.
     * Nullable for non-chat channels and legacy rows.
     */
    visitorId: uuid("visitor_id").references(() => visitors.id, { onDelete: "set null" }),
    /**
     * Snapshot of visitor-facing name at session creation time.
     * Backfilled for legacy rows where possible.
     */
    customerDisplayName: text("customer_display_name"),
    title: text("title"),
    pinnedAt: timestamp("pinned_at"),
    archivedAt: timestamp("archived_at"),
    unreadCount: integer("unread_count").default(0).notNull(),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    emailRootMessageId: text("email_root_message_id"),
    emailReplyToAddress: text("email_reply_to_address"),
    /**
     * When true, agent replies on this chat conversation are delivered via
     * email (notificationQueue) instead of Socket.IO — used when no agent
     * was online at ticket-creation time and the visitor provided their
     * email via the pre-chat form.
     * Cleared to false when the visitor reconnects with an agent online,
     * restoring live socket delivery for subsequent messages.
     */
    chatOfflineDelivery: boolean("chat_offline_delivery").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("conversations_email_reply_to_address_idx").on(table.emailReplyToAddress),
    index("conversations_org_archived_updated_idx").on(table.orgId, table.archivedAt, table.updatedAt),
    index("conversations_org_pinned_idx").on(table.orgId, table.pinnedAt),
    index("conversations_visitor_session_idx").on(table.visitorSessionId),
    index("conversations_visitor_id_idx").on(table.visitorId),
  ],
)

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
    isInternal?: boolean
    email?: {
      messageId?: string
      inReplyTo?: string
      resendId?: string
      deliveryStatus?: "queued" | "sent" | "delivered" | "failed" | "bounced" | "suppressed"
      error?: string
    }
    /** Set by copilot-triage-worker after automated triage completes. */
    triage?: {
      decision:
        | "auto_send"
        | "auto_clarify"
        | "auto_warn"
        | "auto_escalate"
        | "hitl_complaint"
        | "hitl_collaborative"
        | "hitl_low_confidence"
        | "orchestrated"
      confidence: number
      isComplaint?: boolean
      auditLogId?: string
      classifiedAt: string
      chatIntent?: string
      activeWorkflowId?: string
      temporalWorkflowId?: string
      temporalRunId?: string
    }
    /**
     * True when this agent-role message was inserted by the background
     * triage worker (auto-send path). Lets the conversation list distinguish
     * "AI auto-replied" from a human agent reply.
     */
    isAutoTriaged?: boolean
    /** How the AI engaged: KB answer, clarify, warn, or escalation ack. */
    triageMode?: "kb_answer" | "clarify" | "warn" | "escalate_ack" | "complaint_ack"
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ─── Email integration ────────────────────────────────────────────────────────

export const emailEvents = pgTable(
  "email_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .references(() => organizations.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").references(() => messages.id, { onDelete: "set null" }),
    direction: text("direction", { enum: ["outbound", "inbound"] }).notNull(),
    providerId: text("provider_id").notNull(),
    status: text("status"),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("email_events_direction_provider_id_unique").on(
      table.direction,
      table.providerId,
    ),
  ],
)

export const suppressedEmails = pgTable(
  "suppressed_emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    email: text("email").notNull(),
    reason: text("reason", { enum: ["bounce", "complaint"] }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("suppressed_emails_org_id_email_unique").on(table.orgId, table.email),
  ],
)

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
      decision?: { action: "accept" | "reject" | "modify"; finalText?: string; by: string; at: string }
      /** "auto_triage" for triage-worker decisions; absent or "manual" for human-initiated drafts. */
      source?: "manual" | "auto_triage"
      /** Populated by triage worker — the complaint classifier output. */
      complaintClassification?: {
        isComplaint: boolean
        severity: "low" | "medium" | "high"
        sentiment: "positive" | "neutral" | "negative"
        reasoning: string
      }
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
  /** FK to the conversation the draft should be sent into when approved. */
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  workflowRunId: text("workflow_run_id"),
  temporalWorkflowId: text("temporal_workflow_id"),
  draftOutput: text("draft_output").notNull(),
  reason: text("reason").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] })
    .default("pending")
    .notNull(),
  /**
   * "complaint"      — triage classifier flagged isComplaint=true (highest urgency)
   * "low_confidence" — confidence below gate or policy failed
   * "policy_fail"    — policy check blocked auto-send
   * "normal"         — manually enqueued or workflow gate
   */
  priority: text("priority", {
    enum: ["complaint", "low_confidence", "policy_fail", "normal"],
  })
    .default("normal")
    .notNull(),
  /**
   * "auto_triage" — enqueued by the background triage worker
   * "manual"      — enqueued by a human from the copilot UI
   * "workflow"    — enqueued by a Temporal pipeline node
   */
  source: text("source", { enum: ["auto_triage", "manual", "workflow"] })
    .default("manual")
    .notNull(),
  /**
   * Populated by auto_triage jobs. Carries the complaint classification
   * result and the auditLogId so the approval path can close the loop.
   */
  classificationMetadata: jsonb("classification_metadata")
    .$type<{
      isComplaint?: boolean
      severity?: "low" | "medium" | "high"
      sentiment?: "positive" | "neutral" | "negative"
      reasoning?: string
      draftConfidence?: number
      auditLogId?: string
      chatIntent?: string
      collaborative?: boolean
      escalationSignals?: string[]
    }>(),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
})

// ─── Pipeline execution (Feature 2) ───────────────────────────────────────────

export const pipelineRuns = pgTable("pipeline_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  workflowId: uuid("workflow_id").references(() => workflows.id),
  temporalWorkflowId: text("temporal_workflow_id").notNull(),
  temporalRunId: text("temporal_run_id"),
  status: text("status", { enum: ["running", "completed", "failed", "cancelled"] })
    .default("running")
    .notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
})

export const pipelineRunSteps = pgTable("pipeline_run_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .references(() => pipelineRuns.id, { onDelete: "cascade" })
    .notNull(),
  nodeId: text("node_id").notNull(),
  nodeType: text("node_type").notNull(),
  status: text("status", {
    enum: ["pending", "running", "completed", "failed", "skipped"],
  }).notNull(),
  output: jsonb("output"),
  error: text("error"),
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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

// ─── Chat widget ───────────────────────────────────────────────────────────────

/**
 * One row per embedded chat widget deployment.
 * widgetKey is the public embed key included in the widget snippet; it is
 * used by POST /api/chat/session to look up the org and validate origins.
 */
export const widgetConfigs = pgTable(
  "widget_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    /** Public embed key placed in the widget <script> snippet. */
    widgetKey: text("widget_key").notNull().unique(),
    /**
     * Exact-match origin allowlist (e.g. ["https://example.com"]).
     * POST /api/chat/session rejects any origin not present in this list.
     * Strict equality prevents bypass via subdomain-prefix tricks.
     */
    allowedOrigins: jsonb("allowed_origins").$type<string[]>().default([]).notNull(),
    preChatFormEnabled: boolean("pre_chat_form_enabled").default(true).notNull(),
    /**
     * Pre-chat intake questions shown before the first message.
     * Each question: { id, text, type: "preset" | "custom", options?, required? }
     */
    preChatQuestions: jsonb("pre_chat_questions")
      .$type<
        Array<{
          id: string
          text: string
          type: "preset" | "custom"
          options?: string[]
          required?: boolean
        }>
      >()
      .default([])
      .notNull(),
    /** Optional branding overrides (colors, logo URL, etc.) */
    brandingConfig: jsonb("branding_config").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
)

// ─── Stripe Events for Webhook Idempotency ────────────────────────────────────

export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ─── FC Sandbox — HITL hibernate/wake/resume sessions ─────────────────────────
// One row per Temporal HITL pause. Persists sandbox identity + a structured
// event log so the /demo/fc-sandbox page (and any observer) can reconstruct
// the full execute -> hibernate -> wait -> wake -> resume -> finish timeline
// even after a server restart, independent of the Temporal UI.

export const sandboxSessions = pgTable(
  "sandbox_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: text("workflow_id").notNull(),
    ticketId: text("ticket_id").notNull(),
    traceId: text("trace_id").notNull(),
    sandboxId: text("sandbox_id").notNull(),
    sessionId: text("session_id").notNull(),
    /** created | executing | hibernated | waking | resumed | completed | escalated */
    state: text("state").notNull().default("created"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    executedAt: timestamp("executed_at"),
    hibernatedAt: timestamp("hibernated_at"),
    wokenAt: timestamp("woken_at"),
    resumedAt: timestamp("resumed_at"),
    completedAt: timestamp("completed_at"),
    computeMsEstimate: integer("compute_ms_estimate").default(0).notNull(),
    computeSavedMsEstimate: integer("compute_saved_ms_estimate").default(0).notNull(),
    /** wakeSandbox() call latency alone — distinct from total hibernation wait. */
    wakeLatencyMs: integer("wake_latency_ms"),
    /** Human-configurable hibernation policy for this run (minutes before auto-escalation). */
    hitlTimeoutMinutes: integer("hitl_timeout_minutes").default(10).notNull(),
    /** Append-only structured log: { ts, seq, type, traceId, sandboxId, sessionId, workflowId, ... }.
     *  Doubles as the checkpoint log — each entry is a durable state transition
     *  a replay/resume can be reconstructed from. */
    events: jsonb("events").$type<Array<Record<string, unknown>>>().default([]).notNull(),
  },
  (table) => [
    // One sandbox session per workflow run — enforces idempotent creation:
    // an activity retry on createSandboxSessionActivity (Temporal retries
    // per its own retry policy) upserts instead of inserting a duplicate row.
    // (Also serves as the workflow_id lookup index — see migration 0022,
    // which drops 0021's separate plain index as redundant with this one.)
    unique("sandbox_sessions_workflow_unique").on(table.workflowId),
  ],
)
