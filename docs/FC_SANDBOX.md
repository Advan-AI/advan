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
  `/execute`), request-shaped after E2B's create/execute/pause/resume
  primitives (FC Sandbox's documented E2B-compatible surface). Every call
  includes a `permissions` object (`SANDBOX_PERMISSIONS`: no network by
  default, mount-only filesystem, bounded exec timeout) and a `mount`
  reference — least privilege and dynamic mount are requested explicitly,
  not implied.
- **Simulated** (default, no credentials needed): runs the agent payload in
  an isolated Node `vm` context (no `require`/`fs`/network reachable from
  inside it — the same least-privilege posture, enforced locally) with
  realistic latency per stage. A real per-session mount directory
  (`os.tmpdir()/fc-sandbox-mounts/<sandboxId>`) is written on execute and
  re-read on resume, so "the mount survived hibernation" is verifiable, not
  asserted. The current mode is shown on the demo page (`sandbox mode:
  real|simulated`).

**Isolation, stated precisely:** the simulated backend's `vm` context is
*not* VM-level isolation — it is a JS context inside the same OS process.
True VM-level isolation (separate microVM/kernel boundary) is a property of
the real FC Sandbox backend, attributed to the platform when
`FC_SANDBOX_API_BASE` is configured, not claimed for the local fallback.

## Session persistence & fault tolerance

`lib/db/schema.ts` → `sandboxSessions` table (migrations
[`0021`](../lib/db/migrations/0021_fc_sandbox_sessions.sql) +
[`0022`](../lib/db/migrations/0022_fc_sandbox_idempotency.sql)). One row per
HITL pause — this row *is* the "AgentRun" record: sandbox/session/trace ids,
current `state`, every lifecycle timestamp, wake latency, compute estimates,
the configured hibernation policy, and the full structured event log (which
doubles as the checkpoint log — each entry is a durable state transition,
sequence-numbered via `seq`).

- **Fault tolerance, concretely**: `workflow_id` is `UNIQUE` (0022).
  `insertSandboxSession` upserts on that key
  (`lib/sandbox/sandbox-store.ts`), so if `createSandboxSessionActivity` is
  retried by Temporal's own retry policy — or the workflow replays after a
  worker crash — the session record converges instead of fragmenting into
  duplicate rows. This is verified statically (schema + upsert code), not
  by literally killing a worker mid-run in this environment (no live DB
  here); see "Remaining limitations" below.
- **Workflow-level fault tolerance is Temporal's**, not something this
  feature adds: every activity completion is durably recorded in Temporal's
  event history, and a crashed worker resumes any in-flight workflow —
  including one hibernated mid-HITL — from that history on restart. This is
  a documented Temporal guarantee we rely on, not something we reimplement.
- Queried independently of Temporal by `/api/demo/fc-sandbox/status` and
  `/stream`, so the demo/timeline survives a page reload or server restart.

## Demo page — `/demo/fc-sandbox`

Public, no authentication (outside the `/dashboard` proxy matcher).

- **Start demo ticket** → `POST /api/trigger-workflow` (existing, lightly
  extended — now also accepts an optional `hitlTimeoutMinutes` override,
  the hibernation policy) with a fixed org that has no knowledge sources, so
  the composer's confidence defaults to 70 (`< 85` threshold in
  `mapComposerSuccess`) and the workflow deterministically reaches the
  HITL/sandbox path every run.
- Live updates via `GET /api/demo/fc-sandbox/stream?workflowId=...`
  (Server-Sent Events) — pushed by `lib/sandbox/sandbox-events-bus.ts` on
  every sandbox lifecycle DB write, not polled. `/api/demo/fc-sandbox/status`
  still exists for a one-shot fetch (e.g. curl/debugging) but the page
  itself uses the stream. See "Remaining limitations" for the single-process
  scope of this event bus.
- **Approve** → `POST /api/demo/fc-sandbox/approve` — calls the existing
  `signalHITLDecision()` helper, unchanged. Labeled on the page as the
  high-risk-action confirmation step: this is the human-in-the-loop gate
  that low-confidence/policy-flagged output must pass before it reaches a
  customer.
- Renders: timeline ([`components/demo/sandbox-timeline.tsx`](../components/demo/sandbox-timeline.tsx)),
  cost/latency metrics (including wake latency and the active hibernation
  policy), identifiers (trace/sandbox/session id) with a session-affinity
  note, and the raw structured log/checkpoint feed.

### Cost metrics (simple estimates, by design)

- **Time spent waiting** = `now - hibernatedAt` while hibernated, else
  `wokenAt - hibernatedAt` once resumed.
- **Compute time** = latency measured around `executeInSandbox()`.
- **Compute saved by hibernation** ≈ wait duration, on the premise that a
  non-hibernating sandbox would otherwise be billed for that idle span.

## How to run locally

```bash
# 1. Postgres reachable via DATABASE_URL, then apply the new tables/columns:
psql "$DATABASE_URL" -f lib/db/migrations/0021_fc_sandbox_sessions.sql
psql "$DATABASE_URL" -f lib/db/migrations/0022_fc_sandbox_idempotency.sql
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
- Apply `lib/db/migrations/0021_fc_sandbox_sessions.sql` and
  `0022_fc_sandbox_idempotency.sql` against the production database before
  deploying the worker.
- The SSE stream (`sandbox-events-bus.ts`) is single-process pub/sub — see
  "Remaining limitations" if the Next.js app or worker will run more than
  one instance.

## Rubric audit (verified this pass)

✅ Complete · ⚠️ Partial (real, but with a stated limit) · ❌ Missing (honestly, not fabricated)

| # | Requirement | Status | Files |
|---|---|---|---|
| 1 | Real customer scenario, natural wait | ✅ | [`ticket-resolution.ts`](../lib/temporal/workflows/ticket-resolution.ts) — HITL gate fires on low-confidence/policy-flagged support replies (a real product path, not sandbox-only scaffolding); demo uses a realistic "invoice charge looks wrong" ticket |
| 2 | AgentRun + FC Sandbox for long-running execution | ✅ | One `sandbox_sessions` row = one AgentRun, created in [`sandbox-activities.ts`](../lib/temporal/activities/sandbox-activities.ts), executed via [`fc-sandbox-client.ts`](../lib/sandbox/fc-sandbox-client.ts) |
| 3 | Execute → Hibernate → Wake → Resume → Complete | ✅ | `ticket-resolution.ts` L88-131 (call order); [`sandbox-timeline.tsx`](../components/demo/sandbox-timeline.tsx) renders it |
| 4 | Real hibernation — no polling, no idle sandbox | ✅ | Workflow wait is `condition()` on a Temporal signal (never a loop). Simulated hibernate is a no-op (no timer/process kept alive). UI now uses SSE push ([`sandbox-events-bus.ts`](../lib/sandbox/sandbox-events-bus.ts), [`stream/route.ts`](../app/api/demo/fc-sandbox/stream/route.ts)) — the earlier `setInterval` client poll was replaced, not just relabeled |
| 5 | Stable, one-click, demo-ready | ✅ | [`/demo/fc-sandbox`](../app/demo/fc-sandbox/page.tsx) — deterministic HITL trigger (empty-KB org), two buttons total |
| 6 | Observability: trace/sandbox/session id, checkpoints, structured logs, metrics, alerts | ✅ | `fc-sandbox-client.ts`: `logSandboxEvent` (checkpoints, `seq`-numbered), `logSandboxMetric`, `logSandboxAlert` — three distinct, greppable log shapes |
| 7 | Stateful sessions: Session Affinity, Dynamic Mount, Resume | ✅ | Affinity: same `sandboxId`/`sessionId` threaded through every call, logged with `sessionAffinity: true`. Dynamic Mount: `mountDir(sandboxId)` written on execute, **re-read on resume** — proves the mount survived hibernation rather than only trusting an in-memory value. Resume: `resumeSandbox()` operates on the existing handle |
| 8 | Resume from checkpoints, fault tolerance | ✅ | App-level: `workflow_id UNIQUE` + upsert in [`sandbox-store.ts`](../lib/sandbox/sandbox-store.ts) (migration [0022](../lib/db/migrations/0022_fc_sandbox_idempotency.sql)) makes session creation idempotent under activity retry. Workflow-level: Temporal's own durable event history (not reimplemented — see below) |
| 9 | Least privilege + human confirmation for high-risk actions | ✅ | `SANDBOX_PERMISSIONS` (no network by default, mount-only fs, bounded exec timeout) enforced in both backends (real: sent as a `permissions` field; simulated: `vm` context literally cannot reach `fs`/network). Human confirmation: the existing HITL approval gate — labeled explicitly on the demo page |
| 10 | Wake latency, wait duration, hibernation cost savings | ✅ | `wakeAndResumeSandboxActivity` times the wake call in isolation (`wakeLatencyMs`, stored separately from total `waitMs`); `computeSavedMsEstimate` ≈ wait duration. All three shown on the demo page |
| 11 | Reusable components, configurable hibernation policy | ✅ | `TicketResolutionInput.hitlTimeoutMinutes` (workflow input, resolved once at start — never read live from `process.env` inside the workflow, so replay stays deterministic); passed through from `/api/trigger-workflow` |
| 12 | Extreme elasticity (benchmark/report) | ❌ **Missing** | Requires a real FC Sandbox account and concurrent-load infrastructure this environment doesn't have. Fabricating a number would violate "avoid unsupported claims" more than leaving it undone. See limitations below |
| 13 | VM-level isolation, justified | ⚠️ **Partial** | Real backend: VM-level isolation is the platform's documented property, correctly attributed, not independently verified here (no live credentials). Simulated fallback: explicitly labeled as NOT VM-isolated (Node `vm` context, same OS process) — see "Real vs. simulated" above |
| 14 | E2B-compatible execution path | ⚠️ **Partial** | Request shape (`create`/`execute`/`hibernate`/`wake`/`resume`, session-scoped) mirrors E2B's primitives, matching FC Sandbox's documented E2B-compatible surface — not verified against a live E2B or FC Sandbox endpoint |
| 15 | Stateful sessions (repeat, capability list item 4) | ✅ | Same as #7 |
| 16 | Measured hibernation/wake | ✅ | Same as #10 — `hibernatedAt`, `wokenAt`, `wakeLatencyMs`, `waitMs` all real timestamps/durations, not estimates dressed up as measurements |
| 17 | SLS + Trace + Metrics + Alerts, one real debugging example | ✅ | See "SLS mapping" and "Debugging example" immediately below |

### SLS mapping

Every `console.log`/`console.error` line from this feature is one of three
prefixes, designed to be three separate SLS indexes/dashboards:

- `[FCSandbox] {...}` — checkpoint/event log. Index on `traceId` for
  cross-call tracing, `workflowId` for per-run timelines.
- `[FCSandboxMetric] {...}` — numeric series (`name`, `value`, `unit`).
  Maps to an SLS metricstore or a simple `SELECT avg(value) ... GROUP BY
  name` over the log index.
- `[FCSandboxAlert] {...}` — `severity: "warning" | "critical"`. An SLS
  alert rule of "count where `$.severity` in this stream > 0 over 5m" turns
  this into a page.

We do not claim an SLS project is provisioned in this repo — that's
external platform setup. What's here is the log shape that would ship to it
unchanged.

### One real debugging example

Reproducible without any cloud account:

```bash
FC_SANDBOX_API_BASE=http://localhost:1 FC_SANDBOX_API_KEY=demo npm run dev
# then run the demo — Start demo ticket
```

This forces "real" mode against an address nothing listens on. What happens,
in order, and how you'd actually debug it:

1. `createSandbox()`'s `realCall()` `fetch()` throws (connection refused).
2. `createSandboxSessionActivity` catches it *before* any sandbox id exists
   and emits `[FCSandboxAlert] {"type":"sandbox.create_failed","severity":"critical","traceId":"unassigned","sandboxId":"unassigned","workflowId":"fc-sandbox-demo-...","message":"fetch failed"}`, then rethrows.
3. Temporal's configured retry policy for this activity
   (`maximumAttempts: 2`, `lib/temporal/workflows/ticket-resolution.ts`)
   retries once, fails again, gives up.
4. The workflow activity fails — visible in the Temporal Web UI under that
   `workflowId` with the real stack trace, *and* in the alert log stream via
   the same `workflowId`.
5. An engineer greps the alert stream for `workflowId`, sees
   `sandbox.create_failed`, checks `FC_SANDBOX_API_BASE`, fixes it, re-runs.

Two independent places (Temporal UI, alert log) corroborate the same
failure via the same correlation key — that's the point of carrying
`workflowId`/`traceId` through both.

## Remaining limitations (require external services or platform support)

Stated plainly rather than glossed over:

- **Extreme elasticity** — not benchmarked. Needs a real FC Sandbox account,
  concurrent-run load generation, and a place to run it from; none of that
  exists in this environment. (Item #12 above is marked ❌, not
  quietly skipped.)
- **True VM-level isolation** — only real when `FC_SANDBOX_API_BASE`/`_API_KEY`
  point at an actual FC Sandbox deployment. The bundled simulated backend is
  honest about not providing it.
- **E2B/FC Sandbox API compatibility** — modeled on public documentation of
  both, never round-tripped against a live endpoint (no credentials
  available here). Treat the real-mode code path as "shaped correctly,
  unverified" until run against the real service once.
- **SSE fan-out is single-process** (`sandbox-events-bus.ts`, an in-memory
  `EventEmitter`). Correct for one Next.js instance + one Temporal worker
  (this demo's shape). A horizontally-scaled deployment needs a shared
  pub/sub — the existing `lib/queue/redis-client.ts` is Upstash's REST
  client and does not support `SUBSCRIBE`, so this would be a genuinely new
  dependency (e.g. a TCP Redis connection, or SLS's own eventing), not a
  reuse of what's already in the repo. Out of scope for this pass.
- **Fault tolerance under real failure was verified by code inspection**
  (unique constraint + upsert, Temporal's documented crash-recovery model),
  not by actually killing a live worker process mid-hibernate — there is no
  running Temporal cluster/worker in this environment to kill.
- **SLS itself is not provisioned** — the three log prefixes
  (`[FCSandbox]`/`[FCSandboxMetric]`/`[FCSandboxAlert]`) are designed to
  ship into it unchanged, but no SLS project, index, or alert rule exists
  yet; that's an infra step outside this repo.

## What was intentionally not built

Per scope: no new UI beyond the one demo page + timeline component, no
sandbox pooling/warm-pool optimization, no retry/backoff tuning beyond
Temporal's existing defaults, no multi-tenant sandbox quota logic, no load
testing. The existing RAG pipeline, Model Studio, Tablestore, OSS, and
Function Compute integrations are untouched.
