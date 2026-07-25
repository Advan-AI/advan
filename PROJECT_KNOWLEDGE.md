# v0-advan Project Knowledge

Last updated: 2026-07-25 (billing mobile→4K responsive)

Use this file as the first stop for future Codex work in this repo. Keep it concise and update it after meaningful features, fixes, architecture changes, migrations, or command changes.

## Product

Advan AI is a customer-support trust infrastructure app. It combines a marketing site with a signed-in dashboard for tickets, conversations, customers, knowledge base, analytics, copilot, Tap Box, workflows, orchestration, and integrations.

User may refer to this project as "Kimko"; the codebase, routes, metadata, assets, and docs are currently branded as Advan / `v0-advan`. Treat "Kimko/current project" as this repo unless the product rename is implemented in source.

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
- Inbound intake: `lib/tickets/auto-intake.ts` is the shared entry point for customer messages. It resolves/creates customer identity, reuses an open ticket+conversation for the same org/customer/channel, otherwise creates both, then inserts the user message and returns ids for triage.
- Storage: AWS S3 for KB documents.
- Governance: policy, PII masking, citations, hallucination detection, and complaint classification under `lib/governance`.
- Observability: Sentry, Vercel Analytics, OpenTelemetry in production.

## Commands

- Install: `npm install --legacy-peer-deps` (no committed lockfile; CI/Vercel/Docker resolve deps server-side from `package.json`)
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
- Resend inbound webhooks: `RESEND_WEBHOOK_SECRET`; canonical route is `/api/webhooks/resend/inbound`. Compatibility alias `/api/v1/webhooks/inbound/resend` calls the same `handleInboundRequest` handler for existing Resend webhook configs.
- AWS S3: storage config used by `lib/storage/s3-client.ts`

Security notes:

- Do not commit real secrets.
- `.env` currently exists locally and must be treated as sensitive.
- Keep `.env.local.example` as placeholders only.
- Google OAuth callback must be `{NEXTAUTH_URL}/api/auth/callback/google`; no trailing slash on `NEXTAUTH_URL`.
- tRPC client responses are sanitized in `lib/api/sanitize-trpc-error.ts` (via `lib/api/trpc.ts` `errorFormatter`): never expose SQL/`Failed query`, stack traces, or raw Zod issue JSON to browsers. Full errors are logged only in `app/api/trpc/[trpc]/route.ts` `onError`. Signup UI uses `lib/api/safe-client-error.ts` as a second line of defense.

## App Structure

- `app/page.tsx`: marketing homepage composition.
- `app/layout.tsx`: global metadata, dark html class, `Providers`, Vercel Analytics in production.
- `app/globals.css`: global theme tokens and marketing/dashboard utility classes.
- `app/providers.tsx`: client provider boundary. Wraps dashboard/signin routes with `SessionProvider`; all routes get TanStack Query + tRPC client using `/api/trpc`.
- `app/dashboard/layout.tsx`: wraps dashboard pages in `DashboardShell`.
- `proxy.ts`: Next.js 16 proxy, matches only `/dashboard` and `/dashboard/:path*` for NextAuth session enforcement.
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
- `lib/conversations/*`: shared DB helpers used by both tRPC routes and background workers (e.g. `insert-agent-message.ts`).
- `lib/orchestration/*`: LangGraph/workflow engine.
- `lib/pipeline/*`: pipeline builder schema, compiler, registry, execution store.

## Future Work Starting Points

Use this map before broad exploration:

- Marketing/homepage changes: start with `app/page.tsx`, then the specific `components/*-section.tsx`, plus `app/globals.css` for theme tokens.
- Legal/about/sign-in pages: `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/about/page.tsx`, `app/signin/page.tsx`, `app/signin/forgot/page.tsx`.
- Dashboard frame/nav/counts: `components/dashboard/dashboard-shell.tsx`, `components/dashboard/sidebar.tsx`, `components/dashboard/topbar.tsx`, `components/dashboard/overview.tsx`.
- Dashboard responsive frame (mobile → 4K): CSS tokens/utilities in `app/globals.css` (`.dash-shell` vars, `.dash-main`, `.dash-page` max-width centering, `.dash-workbench`). Shell uses mobile drawer with Esc/scroll-lock; conversations uses list↔thread pane switching below `xl`; content caps at ~1600–2048px on ultrawide/4K so layouts do not stretch unreadably.
- Tickets queue responsive (`app/dashboard/tickets/page.tsx`): below `lg` (1024px) renders a touch-first card stack with always-visible View CTA + mobile sort control; at `lg+` mounts a sticky-header data table (single layout via `useSyncExternalStore` so keyboard row refs stay stable). Subject column truncates with fluid max-widths through `4xl`; channel label collapses to icon-only until `xl`; View link stays visible on touch and fades in on hover-capable pointers. Bulk bar + new-ticket sheet use safe-area insets; `.tickets-page` in `globals.css` hides chip-rail scrollbars and pads when the bulk toolbar is open.
- Customers directory responsive (`app/dashboard/customers/page.tsx`): below `xl` uses list↔profile pane switching (Back to directory); at `xl+` side-by-side workbench with profile column widening through `3xl`/`4xl`. Directory itself is cards below `lg` and a sticky-header table at `lg+` (company column appears at `xl`). KPI strip is 2→3→5 cols; add-customer modal is a bottom sheet on phones with safe-area padding.
- Knowledge base responsive (`app/dashboard/knowledge-base/page.tsx`): below `xl` list↔inspector pane switching (Back to sources); at `xl+` split workbench with inspector column scaling through `4xl`. Sources are cards below `lg` and sticky-header table at `lg+`. KPI strip 2→3→6; create/edit/view/delete modals are bottom sheets on mobile with safe-area insets; content preview max-height uses `dvh`.
- Analytics responsive (`app/dashboard/analytics/page.tsx`): segmented 7d/30d/90d range control; KPI strip 2→3→5; chart heights fluid via `min(vw,…)` then step up through `3xl`/`4xl`; pie/axis margins adapt via `useMediaQuery`; dual Y-axis collapses on phones; triage breakdown stacks 1→2→3 cols; side panels widen on ultrawide.
- Copilot responsive (`app/dashboard/copilot/page.tsx`): below `xl` conversation list↔detail pane switching (Back to conversations); at `xl+` split context workbench with list column widening through `4xl`. Draft + reasoning stack below `lg`, then side-by-side with reasoning column scaling on ultrawide. Generate bar / edit actions use full-width touch targets on phones; desktop no longer auto-selects a thread until `xl`.
- Tap Box responsive (`app/dashboard/tap-box/page.tsx`): Pending Reviews stay a single scrollable queue with stacked Approve/Reject and touch-sized controls; Audit Trail uses queue↔detail pane switching below `xl` (Back to decision queue) and a three-column workbench at `xl+` with list/inspector/metadata columns scaling through `4xl`. KPI strip 2→3→5; scrollable tabs; fluid `dvh` decision-list heights; Copy/JSON available on phones.
- Workflows responsive (`app/dashboard/workflows/page.tsx`): below `xl` registry/logs↔inspector pane switching (Back to registry / execution logs); at `xl+` split workbench with inspector column scaling through `4xl`. KPI strip 2→3→6; registry cards 1→2→3 cols; desktop auto-selects first workflow/run, mobile does not until tap. Create/delete are bottom sheets with safe-area; touch-sized Activate/Copy/Delete and preflight actions.
- Orchestration builder responsive (`components/pipeline/pipeline-builder.tsx`): below `lg` canvas-first with floating Nodes/Config controls and bottom sheets (safe-area); palette uses tap-to-add (HTML5 DnD kept for desktop). At `lg+` three-column palette/canvas/inspector with column widths scaling through `4xl`. Compact toolbar wrap, MiniMap hidden on phones, fluid `dvh` canvas + trace heights.
- Integrations responsive (`app/dashboard/integrations/*`): stacked settings cards stay single-column; marketplace grid 1→2→3→4 cols through `4xl`. Team invite/remove are bottom sheets with safe-area; widget key/origins/forms stack on phones with touch targets; long emails/keys use `break-all`; content max-width steps up on ultrawide.
- Billing responsive (`app/dashboard/billing/page.tsx`): subscription + metering stack below `lg` then 1+2 workbench; plan cards 1→2→3 cols; invoices are touch cards below `lg` and a sticky-feel table at `lg+`; plan-change confirm is a bottom sheet with safe-area; Stripe portal / payment CTAs are full-width on phones.
- tRPC API shape: `lib/api/root.ts`, `lib/api/trpc.ts`, `app/api/trpc/[trpc]/route.ts`.
- Auth/session issues: root `auth.ts`, `auth.config.ts`, `lib/auth-server.ts`, `proxy.ts`, `types/next-auth.d.ts`. `lib/auth.ts` is an older localStorage demo helper; do not confuse it with real NextAuth.
- Database/model changes: `lib/db/schema.ts`, matching `lib/db/migrations/*`, and `lib/db/seed.ts`.
- Tickets: `app/dashboard/tickets/page.tsx` and `lib/api/routers/tickets.ts`.
- Conversations/email workbench: `app/dashboard/conversations/page.tsx`, `lib/api/routers/conversations.ts`, `lib/email/*`, Resend webhook routes.
- Shared inbound customer-message intake: `lib/tickets/auto-intake.ts`; customer lookup helper lives in `lib/api/routers/customers.ts`. Email inbound resolves org from reply address/message headers, then calls this shared service.
- Copilot drafting: `app/dashboard/copilot/page.tsx`, `app/api/copilot/stream/route.ts`, `lib/copilot/*`, `lib/governance/*`, `lib/vector/*`.
- Complaint classification (copilot triage): `lib/governance/complaint-classifier.ts`; exports `classifyMessage()` and `parseClassification()`. Separate LLM call (see latency note in file). Tests: `lib/governance/complaint-classifier.test.ts`.
- Auto-triage pipeline: `lib/queue/workers/copilot-triage-worker.ts` processes `copilotTriageQueue` jobs (one per inbound message). Runs classifier + draft generation in parallel (Promise.all), gates on isComplaint and 85% confidence threshold, uses `NoOpHitl` so the SuggestionService never double-enqueues. Auto-send path uses `lib/conversations/insert-agent-message.ts` shared helper. Enqueue happens in `lib/tickets/auto-intake.ts` after message insert (non-fatal try/catch). Tests: `lib/queue/workers/copilot-triage-worker.test.ts`, `lib/queue/workers/copilot-triage-worker.e2e.test.ts`. Dev: start with `DEV_ALL_SKIP_TRIAGE=1` to skip. Complaint HITL reason format: `[COMPLAINT] severity — reasoning` (the `[COMPLAINT]` prefix is required — test and code must match).
- Tap Box/audit review: `app/dashboard/tap-box/page.tsx`, `lib/api/routers/analytics.ts`, `lib/copilot/decision-service.ts`, `auditLogs` and `hitlQueue`. Tap Box has three filters: Risk (auto-pass/review/blocked), Sources (sourced/unsourced KB citations), and Origin (auto-triage/manual). The Origin filter reads `auditLogs.metadata.source` which is set to `"auto_triage"` by the triage worker.
- Customers: `app/dashboard/customers/page.tsx`, `lib/api/routers/customers.ts`.
- Knowledge base: `app/dashboard/knowledge-base/page.tsx`, `lib/api/routers/knowledge.ts`, `lib/queue/workers/embedding-worker.ts`, `lib/vector/*`, `lib/storage/s3-client.ts`. *Embedding-worker uses try-catch to mark status as 'failed' in DB if processing fails, and fetch uses a generous 30s timeout to support slower local Ollama setups.*
- Analytics: `app/dashboard/analytics/page.tsx`, `lib/api/routers/analytics.ts`, `lib/analytics/org-overview.ts`, `lib/analytics/triage-breakdown.ts`. The analytics dashboard now includes an "Auto-triage resolution rate" card showing % auto-resolved vs escalated, broken out by channel and by complaint vs non-complaint type. Backed by `analytics.triageBreakdown` tRPC procedure which reads from `messages.metadata.triage` (stamped by the triage worker) joined with `conversations` for channel. Tests: `lib/analytics/triage-breakdown.test.ts`.
- Workflow registry/control plane: `app/dashboard/workflows/page.tsx`, `lib/api/routers/orchestration.ts`, `lib/workflows/analyzer.ts`, `lib/workflows/lifecycle.ts`.
- Visual pipeline builder: `app/dashboard/orchestration/page.tsx`, `components/pipeline/*`, `lib/pipeline/*`.
- Durable pipeline execution: `lib/api/routers/orchestration.ts`, `lib/pipeline/compiler.ts`, `lib/temporal/workflows/pipeline-execution.ts`, `lib/temporal/activities/pipeline-activities.ts`, `lib/pipeline/executors/index.ts`.
- Realtime pipeline/HITL updates: `lib/realtime/socket-server.ts`, `lib/realtime/event-bus.ts`, `lib/pipeline/use-pipeline-realtime.ts`, `app/api/hitl/route.ts`. Socket server supports two connection modes: agent (orgId only → joins `org:{orgId}`) and chat visitor (conversationId + orgId → DB-verified, joins `conversation:{conversationId}`). Chat visitor events: `chat:agent_reply` (AI auto-replied) and `chat:triage_pending` (escalated; show "agent will respond" state). Event bus has two new channels: `CHAT_AGENT_REPLY_CHANNEL` and `CHAT_TRIAGE_PENDING_CHANNEL`.
- Chat widget namespace: `lib/realtime/chat-widget-namespace.ts` — `/chat-widget` Socket.IO namespace mounted on the existing server (no second process). Auth middleware verifies the 1-hour JWT from `POST /api/chat/session` AND re-checks the origin against `widget_configs.allowedOrigins` (separate trust boundary). Visitors join `widget:{conversationId}` + `widget-org:{orgId}` rooms. Server events to visitor: `session:ready`, `agent:message`, `triage:pending`, `typing:start`/`typing:stop` (with `role:"agent"`), `presence:agent-online`. Visitor events: `visitor:message`, `typing:start`/`typing:stop`. Reconnect: if no conversationId in auth, server looks up by visitorSessionId; client fetches missed messages via REST after receiving `session:ready`. Agent typing relayed from default-ns `agent:typing:start`/`agent:typing:stop` → widget room. Tests: `lib/realtime/chat-widget-namespace.test.ts`.
- Chat session: `app/api/chat/session/route.ts` — public unauthenticated POST endpoint for the embedded widget. Accepts `{ widgetKey, origin, visitorSessionId? }`. Looks up `widget_configs` by widgetKey, enforces exact-match origin allowlist (rejects 403 on mismatch), mints or reuses a UUID visitorSessionId, signs a 1-hour HS256 JWT (`{ orgId, widgetKey, visitorSessionId }`, issuer `advan:chat-session`) using `AUTH_SECRET`/`NEXTAUTH_SECRET` via jose. Returns `{ token, visitorSessionId }`. Dual rate-limited: 20/min per IP via Upstash (fails closed in production) AND 60/min per widgetKey (fails closed in production) to prevent tenant starvation. Tests: `app/api/chat/session/route.test.ts`.
- Chat intake: `app/api/chat/intake/route.ts` — public unauthenticated POST endpoint for widget messages. Accepts `{ orgId, content, visitorSessionId?, subject? }`. Calls `resolveOrCreateIntake` with `channel: "chat"`. Returns `{ conversationId, messageId, ticketId, isNewTicket, status: "received" }`. Dual rate-limited: 30/min per IP (in-memory) AND 120/min per widgetKey via Upstash (fails closed in production) to support high, burstable chat session traffic while preventing broad system exhaustion.
- Workers/dev services: `scripts/dev-all.sh`, `lib/queue/workers/*`, `lib/temporal/worker.ts`, `lib/temporal/workers/daemon.worker.ts`, `lib/mcp/http-server.ts`.

## Chat Widget Verification and Hardening (Prompt 7)

- **Critical fix (2026-07-08)**: BullMQ custom job IDs cannot contain `:`. `auto-intake.ts` used `triage:${messageId}` which caused every triage enqueue to fail silently (`[auto-intake] Failed to enqueue triage job: Custom Id cannot contain :`). Fixed to `triage-${messageId}` for both job name and `jobId`.
- **Live verification script**: `scripts/verify-chat-prompt7.ts` — exercises routine auto-triage, complaint HITL, offline intake, and Tap Box channel labeling against a running `dev:all` stack. Requires `widget_configs` row (`wk_test_local`), `DATABASE_URL`, Redis, and **Ollama running with KB embeddings indexed** for scenario 1 auto-send (confidence ≥ 85%). Run: `npx tsx scripts/verify-chat-prompt7.ts`.
- **Tap Box channel labeling**: `analytics.auditLogs` tRPC procedure LEFT JOINs `tickets` to return `channel` (email/chat/…) alongside each audit log. The Tap Box `DecisionListItem` shows a colored channel badge (blue for chat, purple for email) and the "Decision metadata" panel shows a "Channel" row using `channelLabel()`. Both source (auto_triage/manual) and channel are visible side by side. Verified in DB: chat-channel audit logs carry `source=auto_triage` + `channel=chat`.
- **TODO/FIXME sweep**: Full grep of the chat code path — zero TODOs or FIXMEs found.
- **Load test script**: `scripts/load-test-widget.ts` — hits 100 concurrent sessions against `POST /api/chat/session` and `GET /api/chat/availability`, optionally 50 concurrent socket connections (`LOAD_TEST_SOCKET=1`). Uses `forceNew: true` + `extraHeaders: { origin }` + polling transport for Node socket clients. Verified: 50/50 sessions ok, 50/50 sockets connected, no 5xx.
- **Triage worker in dev**: Started by `scripts/dev-all.sh` (skip with `DEV_ALL_SKIP_TRIAGE=1`).
- **Migrations 0008–0011**: `widget_configs`, `customers_org_visitor_session_unique`, `conversations.chat_offline_delivery`, `users.chat_available`. If `drizzle-kit migrate` stops at 0007, apply SQL manually and insert journal hashes (see `drizzle.__drizzle_migrations`).
- **Live verification results (2026-07-08)**:
  - ✅ Complaint chat → `triage:pending` with `priority=complaint`, HITL row with `[COMPLAINT]` prefix, no auto-send (~5s latency)
  - ✅ Offline intake → `offlineMode=true`, `chatOfflineDelivery=true`, visitor email stored on customer
  - ✅ Load test 50 concurrent sessions + 50 sockets, p99 < 600ms
  - ✅ Unit/e2e: `chat-widget-namespace`, `session/route`, `chat-channel`, `copilot-triage-worker.e2e`, `offline-chat`, `triage-breakdown` — all pass
  - ⚠ Scenario 1 live auto-send requires Ollama + indexed KB embeddings (without Ollama, triage runs but confidence ~44% → `hitl_low_confidence`)

## Chat Dashboard Integration (Prompt 6 additions)

- `users.chatAvailable` boolean column (migration `0011_agent_chat_available.sql`, default `true`). Controls whether the agent accepts live chat even when their socket session is connected. Surface via `conversations.getAgentChatStatus` (query) and `conversations.setAgentChatAvailable` (mutation).
- Topbar (`components/dashboard/topbar.tsx`) shows a "Chat on / Chat off" toggle next to the Online badge. Reads `chatAvailable` from tRPC, toggles optimistically.
- `isOrgChatAccepting(orgId)` in `lib/realtime/event-bus.ts` — combines Redis socket presence (fast path) AND `users.chatAvailable` DB check. Used by `GET /api/chat/availability` and `POST /api/chat/intake` instead of old `isAnyAgentOnline`.
- `chat-widget-namespace.ts` now emits `visitor:online { conversationId }` / `visitor:offline { conversationId }` to `org:{orgId}` room when a widget visitor connects/disconnects.
- Conversations page socket connection: agents join the default namespace with `auth: { orgId }`. Subscribes to `visitor:typing:start`, `visitor:typing:stop`, `visitor:online`, `visitor:offline`. Displays a visitor-online badge in the thread header (chat channel only) and an animated typing-dots bubble in the message list.
- Agent typing emit: when the agent types in the composer for a chat conversation, emits `agent:typing:start { conversationId }` / `agent:typing:stop` to the socket server (which relays to the widget visitor). Stops automatically before send.
- Single code path confirmed: `conversations.addMessage` (tRPC) → `insertAgentMessage` (shared helper) → email queue OR `publishChatAgentReply` Redis pub/sub → socket server → visitor widget. Auto-triage worker uses the same `insertAgentMessage`. No separate path for manual vs auto replies.
- Dashboard customer-message notifications: chat still emits `visitor:message` directly from the widget namespace; inbound email publishes `CUSTOMER_MESSAGE_CHANNEL` (`advan:customer:message`) via Redis after `resolveOrCreateIntake`, and `socket-server.ts` relays it to dashboard agents as `customer:message`. Requires `REDIS_URL` + socket server for cross-process email notification fan-out.
- Conversation list triage badges (AI Replied / Complaint Review / Pending Review) now work for ALL channels: `messages.metadata` is included in the `conversations.list` query, `ConvItem.lastMessage.metadata` is typed, and `threadToConvItem` passes the metadata through. The `triage.*` and `isAutoTriaged` metadata fields are stamped by the copilot-triage-worker regardless of channel.
- Copilot source citations: `PgVectorRetrieval` first uses Ollama + pgvector, then falls back to tenant-scoped keyword matching over recent KB documents when embeddings are missing/unavailable. This lets newly added docs (e.g. refund policy) appear in "Sources cited" even before the embedding worker completes.

## Chat Widget Embed

- Embed loader: `public/widget.js` — vanilla JS, no framework, served as a static file.
  Usage: `<script src="https://yourapp.com/widget.js" data-key="wk_xxx"></script>`
  Creates a floating bubble (bottom-right) that expands to a panel on click. Bubble icon toggles open/close; Escape key also closes. postMessage accepts `{ type: 'advan:close' }` from the frame.

- Widget iframe: `app/chat-widget-frame/page.tsx` — standalone Next.js page, `"use client"`, no nav/header/footer.
  URL params: `key` (widgetKey) and `origin` (embedding page's origin, forwarded to session endpoint).
  Flow: availability → session JWT → intake (first message) → socket connect → messages.
  localStorage keys: `advan_widget_vsid` (visitorSessionId), `advan_widget_cid` (conversationId) for reconnect.
  Socket: connects to `/chat-widget` namespace at `NEXT_PUBLIC_SOCKET_URL ?? :3002`. First message uses REST `/api/chat/intake`; subsequent messages use socket `visitor:message`. Reconnect re-uses stored conversationId.
  postMessage to parent: `{ type: 'advan:ready' }` on mount, `{ type: 'advan:close' }` on X button.

- Widget bare layout: `app/chat-widget-frame/layout.tsx` — no chrome, renders children directly.

- iframe sandbox: `allow-scripts allow-forms allow-same-origin allow-popups` — same-origin needed for socket.io localStorage/cookies and app API calls.

- Security headers for `/chat-widget-frame` in `next.config.mjs`: `frame-ancestors *` (any site may embed), no `X-Frame-Options` (omission = only CSP governs). All other routes keep `frame-ancestors 'none'` / `X-Frame-Options: DENY`.

- Socket namespace origin: `lib/realtime/chat-widget-namespace.ts` allows the app's own URL (`AUTH_URL` / `NEXTAUTH_URL`) in addition to `widgetConfigs.allowedOrigins` — necessary because the iframe connects from the app's own origin, not the embedding site's origin.

- Manual test page: `public/widget-test.html` — open at `http://localhost:3000/widget-test.html`. Requires a `widget_configs` row with `widgetKey: "wk_test_local"` and `allowedOrigins: ["http://localhost:3000"]`.

- Widget test seed SQL:
  ```sql
  INSERT INTO widget_configs (id, org_id, widget_key, allowed_origins, pre_chat_form_enabled)
  SELECT gen_random_uuid(), id, 'wk_test_local', '["http://localhost:3000"]'::jsonb, true
  FROM organizations LIMIT 1;
  ```

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
- `/dashboard/billing`

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
- Responsive: below `xl`, audit queue and inspector/metadata use single-pane switching; at `xl+` sticky three-column workbench. HITL approve/reject are full-width on phones.

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
- Responsive: below `xl`, list↔inspector pane switching for both registry and execution logs; at `xl+` side-by-side workbench. Create/delete modals are mobile bottom sheets.

Orchestration builder:

- `/dashboard/orchestration` is now hardened around workflow lifecycle: workflow selector, URL `workflowId` handoff, editable name/description, active toggle, autosave/manual save, preflight-first execution, explicit durable-run button with Temporal tooltip, inline validation summary, and visible connection errors.
- Builder node inspector supports copy/delete for selected nodes.
- Canvas/store connection validation now uses `lib/pipeline/connection-validation.ts`, covering self-connections, cycles, missing nodes/types, invalid handles, incompatible port data types, and duplicate edges.
- Wire editing supports edge selection, detach, endpoint drag-reconnect, selected-wire body drag-to-block reconnect, inspector dropdown reassignment for source/target blocks, and select-wire-then-click-target-block reassignment. Knowledge Retrieval intentionally accepts `any` input so users can wire either raw message context or detected intent into retrieval.
- `orchestration.saveWorkflow` saves invalid in-progress graphs as inactive drafts instead of returning 400; activation/run paths remain guarded by deployability checks.
- Focused tests cover connection validation plus workflow analyzer/lifecycle policy.
- Responsive: below `lg`, canvas-first with Nodes/Config bottom sheets and tap-to-add palette; at `lg+` three-column builder with palette/inspector columns scaling through `4xl`.

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

`app/api/trpc/[trpc]/route.ts` builds tRPC context from `auth()`, optionally applies Upstash REST rate limiting at 60 requests / 60 seconds, returns only `{ id, orgId, role }` into router context, and logs full procedure errors server-side via `onError` (client payloads stay sanitized).

Main Drizzle tables:

- Multi-tenant core: `organizations`, `users`
- CRM/support: `customers`, `tickets`, `conversations`, `messages`
- Email: `emailEvents`
- AI/orchestration: `workflows`, `auditLogs`
- KB/vector: `knowledgeSources`
- HITL: `hitlQueue`
- Pipeline execution: `pipelineRuns`, `pipelineRunSteps`
- Queue tracking: `jobs`
- Chat widget: `widgetConfigs` (widgetKey, allowedOrigins jsonb array, preChatFormEnabled, brandingConfig jsonb)

Important data model details:

- `knowledgeSources.embedding` is `vector(768)` and must match `EMBEDDING_DIMENSION`.
- `conversations` has email threading fields: `emailRootMessageId`, `emailReplyToAddress`.
- `conversations` also has workbench metadata from migration `0005_conversation_workbench`: nullable `title`, `pinnedAt`, `archivedAt`, integer `unreadCount`, json `tags`, and `updatedAt`.
- `conversations` also has `visitorSessionId` (text, nullable, indexed) added by migration `0008_widget_configs` — ties a chat conversation to a browser session for reconnect, parallel to `emailReplyToAddress`.
- `messages.metadata.email` tracks `messageId`, `inReplyTo`, `resendId`, delivery status, and errors.
- `tickets.create` also creates a conversation so queue "View" actions resolve.
- `tickets.create` rejects `channel=email` unless the selected customer belongs to the org and has a syntactically valid email address; dashboard ticket creation mirrors this with a customer picker.

Feature router procedure map:

- `tickets`: `list`, `getById`, `create`, `updateStatus`, `assignTo`, `bulkUpdateStatus`, `kpis`.
- `conversations`: workbench list/detail, ticket lookup, add message, create support thread, rename, pin/archive/tag/read/delete, retry agent reply, legacy create.
- `customers`: list/search/filter, detail, history, create.
- `knowledge`: list/search/filter, detail with source content, add and queue embedding, delete and S3 cleanup.
- `analytics`: overview, summary, report, audit logs, latest audit log.
- `orchestration`: workflow list/save/validate/activate/duplicate/delete, legacy LangGraph run, pipeline preflight, durable Temporal run.
- `copilot`: applies accept/reject/modify decisions through `CopilotDecisionService`.

## Frontend Data Flow

- Dashboard pages are client components and use the generated `api` client from `lib/api/trpc-client.ts`.
- Query caching defaults live in `app/providers.tsx`: `staleTime` 30s and `retry` 1.
- Sidebar badges call `api.analytics.overview` every 60s and format counts through `lib/dashboard/format.ts`.
- Most dashboard screens keep table/filter/sort/modal state locally and rely on tRPC invalidation/refetch after mutations.
- Use existing `DashPageHeader`, dashboard CSS classes (`dash-card`, `dash-border`, `dash-bg-*`), local shadcn UI primitives, and `lucide-react` icons for new dashboard UI.

## Pipeline and Orchestration Internals

- Pipeline JSON contract is `PipelineSchema` in `lib/pipeline/schema.ts`: `schemaVersion: 1`, React Flow-like `nodes`, `edges`, optional `viewport`.
- Pipeline node metadata is registry-driven in `lib/pipeline/registry.ts`; built-in nodes are side-effect registered in `lib/pipeline/nodes/index.ts`.
- Built-in node types: `trigger.message`, `ai.intent`, `kb.retrieve`, `ai.compose`, `human.approval`, `action.crm`, `action.escalate`.
- Adding a node type normally requires metadata registration plus a matching server executor in `lib/pipeline/executors/index.ts`; canvas/inspector/compiler should remain registry-driven.
- `components/pipeline/pipeline-builder.tsx` owns workflow selection, URL `workflowId`, autosave, active toggle, preflight, undo/redo, and loading the Advan Copilot preset.
- `lib/pipeline/use-pipeline-store.ts` is the Zustand + zundo graph store. It owns nodes, edges, selected node/edge, dirty state, connection errors, serialization, and reconnect helpers.
- `lib/pipeline/connection-validation.ts` is the shared connection guard for canvas/store/tests. Keep new validation behavior covered by `lib/pipeline/connection-validation.test.ts`.
- `PipelineCompiler.compile()` validates schema and emits Temporal-safe execution data: topological `waves`, `nodes`, and per-node `incoming` handles.
- Durable runs start in `orchestration.runPipeline`, compile the graph, then start Temporal workflow `pipelineExecutionWorkflow` on task queue `TEMPORAL_TASK_QUEUE` or `advan-agents`.
- `pipelineExecutionWorkflow` runs nodes in parallel by wave, records each step, honors per-node `failurePolicy`, pauses `human.approval` with HITL signal `hitl-decision`, and writes `pipelineRuns` / `pipelineRunSteps`.
- Pipeline activities are Node-side and publish realtime events through `lib/realtime/event-bus.ts`; the workflow itself must stay deterministic and import only Temporal-safe code.

## Copilot and AI Flow

- `app/api/copilot/stream/route.ts` is the production Copilot SSE endpoint. It is `POST`, Node runtime, authenticated with `auth()`, emits typed SSE frames plus heartbeats, and avoids putting prompts in query strings.
- `lib/copilot/suggestion-service.ts` composes policy precheck, retrieval, streaming composition, grounding, confidence scoring, post-policy checks, audit persistence, and optional HITL enqueue.
- `buildSuggestionService()` wires concrete adapters from `lib/copilot/adapters.ts`: pgvector retrieval, streaming LLM composer, governance grounding, OPA/inline policy, Drizzle audit, Drizzle HITL.
- `CopilotDecisionService.apply()` records decisions on `auditLogs.metadata.decision`, updates output for accepted/modified decisions, resolves HITL rows, signals Temporal when a workflow is waiting, and broadcasts HITL resolution.
- Legacy `orchestration.runWorkflow` still exists for fallback LangGraph execution via `WorkflowExecutor`, but newer dashboard drafting uses Copilot SSE plus real conversation/ticket context.

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
- The route uses Upstash rate limiting when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured; production fails closed if they are missing. It applies dual rate limiting: a global IP protection rate limit (600 requests per minute per IP) to prevent DDoS/brute-force abuse, and a secondary tenant-isolated rate limit (60 inbound emails per minute per organization, keyed by resolved `orgId`) to protect resources and prevent one organization's email spike from causing false-positive rate-limit rejections for other tenants.
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
