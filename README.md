# Advan AI (v0-advan)

Customer-support oriented **Next.js** app with **tRPC**, **Drizzle ORM**, **NextAuth**, **LangGraph** orchestration, **Temporal** durable workflows, **BullMQ** embedding jobs, **pgvector** retrieval, and optional **Socket.IO** HITL. UI includes a marketing site and a **dashboard** (`/dashboard/*`).

Originally bootstrapped with [v0](https://v0.app); this repo is the full application codebase.

## Stack

| Layer | Technology |
|--------|------------|
| App | Next.js 16 (App Router), React 19, Tailwind |
| API | tRPC (`/api/trpc`), Server Actions where used |
| Auth | NextAuth v5 — Google OAuth + credentials |
| DB | PostgreSQL, Drizzle ORM, **pgvector** on `knowledge_sources.embedding` |
| AI | LangGraph / LangChain; Ollama or Anthropic; optional Groq fallback |
| Workflows | Temporal (`ticketResolutionWorkflow`, HITL signals) |
| Queue | BullMQ + Redis (`REDIS_URL`) for embeddings |
| Realtime | Socket.IO (`lib/realtime/socket-server.ts`) for HITL |
| Storage | AWS S3 (KB documents) |
| Policy | OPA-compatible HTTP + inline fallback (`lib/governance/`) |
| Observability | Sentry, OpenTelemetry (prod), LangSmith (optional) |

## Prerequisites

- **Node.js** 20+ (matches CI)
- **PostgreSQL** with the **`vector`** extension (Supabase, `pgvector/pgvector` Docker image, or self-hosted Postgres + `CREATE EXTENSION vector;`)
- **Redis** — required for the embedding worker and BullMQ
- **Temporal** dev server or cluster — for `npm run temporal:worker` and workflow APIs
- **Ollama** (local) and/or **Anthropic** / **Groq** keys — see `lib/llm/config.ts`

## Getting started

1. **Install dependencies**

   ```bash
   npm install --legacy-peer-deps
   ```

2. **Environment**

   Copy the safe template (placeholders only):

   ```bash
   cp .env.local.example .env.local
   ```

   Or use `.env` — `scripts/dev-all.sh` loads `.env` first, then `.env.local` if present. Fill in `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and optional Google OAuth, Redis, Temporal, Ollama, AWS, etc.

3. **Database**

   Ensure `vector` is enabled, then apply migrations:

   ```bash
   npx drizzle-kit migrate
   ```

   Seed data (if you use the project seed):

   ```bash
   npx tsx lib/db/seed.ts
   ```

4. **Run Next.js**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). The dashboard requires a signed-in user.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js dev server |
| `npm run dev:all` | Next.js + embedding worker + Temporal worker + Socket.IO (see script header for skip flags) |
| `npm run build` / `npm start` | Production build and server |
| `npm run temporal:worker` | Temporal worker daemon |
| `npm run temporal:bundle` | Bundle workflow code for worker |
| `npm run lint` | ESLint |
| `npm test` | Playwright E2E (`tests/e2e/`) |

**Workers (manual if not using `dev:all`):**

- Embeddings: `npx tsx lib/queue/workers/embedding-worker.ts` (needs `REDIS_URL`, DB, Ollama)
- Socket HITL: `npx tsx lib/realtime/socket-server.ts` (needs `SOCKET_PORT`, DB, Temporal client env)
- MCP (optional): `npx tsx lib/mcp/http-server.ts` or stdio via `lib/mcp/server.ts`

## Project layout

```
app/                    # App Router pages + API routes
lib/
  api/                  # tRPC routers and client
  db/                   # Drizzle schema, migrations, seed
  orchestration/        # LangGraph engine + WorkflowExecutor
  temporal/             # Workflows, activities, worker, client
  queue/                # BullMQ queues + embedding worker
  vector/               # pgvector queries + Ollama embeddings
  governance/           # Policy client, PII, citations, hallucination checks
  llm/                  # Runtime config (Ollama / Anthropic / Groq)
  realtime/             # Socket.IO HITL server
  mcp/                  # MCP server (HTTP + stdio)
  observability/        # OpenTelemetry bootstrap
components/             # UI (marketing + dashboard + orchestration canvas)
```

## API notes

- **tRPC** is mounted at `/api/trpc`. Procedures use `protectedProcedure` where multi-tenant `orgId` is required.
- **`POST /api/trigger-workflow`** starts Temporal `ticketResolutionWorkflow` — add authentication and authorization before exposing publicly.

## Email delivery and local webhook testing

This app uses Resend for two-way email conversations:

- Outbound agent replies are sent by the BullMQ notification worker through `lib/email/send-agent-reply.ts`.
- Inbound replies arrive at `POST /api/webhooks/resend/inbound`.
- Delivery status, bounces, and complaints arrive at `POST /api/webhooks/resend/events`.
- Both webhook routes verify Resend/Svix signatures with `RESEND_WEBHOOK_SECRET`.

The webhook endpoints are intentionally public and unauthenticated because Resend calls them server-to-server. The current Next.js proxy config in `proxy.ts` only matches `/dashboard` and `/dashboard/:path*`, so `/api/webhooks/resend/*` does not run session auth. There is no global CSRF middleware in this codebase; the only CSRF references are Auth.js internals. Keep webhook protection at the route level with Svix verification and rate limiting.

### DNS and deliverability

Resend domain verification must be completed before production sending:

1. In Resend, add the sending domain or subdomain used by `EMAIL_FROM`.
2. Copy Resend's generated SPF and DKIM DNS records exactly from the domain Records tab into the DNS provider.
3. If inbound replies are enabled, add Resend's inbound MX records for `EMAIL_INBOUND_DOMAIN`.
4. Publish DMARC with at least `p=quarantine`. Use `p=none` only as a temporary monitoring policy before production.

Recommended DMARC record:

```txt
Host: _dmarc.yourdomain.com
Type: TXT
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com; adkim=s; aspf=s
```

If the app sends from a subdomain such as `mail.yourdomain.com`, publish DMARC at `_dmarc.mail.yourdomain.com` or enforce subdomain policy from the organizational domain with an `sp=` tag.

Current local DNS check on 2026-07-02 for the configured `.env` domain:

- `omniclaw.ai`: SPF TXT record is present.
- `_dmarc.omniclaw.ai`: DMARC TXT record is missing and must be added before production.
- `mail.omniclaw.ai`: public MX records are missing, so Resend inbound replies will not reach the app until the Resend-provided MX records are added.
- `_dmarc.mail.omniclaw.ai`: DMARC TXT record is missing; add one here if `mail.omniclaw.ai` is the visible From domain.
- DKIM cannot be guessed safely from the repo because selectors are generated in Resend; confirm every DKIM record shown in Resend's domain Records tab is present and verified.

Useful references:

- Resend domain DNS records: https://resend.com/docs/dashboard/domains/introduction
- Resend DMARC guidance: https://resend.com/docs/dashboard/domains/dmarc
- Resend webhook signature verification: https://resend.com/docs/webhooks/verify-webhooks-requests
- DMARC record fields: https://dmarc.org/overview/

### Local two-way email runbook

1. Install dependencies and apply migrations:

   ```bash
   npm install --legacy-peer-deps
   npx drizzle-kit migrate
   ```

2. Configure local environment. `scripts/dev-all.sh` loads `.env` first and then `.env.local`.

   Required email variables:

   ```bash
   RESEND_API_KEY=re_...
   EMAIL_FROM="Support <support@mail.yourdomain.com>"
   EMAIL_INBOUND_DOMAIN=mail.yourdomain.com
   RESEND_WEBHOOK_SECRET=whsec_...
   REDIS_URL=redis://localhost:6379
   ALLOW_UNVERIFIED_SENDER_DEV=false
   ```

   Required in production for inbound webhook rate limiting:

   ```bash
   UPSTASH_REDIS_REST_URL=https://...
   UPSTASH_REDIS_REST_TOKEN=...
   ```

3. Start the app and notification worker. For the full local stack:

   ```bash
   npm run dev:all
   ```

   To keep the email path lighter, run Next.js and the notification worker separately:

   ```bash
   npm run dev
   npx tsx lib/queue/workers/notification-worker.ts
   ```

4. Start ngrok:

   ```bash
   ngrok http 3000
   ```

5. In the Resend dashboard, create or update webhooks using the HTTPS forwarding URL from ngrok:

   ```text
   https://<your-ngrok-host>/api/webhooks/resend/inbound
   ```

   Select `email.received`.

   ```text
   https://<your-ngrok-host>/api/webhooks/resend/events
   ```

   Select `email.delivered`, `email.delivery_delayed`, `email.bounced`, and `email.complained`.

   Copy the webhook signing secret into `RESEND_WEBHOOK_SECRET`. The app currently uses one secret for both Resend webhook routes, so configure both local webhook endpoints with the same Resend signing secret or extend the app to support separate secrets before splitting them.

6. In Resend, verify the domain after adding DNS records. Confirm SPF, DKIM, inbound MX, and DMARC all show as present.

7. In the dashboard, create an email-channel ticket for a customer that has a real email address. Send an agent reply from `/dashboard/conversations` and confirm:

   - The agent bubble moves through `Sending...` / `Sent` / `Delivered`.
   - The outbound row in `email_events` stores Resend's email id as `provider_id`.
   - The message metadata contains `email.deliveryStatus`.

8. Reply from the customer's email client to the generated `reply+{conversationId}@EMAIL_INBOUND_DOMAIN` address. Confirm:

   - The inbound route accepts the signed Resend webhook.
   - Quoted reply history is stripped by `email-reply-parser`.
   - HTML is sanitized before conversion/storage.
   - The governance PII masker runs before storing inbound message content.
   - The conversation thread shows the new customer message.

9. Test suppression handling with a Resend bounce or complaint event in a non-production tenant. After the event, future sends to the same customer email should be refused with `Recipient suppressed`, and the conversation UI should mark the email channel as blocked.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs TypeScript (`tsc --noEmit`), ESLint, Next.js build, E2E (Playwright + Postgres + Drizzle migrate), and a production npm audit (non-blocking). Keep **devDependencies** (TypeScript, ESLint, Playwright, etc.) in `package.json` aligned with CI so `npm install --legacy-peer-deps` reproduces the same checks locally. A lockfile is not committed; installs resolve on the server from `package.json`.

## Security

- Never commit **`.env`** or real secrets. Prefer **`.env.local`** (gitignored) and keep **`.env.local.example`** as the canonical placeholder template.
- Rotate any credentials that were ever committed to example files or history.

### Google sign-in (`redirect_uri_mismatch`)

NextAuth uses **`{NEXTAUTH_URL}/api/auth/callback/google`** (not `/auth/...`). In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), add:

- **Authorized JavaScript origins**: `http://localhost:3000` (or your real origin; no path).
- **Authorized redirect URIs**: `http://localhost:3000/api/auth/callback/google` (same scheme/host/port as `NEXTAUTH_URL`).

Match **localhost vs 127.0.0.1** to whatever you use in the browser. Do not put a trailing slash on `NEXTAUTH_URL`.

Google sign-in only works for emails already in the `users` table (admin-provisioned). After `npx drizzle-kit migrate` and `npx tsx lib/db/seed.ts`, seeded accounts include `admin@acme.co` / `agent@acme.co`. Add your Google email with:

```sql
INSERT INTO users (org_id, email, name, role)
SELECT id, 'you@gmail.com', 'Your Name', 'admin'
FROM organizations WHERE slug = 'acme'
ON CONFLICT (email) DO NOTHING;
```

## v0

[Continue working on v0 →](https://v0.app/chat/projects/prj_kRYjsXfTMn91nI78Qq4WYgQ08uZd)

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [v0 Documentation](https://v0.app/docs)

[![Open in Kiro](https://pdgvvgmkdvyeydso.public.blob.vercel-storage.com/open%20in%20kiro.svg?sanitize=true)](https://v0.app/chat/api/kiro/clone/nduy1234/v0-advan)
