#!/usr/bin/env tsx
/**
 * Widget endpoint load test.
 *
 * Tests the two public-facing chat endpoints under a burst of concurrent
 * connections to confirm rate limiting and the socket server remain stable.
 *
 * Usage:
 *   npx tsx scripts/load-test-widget.ts [options]
 *
 * Options (environment variables):
 *   LOAD_TEST_URL         Base URL  (default: http://localhost:3000)
 *   LOAD_TEST_WIDGET_KEY  widgetKey (default: wk_test_local)
 *   LOAD_TEST_CONCURRENCY Number of concurrent requests (default: 100)
 *   LOAD_TEST_SOCKET      "1" to also test socket connections (default: 0)
 *
 * Prerequisites:
 *   - Dev server running: npm run dev:all
 *   - Widget config seeded:
 *     INSERT INTO widget_configs (id, org_id, widget_key, allowed_origins, pre_chat_form_enabled)
 *     SELECT gen_random_uuid(), id, 'wk_test_local', '["http://localhost:3000"]'::jsonb, true
 *     FROM organizations LIMIT 1;
 *
 * Expected results:
 *   - Most session requests succeed (200) within the rate window.
 *   - Some requests may return 429 (rate limited) — this is correct behaviour.
 *   - No 5xx errors under normal load.
 *   - P99 latency should be under a few hundred milliseconds on localhost.
 */

const BASE_URL      = process.env.LOAD_TEST_URL         ?? "http://localhost:3000"
const WIDGET_KEY    = process.env.LOAD_TEST_WIDGET_KEY  ?? "wk_test_local"
const CONCURRENCY   = parseInt(process.env.LOAD_TEST_CONCURRENCY ?? "100", 10)
const TEST_SOCKETS  = process.env.LOAD_TEST_SOCKET === "1"
const ORIGIN        = BASE_URL // widget is served from the same origin in dev

// ─── Session burst ─────────────────────────────────────────────────────────────

interface SessionResult {
  status: number
  ok: boolean
  latencyMs: number
  token?: string
  visitorSessionId?: string
  error?: string
}

async function fetchSession(index: number): Promise<SessionResult> {
  const t0 = Date.now()
  try {
    const res = await fetch(`${BASE_URL}/api/chat/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ widgetKey: WIDGET_KEY, origin: ORIGIN }),
    })
    const latencyMs = Date.now() - t0
    if (res.ok) {
      const { token, visitorSessionId } = await res.json() as { token: string; visitorSessionId: string }
      return { status: res.status, ok: true, latencyMs, token, visitorSessionId }
    }
    return { status: res.status, ok: false, latencyMs, error: await res.text() }
  } catch (err) {
    return { status: 0, ok: false, latencyMs: Date.now() - t0, error: String(err) }
  }
}

// ─── Availability burst ────────────────────────────────────────────────────────

interface AvailabilityResult {
  status: number
  ok: boolean
  latencyMs: number
}

async function fetchAvailability(): Promise<AvailabilityResult> {
  const t0 = Date.now()
  try {
    const res = await fetch(`${BASE_URL}/api/chat/availability?widgetKey=${encodeURIComponent(WIDGET_KEY)}`)
    return { status: res.status, ok: res.ok, latencyMs: Date.now() - t0 }
  } catch {
    return { status: 0, ok: false, latencyMs: Date.now() - t0 }
  }
}

// ─── Socket connection test ────────────────────────────────────────────────────

async function testSocketConnection(token: string, conversationId?: string): Promise<{ connected: boolean; latencyMs: number }> {
  // Dynamic import so the script still works in environments without socket.io-client
  // (availability check is the primary test; sockets are opt-in via LOAD_TEST_SOCKET=1)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { connect } = require("socket.io-client") as typeof import("socket.io-client")
    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? `${BASE_URL.replace("3000", "3002")}`
    const t0 = Date.now()
    return await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        sock.disconnect()
        resolve({ connected: false, latencyMs: Date.now() - t0 })
      }, 5000)

      const sock = connect(`${SOCKET_URL}/chat-widget`, {
        auth: { token, conversationId },
        transports: ["polling"],
        reconnection: false,
        forceNew: true,
        extraHeaders: { origin: ORIGIN },
      } as Record<string, unknown>)
      sock.on("connect", () => {
        clearTimeout(timeout)
        sock.disconnect()
        resolve({ connected: true, latencyMs: Date.now() - t0 })
      })
      sock.on("connect_error", () => {
        clearTimeout(timeout)
        sock.disconnect()
        resolve({ connected: false, latencyMs: Date.now() - t0 })
      })
    })
  } catch {
    return { connected: false, latencyMs: 0 }
  }
}

// ─── Stats helper ──────────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n╔═══════════════════════════════════════════════════════════╗`)
  console.log(`║            Advan Widget Load Test                        ║`)
  console.log(`╚═══════════════════════════════════════════════════════════╝`)
  console.log(`  URL:         ${BASE_URL}`)
  console.log(`  widget key:  ${WIDGET_KEY}`)
  console.log(`  concurrency: ${CONCURRENCY}`)
  console.log(`  sockets:     ${TEST_SOCKETS ? "yes" : "no (set LOAD_TEST_SOCKET=1 to enable)"}`)
  console.log()

  // ── Phase 1: Availability burst ──────────────────────────────────────────
  console.log(`[1/3] Hitting GET /api/chat/availability × ${CONCURRENCY} concurrent…`)
  const availStart = Date.now()
  const availResults = await Promise.all(
    Array.from({ length: CONCURRENCY }, () => fetchAvailability())
  )
  const availElapsed = Date.now() - availStart

  const availOk    = availResults.filter((r) => r.ok).length
  const availRl    = availResults.filter((r) => r.status === 429).length
  const availErr   = availResults.filter((r) => !r.ok && r.status !== 429).length
  const availLat   = availResults.map((r) => r.latencyMs).sort((a, b) => a - b)

  console.log(`    ✓ ${availOk} ok  ⚡ ${availRl} rate-limited  ✗ ${availErr} errors  (${availElapsed}ms wall)`)
  console.log(`    Latency — p50: ${formatMs(percentile(availLat, 50))}  p95: ${formatMs(percentile(availLat, 95))}  p99: ${formatMs(percentile(availLat, 99))}  max: ${formatMs(availLat[availLat.length - 1])}`)
  console.log()

  // ── Phase 2: Session burst ───────────────────────────────────────────────
  console.log(`[2/3] Hitting POST /api/chat/session × ${CONCURRENCY} concurrent…`)
  const sessStart = Date.now()
  const sessResults = await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, i) => fetchSession(i))
  )
  const sessElapsed = Date.now() - sessStart

  const sessOk  = sessResults.filter((r) => r.ok).length
  const sessRl  = sessResults.filter((r) => r.status === 429).length
  const sessErr = sessResults.filter((r) => !r.ok && r.status !== 429).length
  const sessLat = sessResults.map((r) => r.latencyMs).sort((a, b) => a - b)

  console.log(`    ✓ ${sessOk} ok  ⚡ ${sessRl} rate-limited  ✗ ${sessErr} errors  (${sessElapsed}ms wall)`)
  console.log(`    Latency — p50: ${formatMs(percentile(sessLat, 50))}  p95: ${formatMs(percentile(sessLat, 95))}  p99: ${formatMs(percentile(sessLat, 99))}  max: ${formatMs(sessLat[sessLat.length - 1])}`)

  if (sessErr > 0) {
    const sample = sessResults.find((r) => !r.ok && r.status !== 429)
    console.log(`    Sample error (status ${sample?.status}): ${sample?.error?.slice(0, 200)}`)
  }
  console.log()

  // ── Phase 3: Socket burst (opt-in) ───────────────────────────────────────
  if (TEST_SOCKETS) {
    const tokens = sessResults.filter((r) => r.ok && r.token).map((r) => r.token!)
    const socketCount = Math.min(tokens.length, 50) // cap at 50 to avoid overwhelming local server
    console.log(`[3/3] Opening ${socketCount} /chat-widget socket connections concurrently…`)
    const sockStart = Date.now()
    const sockResults = await Promise.all(
      tokens.slice(0, socketCount).map((token) => testSocketConnection(token))
    )
    const sockElapsed = Date.now() - sockStart

    const sockOk  = sockResults.filter((r) => r.connected).length
    const sockErr = sockResults.filter((r) => !r.connected).length
    const sockLat = sockResults.filter((r) => r.latencyMs > 0).map((r) => r.latencyMs).sort((a, b) => a - b)

    console.log(`    ✓ ${sockOk} connected  ✗ ${sockErr} failed  (${sockElapsed}ms wall)`)
    if (sockLat.length > 0) {
      console.log(`    Latency — p50: ${formatMs(percentile(sockLat, 50))}  p95: ${formatMs(percentile(sockLat, 95))}  max: ${formatMs(sockLat[sockLat.length - 1])}`)
    }
  } else {
    console.log(`[3/3] Socket test skipped (set LOAD_TEST_SOCKET=1 to enable)`)
  }

  console.log()

  // ── Summary ──────────────────────────────────────────────────────────────
  const hasFailure = sessErr > 0 || availErr > 0
  if (hasFailure) {
    console.log(`⚠  One or more requests returned unexpected errors (not 429).`)
    console.log(`   Check the server logs and ensure:`)
    console.log(`   - widget_configs row exists with widgetKey="${WIDGET_KEY}" and origin "${ORIGIN}"`)
    console.log(`   - AUTH_SECRET / NEXTAUTH_SECRET is set in the server environment`)
    process.exit(1)
  } else {
    console.log(`✅ Load test passed.`)
    console.log(`   All errors were 429 (rate limit) — expected behaviour under burst.`)
    console.log(`   No 5xx errors observed.`)
  }
}

main().catch((err) => {
  console.error("Load test crashed:", err)
  process.exit(1)
})
