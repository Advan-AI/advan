# v0-advan Project Knowledge

Last updated: 2026-07-02

Use this file as the first stop for future Codex work in this repo. Keep it concise and update it after meaningful features, fixes, architecture changes, migrations, or command changes.

## Product

Advan AI is a customer-support trust infrastructure app. It combines a marketing site with a signed-in dashboard for tickets, conversations, customers, knowledge base, analytics, copilot, Tap Box, workflows, orchestration, and integrations.

Core product themes:

- Source-cited AI support drafting.
- Confidence thresholds and policy validation.
- Human approval gates and audit trails.
- Multi-tenant support data organized by `orgId`.

## Current Stack

- App: Next.js 16 App Router, React 19, TypeScript, Tailwind 4.
- UI: local shadcn/Radix-style components under `components/ui`, lucide icons, framer-motion, Recharts.
- API: tRPC v11 mounted at `/api/trpc`.
- Auth: NextAuth v5 beta with credentials and Google OAuth.
- DB: PostgreSQL via Drizzle ORM, with `pgvector` on knowledge embeddings.
- AI: LangGraph/LangChain, OpenAI package, Anthropic, local Ollama-compatible config, optional Groq fallback.
- Workflow: Temporal for durable ticket/pipeline workflows.
- Queue: BullMQ + Redis for embedding and notification/email jobs.
- Realtime: Socket.IO HITL server.
- Email: Resend with threaded outbound agent replies.
- Webhook verification: Resend webhooks use Svix `Webhook.verify()`; do not replace with generic HMAC code.
- Storage: AWS S3 for KB documents.
- Governance: policy, PII masking, citations, hallucination detection under `lib/governance`.
- Observability: Sentry, Vercel Analytics, OpenTelemetry in production.

## Commands

- Install: `npm ci`
- Dev web only: `npm run dev`
- Dev all services: `npm run dev:all`
- Build: `npm run build`
- Start: `npm start`
- Lint: `npm run lint`
- E2E: `npm test`
- Unit tests: `npm run test:unit`
- Temporal worker: `npm run temporal:worker`
- Bundle Temporal workflows: `npm run temporal:bundle`
- DB migrate: `npx drizzle-kit migrate`
- DB seed: `npx tsx lib/db/seed.ts`

`scripts/dev-all.sh` loads `.env` first, then `.env.local`, starts optional workers, writes logs to `scripts/logs/*.log`, and supports:

- `DEV_ALL_SKIP_EMBEDDING=1`
- `DEV_ALL_SKIP_NOTIFICATION=1`
- `DEV_ALL_SKIP_TEMPORAL=1`
- `DEV_ALL_SKIP_SOCKET=1`

## Important Environment

Required for full app:

- `DATABASE_URL`
- `NEXTAUTH_SECRET` or `AUTH_SECRET`
- `NEXTAUTH_URL` or `AUTH_URL`

Often needed by specific systems:

- Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Redis/BullMQ: `REDIS_URL`
- Temporal: `TEMPORAL_ADDRESS` and related TLS settings
- Ollama embeddings/chat: `OLLAMA_BASE_URL`, embedding config in `lib/vector/embedding-config.ts`
- Email: `RESEND_API_KEY` and email config in `lib/email/config.ts`
- Resend inbound webhooks: `RESEND_WEBHOOK_SECRET`; route is `/api/webhooks/resend/inbound`
- Dev-only inbound sender bypass: `ALLOW_UNVERIFIED_SENDER_DEV=false`; route asserts this is never true in production
- AWS S3: storage config used by `lib/storage/s3-client.ts`

Security notes:

- Do not commit real secrets.
- `.env` currently exists locally and must be treated as sensitive.
- Keep `.env.local.example` as placeholders only.
- Google OAuth callback must be `{NEXTAUTH_URL}/api/auth/callback/google`; no trailing slash on `NEXTAUTH_URL`.

## App Structure

- `app/page.tsx`: marketing homepage composition.
- `app/layout.tsx`: global metadata, dark html class, `Providers`, Vercel Analytics in production.
- `app/globals.css`: global theme tokens and marketing/dashboard utility classes.
- `app/dashboard/layout.tsx`: wraps dashboard pages in `DashboardShell`.
- `components/header.tsx`, `components/footer.tsx`: marketing frame.
- `components/*-section.tsx`: marketing homepage sections.
- `components/dashboard/*`: dashboard shell, sidebar, topbar, overview, page primitives.
- `components/orchestration/*` and `components/pipeline/*`: workflow/orchestration UIs.
- `components/ui/*`: reusable UI primitives.
- `lib/api/root.ts`: root tRPC router registry.
- `lib/api/routers/*`: feature routers.
- `lib/db/schema.ts`: Drizzle schema.
- `lib/db/migrations/*`: migrations.
- `lib/queue/*`: BullMQ queues and workers.
- `lib/email/*`: outbound email sending, templates, parsing/threading tests.
- `lib/temporal/*`: workflows, clients, activities, worker services.
- `lib/vector/*`: embeddings and pgvector store.
- `lib/governance/*`: policy, PII, citations, hallucination checks.
- `lib/copilot/*`: copilot decision/suggestion/service logic and stream hook.
- `lib/orchestration/*`: LangGraph/workflow engine.
- `lib/pipeline/*`: pipeline builder schema, compiler, registry, execution store.

## Marketing Site Notes

Homepage order in `app/page.tsx`:

1. `HeroSection`
2. `SocialProofSection`
3. `WorkflowSection`
4. `CopilotSection`
5. `MemorySection`
6. `OrchestrationSection`
7. `TrustSection`
8. `ComparisonSection`
9. `FAQSection`
10. `FinalCTA`

Recent historical decisions from `AGENTS.md`:

- Brand pivoted from sales outbound to transparent AI support.
- Landing page was redesigned as premium B2B SaaS with interactive demos.
- Testimonials section was removed.
- Pricing card dollar amounts were removed.
- Logo/favicon use a flat black square with white star.
- Theme migrated from dark navy to warm beige/light styling.
- Site body background target is warm beige `#E7DFD0` / `rgb(231, 223, 208)`.
- Footer status text "All systems operational" was removed and verified.
- Privacy page was converted from white/dark prose to black/slate text.
- Terms page no longer uses a hardcoded white section background.

## Dashboard Notes

Dashboard route groups:

- `/dashboard`: overview page via `components/dashboard/overview.tsx`.
- `/dashboard/conversations`
- `/dashboard/tickets`
- `/dashboard/customers`
- `/dashboard/knowledge-base`
- `/dashboard/analytics`
- `/dashboard/copilot`
- `/dashboard/tap-box`
- `/dashboard/workflows`
- `/dashboard/orchestration`
- `/dashboard/integrations`

Dashboard shell:

- `components/dashboard/dashboard-shell.tsx` handles session loading skeleton, sidebar drawer, topbar, and page transition.
- Auth enforcement is noted as happening in `proxy.ts`; shell mostly handles UI state.
- `components/dashboard/sidebar.tsx` groups nav into primary, AI Copilot, and Automation.
- Sidebar count badges call `api.analytics.overview` and use `formatCount`.

Copilot dashboard:

- `/dashboard/copilot` keeps the original card-based dashboard design with `DashPageHeader`, the prompt/generate bar, the AI Copilot draft card, and the AI reasoning side card.
- A compact "Live conversation context" card now loads org-scoped conversations through `conversations.listWorkbench`, supports active/archive views, search, unread/pinned metadata, quick create, pin/archive/delete actions, and optimistic rollback for those actions. The context card is intentionally styled as a polished triage module with selected-row accent rail, metadata pills, selected-thread KPI tiles, and a latest-context preview.
- The generate row is a command surface showing the selected draft target, guidance input, and primary generate action as one workflow.
- Draft, edit, and reasoning cards use clearer status chips, softer evidence surfaces, and explicit empty/source states while preserving the existing warm dashboard theme.
- Draft generation uses the selected conversation thread to build the copilot SSE input and passes the real `ticketId`.
- Sending a copilot reply first records the copilot decision, then creates a real `agent` message through `conversations.addMessage`; email conversations therefore reuse the existing queued outbound email pipeline.

Tap Box dashboard:

- `/dashboard/tap-box` is now a production audit workbench over `analytics.auditLogs` rather than only a latest-log viewer.
- It supports decision search, risk filters (`all`, auto-pass, review, blocked), source filters, selectable audit history, refresh, copy trace, and JSON export.
- The inspector surfaces confidence against the 85% gate, citations, policy checks, hallucination flags, AI input/output, decision metadata, and links to Copilot, Analytics, and Knowledge Base.
- Empty, loading, and error states are handled directly in the page; the prior non-functional filter button was removed.

Customers dashboard:

- `/dashboard/customers` is now a customer operations workbench with real add-customer modal, refresh, tier filtering, server search, sortable directory columns, selected-customer profile, customer health metrics, and recent ticket history via `customers.getHistory`.
- Customer list search in `lib/api/routers/customers.ts` now matches name, email, and company.
- The customer profile panel links into tickets and conversations using the customer email as query context.

Knowledge Base dashboard:

- `/dashboard/knowledge-base` is now a source-management workbench with real add-source modal, source/status filters, server search, sortable source table, selected-source inspector, content preview, copy content, delete confirmation, and retrieval-readiness checks.
- `knowledge.list` accepts `search` across title, URL, and content; `knowledge.getById` returns org-scoped source content for inspection.
- Adding a source still queues the existing embedding job through `embeddingQueue`; list/detail queries poll/refresh to surface indexing status.

Analytics dashboard:

- `/dashboard/analytics` is now a live reporting workbench backed by `analytics.report`, with 7/30/90-day range selection, CSV export, refresh, KPI cards, ticket/AI-resolution trends, queue distribution, confidence/source coverage, latency charts, priority/channel mix, executive signals, recent ticket activity, and Copilot health.
- `analytics.report` returns org-scoped overview data, daily ticket/audit trend buckets, status/priority/channel distributions, and recent audit health for the selected range.

Workflows dashboard:

- `/dashboard/workflows` is now a workflow lifecycle control plane with registry search, stats, readiness analysis, create-from-template, activate/pause, duplicate, delete confirmation, definition copy, preflight run, durable Temporal run, and builder handoff.
- Workflow validation lives in `lib/workflows/analyzer.ts`; lifecycle run/activation policy lives in `lib/workflows/lifecycle.ts`, with focused Vitest coverage.
- `orchestration.getWorkflows` returns each workflow with analysis. Router lifecycle procedures now include `validateWorkflow`, `setWorkflowActive`, `duplicateWorkflow`, `deleteWorkflow`, `preflightPipeline`, and guarded `runPipeline`.
- Dashboard "Run preflight" compiles and validates without Temporal. "Start durable run" uses Temporal and now returns a clear `SERVICE_UNAVAILABLE` message if the durable runner is offline.

## API and Data Model

tRPC root routers in `lib/api/root.ts`:

- `governance`
- `orchestration`
- `copilot`
- `tickets`
- `conversations`
- `customers`
- `knowledge`
- `analytics`

`protectedProcedure` in `lib/api/trpc.ts` requires `ctx.user.orgId`, so feature routers should always scope DB reads/writes by org.

Main Drizzle tables:

- Multi-tenant core: `organizations`, `users`
- CRM/support: `customers`, `tickets`, `conversations`, `messages`
- Email: `emailEvents`
- AI/orchestration: `workflows`, `auditLogs`
- KB/vector: `knowledgeSources`
- HITL: `hitlQueue`
- Pipeline execution: `pipelineRuns`, `pipelineRunSteps`
- Queue tracking: `jobs`

Important data model details:

- `knowledgeSources.embedding` is `vector(768)` and must match `EMBEDDING_DIMENSION`.
- `conversations` has email threading fields: `emailRootMessageId`, `emailReplyToAddress`.
- `conversations` also has workbench metadata from migration `0005_conversation_workbench`: nullable `title`, `pinnedAt`, `archivedAt`, integer `unreadCount`, json `tags`, and `updatedAt`.
- `messages.metadata.email` tracks `messageId`, `inReplyTo`, `resendId`, delivery status, and errors.
- `tickets.create` also creates a conversation so queue "View" actions resolve.
- `tickets.create` rejects `channel=email` unless the selected customer belongs to the org and has a syntactically valid email address; dashboard ticket creation mirrors this with a customer picker.

## Email Integration

Current email flow:

- `conversations.addMessage` creates messages.
- If the conversation is `email`, role is `agent`, and `metadata.isInternal` is false, it marks the message email delivery status as `queued`.
- It enqueues a BullMQ `notification` job with type `agent_reply`.
- Failed/bounced email agent replies can be retried through `conversations.retryAgentReply`, which reuses the same `agent_reply` queue path with the exact original `messageId`.
- `lib/queue/workers/notification-worker.ts` processes notification jobs.
- `lib/email/send-agent-reply.ts` sends through Resend and builds threading headers.
- `lib/email/send-agent-reply.ts` checks `suppressed_emails` before every outbound send and throws non-retryable `Recipient suppressed` before calling Resend.
- Resend errors are classified as retryable/permanent in `classifyResendError`.
- `app/dashboard/conversations/page.tsx` shows delivery status pills on email agent bubbles and eagerly invalidates conversation queries after send/retry.
- Known limitation: there is no conversation-specific websocket/SSE stream yet. Existing Socket.IO is scoped to HITL/pipeline events, and copilot SSE is separate, so conversation delivery status still relies on polling plus eager invalidation after local actions.
- `app/api/webhooks/resend/events/route.ts` handles signed Resend `email.delivered`, `email.delivery_delayed`, `email.bounced`, and `email.complained` webhooks.
- Resend delivery events map `data.email_id` to `email_events.providerId`; outbound send rows therefore store `providerId = resendId` and `messageId` as the local message FK.
- Hard bounces and complaints insert `(orgId, email, reason)` into `suppressed_emails`; the conversations UI surfaces `bounced` and `suppressed` as channel-blocked states.

Inbound email flow:

- `app/api/webhooks/resend/inbound/route.ts` verifies the raw payload with Svix `Webhook.verify()` and `RESEND_WEBHOOK_SECRET`.
- The route uses Upstash rate limiting when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured; production fails closed if they are missing.
- `lib/email/parse-inbound.ts` normalizes Resend `email.received` plus `emails.receiving.get(email_id)`, sanitizes HTML/text, and strips quoted reply history with `email-reply-parser`.
- Inbound content is passed through `PIIMasker.mask()` immediately before inserting the customer message.
- Inbound conversation resolution order is reply address match on `conversations.emailReplyToAddress`, then stored inbound RFC message IDs from `messages.metadata.email.messageId` via `In-Reply-To` / `References`.
- Unresolved, sender mismatch, and org scope mismatch cases are logged to `email_events` with explicit statuses and return 200 to stop Resend retries.
- Inbound idempotency uses unique `(direction, providerId)` on `email_events`.
- `email_events.orgId` and `email_events.conversationId` are nullable so unresolved inbound webhooks can be retained for manual triage.
- Webhook auth/CSRF check: `proxy.ts` only matches `/dashboard` and `/dashboard/:path*`; there is no global CSRF middleware, so `/api/webhooks/resend/*` is protected by route-level Svix verification instead of session auth.
- README contains the local two-way email runbook and DNS requirements. Public DNS check on 2026-07-02 for the configured domain found SPF present on `omniclaw.ai`, but DMARC missing on `omniclaw.ai`, and inbound MX/DMARC missing on `mail.omniclaw.ai`; DKIM selectors must be verified from Resend's dashboard-generated records.

Relevant tests:

- `lib/email/threading.test.ts`
- `lib/email/parse-inbound.test.ts`
- `lib/api/routers/conversations.email-outbound.test.ts`
- `lib/api/routers/tickets.email-create.test.ts`
- `app/api/webhooks/resend/inbound/route.test.ts`
- `app/api/webhooks/resend/events/route.test.ts`

## Auth Notes

- `auth.ts` normalizes trailing slashes from `NEXTAUTH_URL` and `AUTH_URL`.
- Credentials provider checks `users.passwordHash`.
- Google users must already exist in `users`; unknown Google users are redirected to `/signin?error=AccountNotFound`.
- Session token receives `id`, `orgId`, and `role`.
- `types/next-auth.d.ts` extends session/user types.

## Styling and UX Conventions

- Marketing theme has warm beige/light background despite `html` retaining `className="dark"`.
- Dashboard uses CSS variables and classes like `dash-shell`, `dash-bg-sidebar`, `dash-card-raised`, `dash-border`.
- Prefer existing shadcn/Radix UI primitives and `lucide-react` icons.
- Keep dashboard UI dense, operational, and scan-friendly.
- Avoid reintroducing hardcoded white boxes on warm beige marketing pages unless intentional.
- Avoid `prose-invert` on light legal/content pages.

## Testing and Verification Strategy

- For narrow logic changes, run focused unit tests with `npm run test:unit` or a specific Vitest file if supported.
- For marketing/dashboard visual changes, start `npm run dev` and verify responsive views when feasible.
- For E2E landing checks, use `npm test` / Playwright.
- For DB/API changes, verify TypeScript and relevant tRPC callers; migrations must match `lib/db/schema.ts`.
- Be aware Next build may use Turbopack and historically may not cover all TS type issues; do not rely only on build.

## Current Worktree Snapshot on 2026-07-02

There were many pre-existing uncommitted local changes before this knowledge file was created. Treat them as user work unless proven otherwise.

Notable modified/untracked areas at that time:

- README and env examples updated.
- Dashboard conversations, tickets, overview, sidebar, analytics.
- Auth changes.
- Email integration files and tests.
- DB schema, seed, and migration `0002_email_integration`.
- Queue notification worker and queue types.
- Temporal connection/client/worker changes.
- `scripts/dev-all.sh` changes.
- Log and build cache files changed.

## Maintenance Rule

For future tasks:

1. Read `AGENTS.md` and this file before broad repo exploration.
2. Use this file to decide the smallest source files to inspect next.
3. After completing a meaningful feature, fix, migration, command change, or design decision, update this file with only the durable facts.
4. Do not bloat this file with implementation transcripts, temporary debugging notes, or secrets.
