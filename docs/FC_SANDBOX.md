# FC Sandbox Integration

Minimal, real FC Sandbox (Agent Sandbox / E2B-compatible runtime) integration
layered onto the existing Temporal HITL approval workflow. Nothing in the
existing architecture was rewritten — this is an extension of the HITL
branch in `ticketResolutionWorkflow`, plus a public demo page.

## Architecture

```
                         ┌─────────────────────────────────────────────┐
                         │        ticketResolutionWorkflow (Temporal)   │
                         │  (unchanged: Triage → Knowledge → Compose)   │
                         └───────────────────┬───────────────────────┘
                                              │ confidence < 85 or policy flag
                                              ▼
        ┌───────────────────────────────────────────────────────────────────┐
        │                      FC Sandbox extension (new)                    │
        │                                                                    │
        │  createSandboxSessionActivity ──▶ executeAgentInSandboxActivity     │
        │             │                              │                       │
        │             ▼                              ▼                       │
        │     lib/sandbox/fc-sandbox-client.ts   lib/sandbox/sandbox-store.ts │
        │     (create / execute / hibernate /    (Postgres: sandbox_sessions │
        │      wake / resume, real or simulated)  — session persistence)     │
        │             │                                                      │
        │             ▼                                                      │
        │     hibernateSandboxActivity  ← workflow pauses here                │
        │             │                                                      │
        │       setHandler(hitlDecisionSignal)                               │
        │       await condition(..., "10 minutes")   ◀── human clicks Approve │
        │             │                                on /demo/fc-sandbox   │
        │             ▼ (signal received, approved)                          │
        │     wakeAndResumeSandboxActivity → completeSandboxSessionActivity   │
        └───────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
                         Existing RAG / Model Studio / Tablestore / OSS / FC
                         stack is untouched — the composer's draft is what
                         gets executed inside the sandbox.
```

## Execute → Hibernate → Wake → Resume flow

Implemented in [`lib/temporal/workflows/ticket-resolution.ts`](../lib/temporal/workflows/ticket-resolution.ts),
inside the existing `needsHITL` branch:

1. **Sandbox Created** — `createSandboxSessionActivity` calls
   `createSandbox()` and inserts a `sandbox_sessions` row (state `created`).
2. **Execute** — `executeAgentInSandboxActivity` runs the composed draft
   inside the sandbox session (`executeInSandbox()`), records `computeMsEstimate`.
3. **Hibernate** — `hibernateSandboxActivity` freezes the sandbox
   (`hibernateSandbox()`), row → state `hibernated`, `hibernatedAt` set.
4. **Waiting for Approval** — the workflow's existing
   `condition(() => hitlDecision !== null, "10 minutes")` — unchanged. The
   sandbox stays hibernated for this entire span; Temporal itself durably
   persists the workflow's position (event history), so both the workflow
   and the sandbox session survive a worker restart.
5. **Human Approves** — `/demo/fc-sandbox` (or any HITL client) sends the
   existing `hitl-decision` signal via `signalHITLDecision()`.
6. **Wake → Resume** — `wakeAndResumeSandboxActivity` calls `wakeSandbox()`
   then `resumeSandbox()` **on the same session id** — this is the "resume,
   not recreate" requirement. Computes `waitMs` from
   `wokenAt - hibernatedAt` and derives `computeSavedMsEstimate` from it.
7. **Finish** — `completeSandboxSessionActivity` marks the row `completed`
   (or `escalated` if the 10-minute window lapses / rejected), workflow
   returns its result as before.

Every transition emits one structured JSON log line via
`logSandboxEvent()` (`[FCSandbox] {...}`) containing `traceId`, `sandboxId`,
`sessionId`, `workflowId`, `state`, and the relevant timestamp — and is also
appended to the row's `events` jsonb column for the timeline UI.

## Real vs. simulated sandbox backend

`lib/sandbox/fc-sandbox-client.ts` picks its backend from env, with the same
function signatures either way:

- **Real**: set `FC_SANDBOX_API_BASE` + `FC_SANDBOX_API_KEY` — calls the FC
  Sandbox REST API (`POST /sandboxes`, `/hibernate`, `/wake`, `/resume`,
  `/execute`).
- **Simulated** (default, no credentials needed): runs the agent payload in
  an isolated Node `vm` context with realistic latency per stage, so
  "execute inside the sandbox" is real work, not a stubbed timer. The
  current mode is shown on the demo page (`sandbox mode: real|simulated`).

## Session persistence

`lib/db/schema.ts` → `sandboxSessions` table (migration
[`0021_fc_sandbox_sessions.sql`](../lib/db/migrations/0021_fc_sandbox_sessions.sql)).
One row per HITL pause: sandbox/session/trace ids, current `state`, every
lifecycle timestamp, compute estimates, and the full structured event log.
This is queried independently of Temporal by `/api/demo/fc-sandbox/status`,
so the demo/timeline survives a page reload or server restart.

## Demo page — `/demo/fc-sandbox`

Public, no authentication (outside the `/dashboard` proxy matcher).

- **Start demo ticket** → `POST /api/trigger-workflow` (existing, unmodified
  route) with a fixed org that has no knowledge sources, so the composer's
  confidence defaults to 70 (`< 85` threshold in `mapComposerSuccess`) and
  the workflow deterministically reaches the HITL/sandbox path every run.
- Polls `GET /api/demo/fc-sandbox/status?workflowId=...` every 1.5s —
  combines Temporal's `handle.describe()` status with the persisted
  `sandbox_sessions` row.
- **Approve** → `POST /api/demo/fc-sandbox/approve` — calls the existing
  `signalHITLDecision()` helper, unchanged.
- Renders: timeline ([`components/demo/sandbox-timeline.tsx`](../components/demo/sandbox-timeline.tsx)),
  cost metrics, identifiers (trace/sandbox/session id), and the raw
  structured log feed.

### Cost metrics (simple estimates, by design)

- **Time spent waiting** = `now - hibernatedAt` while hibernated, else
  `wokenAt - hibernatedAt` once resumed.
- **Compute time** = latency measured around `executeInSandbox()`.
- **Compute saved by hibernation** ≈ wait duration, on the premise that a
  non-hibernating sandbox would otherwise be billed for that idle span.

## How to run locally

```bash
# 1. Postgres reachable via DATABASE_URL, then apply the new table:
psql "$DATABASE_URL" -f lib/db/migrations/0021_fc_sandbox_sessions.sql
# (or: npx drizzle-kit generate && npx drizzle-kit migrate, once connected)

# 2. Temporal dev server (separate terminal)
temporal server start-dev

# 3. Temporal worker — registers the new sandbox activities
npx tsx lib/temporal/worker.ts

# 4. Next.js app
npm run dev
```

Open `http://localhost:3000/demo/fc-sandbox`, click **Start demo ticket**,
watch it reach **Hibernate (waiting for approval)**, click **Approve**,
watch **Wake → Resume → Finish**.

No `FC_SANDBOX_API_BASE`/`FC_SANDBOX_API_KEY` needed for the demo — it runs
in simulated mode by default.

## How to deploy

- Next.js app: any Node hosting target for this repo's existing deploy
  pipeline (App Router, standard `next build && next start`).
- Temporal worker: run `lib/temporal/worker.ts` as a long-lived process
  (container/VM) pointed at the same `TEMPORAL_ADDRESS`/`TEMPORAL_NAMESPACE`
  and `DATABASE_URL` as the web app — it's what actually executes the
  sandbox activities.
- Set `FC_SANDBOX_API_BASE` + `FC_SANDBOX_API_KEY` on the worker's
  environment to switch from simulated to the real FC Sandbox API; no code
  change required.
- Apply `lib/db/migrations/0021_fc_sandbox_sessions.sql` against the
  production database before deploying the worker.

## Rubric mapping

| Judging criterion | Implementation |
|---|---|
| **Stateful Sessions** | `SandboxHandle { sandboxId, sessionId, traceId }` created once and threaded through every subsequent activity call; `wakeSandbox`/`resumeSandbox` operate on the same `sandboxId`/`sessionId`, never a new one. Persisted in `sandbox_sessions` (Postgres) independent of process memory. |
| **Hibernation & Wake** | `hibernateSandboxActivity` / `wakeAndResumeSandboxActivity` in `lib/temporal/activities/sandbox-activities.ts`, backed by `hibernateSandbox()`/`wakeSandbox()` in the client. Explicit `hibernatedAt`/`wokenAt` timestamps stored and displayed. |
| **Resume** | `resumeSandbox()` is called with the *same* handle post-wake and returns a result that is threaded into the workflow's final output — not a fresh execution. |
| **Human Approval** | Reuses the existing, unmodified `hitl-decision` Temporal signal + `condition()` wait + `/api/hitl`-style signaling (`signalHITLDecision`) — the sandbox lifecycle is layered around this, not a replacement for it. |
| **Long-running workflow** | `ticketResolutionWorkflow` is a durable Temporal workflow; the hibernate step can wait up to the existing 10-minute `condition()` timeout (configurable) with zero sandbox compute billed during that span. |
| **Observability** | Every transition emits a structured `[FCSandbox] {...}` JSON log line (`traceId`, `sandboxId`, `sessionId`, `workflowId`, `state`, timestamp) via `logSandboxEvent()`, and is persisted to `sandbox_sessions.events`. Rendered live on `/demo/fc-sandbox`. |
| **Reproducible demo** | `/demo/fc-sandbox` needs no auth, no cloud credentials (simulated backend by default), and deterministically reaches the HITL/sandbox path every run — one click to start, one click to approve, under three minutes end to end. |

## What was intentionally not built

Per scope: no new UI beyond the one demo page + timeline component, no
sandbox pooling/warm-pool optimization, no retry/backoff tuning beyond
Temporal's existing defaults, no multi-tenant sandbox quota logic, no load
testing. The existing RAG pipeline, Model Studio, Tablestore, OSS, and
Function Compute integrations are untouched.
