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
- `messages.metadata.email` tracks `messageId`, `inReplyTo`, `resendId`, delivery status, and errors.
- `tickets.create` also creates a conversation so queue "View" actions resolve.

## Email Integration

Current email flow:

- `conversations.addMessage` creates messages.
- If the conversation is `email`, role is `agent`, and `metadata.isInternal` is false, it marks the message email delivery status as `queued`.
- It enqueues a BullMQ `notification` job with type `agent_reply`.
- `lib/queue/workers/notification-worker.ts` processes notification jobs.
- `lib/email/send-agent-reply.ts` sends through Resend and builds threading headers.
- Resend errors are classified as retryable/permanent in `classifyResendError`.

Relevant tests:

- `lib/email/threading.test.ts`
- `lib/email/parse-inbound.test.ts`
- `lib/api/routers/conversations.email-outbound.test.ts`

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
