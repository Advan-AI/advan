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
   npm ci
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

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs TypeScript (`tsc --noEmit`), ESLint, Next.js build, E2E (Playwright + Postgres + Drizzle migrate), and a production npm audit (non-blocking). Keep **devDependencies** (TypeScript, ESLint, Playwright, etc.) in `package.json` aligned with CI so `npm ci` reproduces the same checks locally.

## Security

- Never commit **`.env`** or real secrets. Prefer **`.env.local`** (gitignored) and keep **`.env.local.example`** as the canonical placeholder template.
- Rotate any credentials that were ever committed to example files or history.

### Google sign-in (`redirect_uri_mismatch`)

NextAuth uses **`{NEXTAUTH_URL}/api/auth/callback/google`** (not `/auth/...`). In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), add:

- **Authorized JavaScript origins**: `http://localhost:3000` (or your real origin; no path).
- **Authorized redirect URIs**: `http://localhost:3000/api/auth/callback/google` (same scheme/host/port as `NEXTAUTH_URL`).

Match **localhost vs 127.0.0.1** to whatever you use in the browser. Do not put a trailing slash on `NEXTAUTH_URL`.

## v0

[Continue working on v0 →](https://v0.app/chat/projects/prj_kRYjsXfTMn91nI78Qq4WYgQ08uZd)

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [v0 Documentation](https://v0.app/docs)

[![Open in Kiro](https://pdgvvgmkdvyeydso.public.blob.vercel-storage.com/open%20in%20kiro.svg?sanitize=true)](https://v0.app/chat/api/kiro/clone/nduy1234/v0-advan)
