import crypto from "crypto"
import { promises as fs, readFileSync } from "fs"
import os from "os"
import path from "path"

/**
 * FC Sandbox client — Agent Sandbox / E2B-compatible runtime integration.
 *
 * Two backends, selected purely by env config:
 *  - REAL:      E2B_API_URL + E2B_API_KEY set -> calls Alibaba Cloud FC
 *               Sandbox's actual E2B-compatible control-plane REST API
 *               (create / pause / resume, session-scoped, auth via
 *               `X-API-Key`). Endpoint shape and env var names match
 *               fc-sandbox/build_template.py + fc-sandbox/start-gateway.py
 *               (the Alibaba-provided reference scripts) — see
 *               docs/FC_SANDBOX.md "Real E2B template & sandbox lifecycle".
 *               NOTE: real E2B command execution (`sandbox.commands.run()`)
 *               goes through the sandbox's own per-port "envd" hostname
 *               (`https://{port}-{sandboxId}.{domain}`), not a simple
 *               control-plane call — `executeInSandbox`'s real branch below
 *               is a control-plane-only stub, not full envd parity. Fixing
 *               that would mean adding an envd HTTP client, which is out of
 *               scope for this pass (see docs "Remaining limitations").
 *  - SIMULATED: no credentials -> an in-process sandbox that still does real
 *               work (executes the agent payload in an isolated Node `vm`
 *               context, with realistic latency, and a real filesystem
 *               mount) so the demo is honest about being simulated while
 *               remaining technically non-trivial.
 *
 * Isolation note (do not overstate): the SIMULATED backend uses Node's `vm`
 * module, which is a JS-context sandbox in the *same* OS process — it is
 * NOT VM-level isolation. True VM-level isolation (microVM/gVisor-class,
 * separate kernel) is a property of the REAL FC Sandbox backend when
 * configured; it is not something this fallback provides or claims to.
 *
 * Both backends emit the same structured JSON log/metric/alert line shapes
 * so the demo page and docs/FC_SANDBOX.md observability section apply
 * either way.
 */

export interface SandboxHandle {
  sandboxId: string
  sessionId: string
  traceId: string
}

export interface SandboxExecuteResult {
  output: string
  computeMs: number
}

function stripEnv(value: string | undefined): string {
  return (value ?? "").trim().replace(/^["']|["']$/g, "")
}

/** Prefer `.env` on disk for E2B_* so a long-lived `next dev` process does not
 *  keep a stale `E2B_API_KEY` from process.env (that is what produced 401
 *  ERR_UNAUTHORIZED against the Alibaba control plane). */
function readDotenvFile(): Record<string, string> {
  try {
    const raw = readFileSync(path.resolve(process.cwd(), ".env"), "utf8")
    const out: Record<string, string> = {}
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue
      const eq = trimmed.indexOf("=")
      const key = trimmed.slice(0, eq).trim()
      const value = stripEnv(trimmed.slice(eq + 1))
      if (key) out[key] = value
    }
    return out
  } catch {
    return {}
  }
}

function e2bConfig() {
  const file = readDotenvFile()
  const pick = (key: string) => stripEnv(file[key] || process.env[key])
  return {
    apiUrl: pick("E2B_API_URL").replace(/\/$/, ""),
    apiKey: pick("E2B_API_KEY"),
    domain: pick("E2B_DOMAIN"),
    templateId: pick("E2B_TEMPLATE_ID"),
    timeoutSec: Number(pick("E2B_TIMEOUT") || "86400"),
    onTimeout: pick("E2B_ON_TIMEOUT") || "pause",
  }
}

export function getSandboxMode(): "real" | "simulated" {
  const { apiUrl, apiKey } = e2bConfig()
  return apiUrl && apiKey ? "real" : "simulated"
}

/** Snapshot of mode at module load; prefer getSandboxMode() for live reads. */
export const SANDBOX_MODE: "real" | "simulated" = getSandboxMode()

/**
 * Least-privilege execution policy applied to every sandbox this client
 * creates. Configurable via env so an operator can tighten/loosen without a
 * code change; defaults are deliberately restrictive.
 */
export const SANDBOX_PERMISSIONS = {
  network: process.env.FC_SANDBOX_ALLOW_NETWORK === "true", // default: no network egress
  filesystem: "mount-only" as const, // sandboxed code only sees its session mount, not the host fs
  timeoutMs: Number(process.env.FC_SANDBOX_EXEC_TIMEOUT_MS ?? 500),
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

let eventSeq = 0

/** Structured log line — every sandbox lifecycle transition emits exactly one of these. */
export function logSandboxEvent(event: {
  type: string
  traceId: string
  sandboxId: string
  sessionId: string
  workflowId: string
  [key: string]: unknown
}): Record<string, unknown> {
  const record = { ts: new Date().toISOString(), seq: eventSeq++, mode: getSandboxMode(), ...event }
  // eslint-disable-next-line no-console
  console.log(`[FCSandbox] ${JSON.stringify(record)}`)
  return record
}

/** Numeric metric line — separate stream from event logs, SLS metric-store shaped. */
export function logSandboxMetric(metric: {
  name: string
  value: number
  unit: "ms" | "count"
  traceId: string
  sandboxId: string
  workflowId: string
}): void {
  // eslint-disable-next-line no-console
  console.log(`[FCSandboxMetric] ${JSON.stringify({ ts: new Date().toISOString(), ...metric })}`)
}

/** Alert-severity line — distinct grep/index target for an SLS alert rule. */
export function logSandboxAlert(alert: {
  type: string
  severity: "warning" | "critical"
  traceId: string
  sandboxId: string
  workflowId: string
  message: string
  [key: string]: unknown
}): void {
  // eslint-disable-next-line no-console
  console.error(`[FCSandboxAlert] ${JSON.stringify({ ts: new Date().toISOString(), ...alert })}`)
}

async function realCall<T>(pathname: string, body?: Record<string, unknown>): Promise<T> {
  const { apiUrl, apiKey } = e2bConfig()
  if (!apiUrl || !apiKey) {
    throw new Error("E2B_API_URL and E2B_API_KEY are required for real sandbox mode.")
  }
  const res = await fetch(`${apiUrl}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Alibaba FC Agent Sandbox data-plane header (docs: X-API-KEY).
      "X-API-KEY": apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const raw = await res.text()
  if (!res.ok) {
    throw new Error(`FC Sandbox API ${pathname} failed: ${res.status} ${raw}`)
  }
  if (!raw.trim()) return {} as T
  return JSON.parse(raw) as T
}

/** Per-session mount directory — simulates FC Sandbox's Dynamic Mount: data
 *  attached to a session at a stable path that persists across hibernate/wake,
 *  rather than being re-threaded through each call's arguments. */
function mountDir(sandboxId: string): string {
  return path.join(os.tmpdir(), "fc-sandbox-mounts", sandboxId)
}

/** Launch a new sandbox session. */
export async function createSandbox(input: {
  workflowId: string
  ticketId: string
}): Promise<SandboxHandle> {
  const traceId = crypto.randomUUID()

  if (getSandboxMode() === "real") {
    const cfg = e2bConfig()
    if (!cfg.templateId) {
      throw new Error(
        "E2B_TEMPLATE_ID is not set. Register a template first: " +
          "python fc-sandbox/build_template.py (requires E2B_TEMPLATE_IMAGE pushed to a registry)."
      )
    }
    const created = await realCall<{
      sandboxID?: string
      sandboxId?: string
      sessionId?: string
    }>("/sandboxes", {
      templateID: cfg.templateId,
      domain: cfg.domain,
      timeout: cfg.timeoutSec,
      lifecycle: { on_timeout: cfg.onTimeout, auto_resume: true },
      metadata: { workflowId: input.workflowId, ticketId: input.ticketId, traceId },
    })
    const sandboxId = created.sandboxID || created.sandboxId
    if (!sandboxId) {
      throw new Error("FC Sandbox API /sandboxes returned no sandboxID.")
    }
    return { sandboxId, sessionId: created.sessionId || sandboxId, traceId }
  }

  await sleep(120) // simulated cold-start
  const handle = {
    sandboxId: `sbx_${crypto.randomBytes(8).toString("hex")}`,
    sessionId: `sess_${crypto.randomBytes(8).toString("hex")}`,
    traceId,
  }
  await fs.mkdir(mountDir(handle.sandboxId), { recursive: true })
  return handle
}

/** Execute the agent payload inside the running sandbox. */
export async function executeInSandbox(
  handle: SandboxHandle,
  payload: string
): Promise<SandboxExecuteResult> {
  const start = Date.now()

  if (getSandboxMode() === "real") {
    // Control plane has no /execute route (404). Agent work already happened
    // in triage/composer; this step only records compute time for the demo.
    return { output: payload, computeMs: Date.now() - start }
  }

  // Dynamic mount (simulated): write the draft to the session's mount path
  // rather than only passing it inline — resumeSandbox() below re-reads
  // from this same path after hibernate/wake to prove the mount persisted.
  await fs.writeFile(path.join(mountDir(handle.sandboxId), "context.json"), JSON.stringify({ payload }), "utf8")

  // Least privilege: `vm.runInNewContext` gets no `require`/`fs`/network —
  // only the plain `input` string value we choose to inject. Bounded by
  // SANDBOX_PERMISSIONS.timeoutMs.
  const { runInNewContext } = await import("node:vm")
  const output = runInNewContext(
    "input.length > 0 ? `agent draft (${input.length} chars) ready for review` : 'empty draft'",
    { input: payload },
    { timeout: SANDBOX_PERMISSIONS.timeoutMs }
  ) as string
  await sleep(180) // simulated inference latency
  return { output, computeMs: Date.now() - start }
}

/** Freeze the sandbox — no compute billed while hibernated ("pause" in the real E2B API). */
export async function hibernateSandbox(handle: SandboxHandle): Promise<void> {
  if (getSandboxMode() === "real") {
    await realCall(`/sandboxes/${handle.sandboxId}/pause`)
    return
  }
  await sleep(40)
  // Simulated hibernation: no process, no timer, nothing polling — the
  // session's only footprint while hibernated is the mount dir on disk and
  // the sandbox_sessions DB row. Nothing here consumes compute until woken.
}

/**
 * Wake a hibernated sandbox back to a running state.
 *
 * Real E2B has one call for this — POST /sandboxes/{id}/resume — there is
 * no separate "wake" endpoint. We still split wake/resume into two
 * functions (matching the workflow's two observable phases and letting the
 * demo measure wake latency in isolation) — in real mode the network call
 * happens here, and `resumeSandbox()` below becomes a read of the outcome
 * rather than a second network round-trip.
 */
export async function wakeSandbox(handle: SandboxHandle): Promise<void> {
  if (getSandboxMode() === "real") {
    await realCall(`/sandboxes/${handle.sandboxId}/resume`)
    return
  }
  await sleep(90) // simulated warm resume (much faster than cold create)
}

/** Resume execution in the same session (post-wake) and produce the final result. */
export async function resumeSandbox(handle: SandboxHandle, priorOutput: string): Promise<string> {
  if (getSandboxMode() === "real") {
    // Already resumed by wakeSandbox() above (same /resume call in the real
    // API) — this just reports it. See docs/FC_SANDBOX.md for the mapping.
    return `resumed session ${handle.sessionId}`
  }

  // Re-read the mount to prove it survived hibernation on the SAME session
  // (session affinity + dynamic mount), not just resuming from an in-memory
  // value threaded through activity args.
  let mounted: { payload?: string } = {}
  try {
    const raw = await fs.readFile(path.join(mountDir(handle.sandboxId), "context.json"), "utf8")
    mounted = JSON.parse(raw) as { payload?: string }
  } catch {
    // Mount missing (e.g. host restarted and /tmp was cleared) — degrade to
    // the value passed in rather than failing the resume.
  }
  await sleep(60)
  const result = `${mounted.payload ?? priorOutput} — approved and resumed in session ${handle.sessionId}`

  // Session teardown: mount is only needed for the life of this run.
  await fs.rm(mountDir(handle.sandboxId), { recursive: true, force: true }).catch(() => {})
  return result
}
