import { pgTable, text, timestamp, uuid, jsonb, integer, boolean } from 'drizzle-orm/pg-core';

// Multi-tenant Organization isolation
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Users within organizations
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  email: text('email').notNull().unique(),
  name: text('name'),
  role: text('role', { enum: ['admin', 'member', 'viewer'] }).default('member').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Orchestration Workflows (LangGraph / React Flow JSON)
export const workflows = pgTable('workflows', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  definition: jsonb('definition').notNull(), // Stores the React Flow / LangGraph JSON
  isActive: boolean('is_active').default(true).notNull(),
  version: integer('version').default(1).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Governance Audit Logs (The 'Glass Box' backend)
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  workflowId: uuid('workflow_id').references(() => workflows.id),
  input: text('input').notNull(),
  output: text('output').notNull(),
  metadata: jsonb('metadata').$type<{
    confidence: number;
    citations: Array<{ source: string; content: string; score: number }>;
    policyChecks: Array<{ rule: string; passed: boolean }>;
    latencyMs: number;
  }>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Knowledge Base Sources
export const knowledgeSources = pgTable('knowledge_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  url: text('url'),
  sourceType: text('source_type', { enum: ['document', 'website', 'ticket'] }).notNull(),
  embeddingStatus: text('embedding_status', { enum: ['pending', 'completed', 'failed'] }).default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
