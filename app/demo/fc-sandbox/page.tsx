"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Loader2, PlayCircle, ShieldCheck, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SandboxTimeline, type SandboxSessionView } from "@/components/demo/sandbox-timeline"

/**
 * Public demo: /demo/fc-sandbox
 *
 * Starts a real ticketResolutionWorkflow run on the existing Temporal +
 * HITL infrastructure, deliberately with no knowledge sources so the
 * composer's confidence defaults below the HITL threshold (see
 * mapComposerSuccess in agent-activities.ts) — this guarantees the workflow
 * always reaches the FC Sandbox hibernate/wake path for the demo.
 *
 * No auth: this route is outside the /dashboard proxy matcher.
 */

interface StatusResponse {
  workflowId: string
  workflowStatus: string
  sandboxMode: "real" | "simulated"
  result: { output: string; confidence: number; approved?: boolean } | null
  sandbox: SandboxSessionView | null
}

const DEMO_ORG_ID = "demo-org-fc-sandbox"
const DEMO_INPUT = "My last invoice total looks higher than expected — can someone check the charge?"
const POLL_MS = 1500

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export default function FcSandboxDemoPage() {
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [starting, setStarting] = useState(false)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nowTick, setNowTick] = useState(Date.now())
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Live clock for the "time spent waiting" metric while hibernated.
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 500)
    return () => clearInterval(t)
  }, [])

  const poll = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/demo/fc-sandbox/status?workflowId=${encodeURIComponent(id)}`)
      const data = (await res.json()) as StatusResponse
      if (!res.ok) throw new Error((data as unknown as { error?: string }).error ?? "Status fetch failed")
      setStatus(data)
      if (data.workflowStatus === "COMPLETED" || data.workflowStatus === "FAILED") {
        if (pollRef.current) clearInterval(pollRef.current)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch status")
    }
  }, [])

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  async function handleStart() {
    setStarting(true)
    setError(null)
    setStatus(null)
    try {
      const res = await fetch("/api/trigger-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: DEMO_ORG_ID,
          ticketId: `demo-${Date.now()}`,
          customerInput: DEMO_INPUT,
          workflowId: `fc-sandbox-demo-${Date.now()}`,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to start workflow")
      setWorkflowId(data.workflowId)
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(() => void poll(data.workflowId), POLL_MS)
      void poll(data.workflowId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start workflow")
    } finally {
      setStarting(false)
    }
  }

  async function handleApprove() {
    if (!workflowId) return
    setApproving(true)
    setError(null)
    try {
      const res = await fetch("/api/demo/fc-sandbox/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId, approved: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to approve")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve")
    } finally {
      setApproving(false)
    }
  }

  const sandbox = status?.sandbox ?? null
  const canApprove = sandbox?.state === "hibernated"
  const isDone = status?.workflowStatus === "COMPLETED"

  // Cost metrics — simple estimates, computed client-side.
  const waitMs =
    sandbox?.hibernatedAt && !sandbox.wokenAt
      ? nowTick - new Date(sandbox.hibernatedAt).getTime()
      : sandbox?.computeSavedMsEstimate ?? 0
  const computeMsEstimate = sandbox?.computeMsEstimate ?? 0
  const computeSavedMsEstimate = sandbox?.wokenAt ? sandbox.computeSavedMsEstimate : waitMs

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:py-14">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <Link href="/" className="text-xs font-medium text-foreground/50 hover:text-foreground">
            ← Advan
          </Link>
          {status && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/[0.05] text-foreground/50">
              sandbox mode: {status.sandboxMode}
            </span>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground mt-4">
          FC Sandbox — Hibernate &amp; Resume Demo
        </h1>
        <p className="mt-2 text-sm text-foreground/60 leading-relaxed max-w-xl">
          Starts a real Temporal <code className="font-mono text-xs">ticketResolutionWorkflow</code>{" "}
          run. When it reaches the human-approval gate, an FC Sandbox session is created, the agent
          executes inside it, then it hibernates while waiting for you to click Approve below.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={handleStart} disabled={starting || (!!workflowId && !isDone)} className="rounded-full">
            {starting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <PlayCircle className="w-4 h-4 mr-1.5" />}
            Start demo ticket
          </Button>
          <Button
            onClick={handleApprove}
            disabled={!canApprove || approving}
            variant="outline"
            className="rounded-full border-[#5C9A70]/40 text-[#2f5d3f] hover:bg-[#E3EFE5]"
          >
            {approving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <ShieldCheck className="w-4 h-4 mr-1.5" />}
            Approve
          </Button>
          {workflowId && (
            <span className="text-[11px] font-mono text-foreground/40 truncate">wf: {workflowId}</span>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs">
            {error}
          </div>
        )}

        {status && (
          <div className="mt-8 grid gap-5 sm:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-black/[0.08] bg-white/60 p-6">
              <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground/40 mb-4">
                Timeline
              </div>
              <SandboxTimeline sandbox={sandbox} workflowStatus={status.workflowStatus} />
            </div>

            <div className="space-y-5">
              <div className="rounded-2xl border border-black/[0.08] bg-white/60 p-5">
                <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground/40 mb-3">
                  Cost metrics (estimated)
                </div>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-foreground/60">Time spent waiting</dt>
                    <dd className="font-mono font-semibold text-foreground">{formatMs(waitMs)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-foreground/60">Compute time (execute)</dt>
                    <dd className="font-mono font-semibold text-foreground">{formatMs(computeMsEstimate)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-foreground/60">Compute saved by hibernation</dt>
                    <dd className="font-mono font-semibold text-[#2f5d3f]">
                      {formatMs(computeSavedMsEstimate)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-[11px] text-foreground/40 leading-relaxed">
                  Estimate: no sandbox compute is billed while hibernated, so compute saved ≈ wait
                  duration.
                </p>
              </div>

              {sandbox && (
                <div className="rounded-2xl border border-black/[0.08] bg-white/60 p-5">
                  <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground/40 mb-3">
                    Identifiers
                  </div>
                  <dl className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between gap-2">
                      <dt className="text-foreground/45">trace_id</dt>
                      <dd className="truncate text-foreground/80">{sandbox.traceId}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-foreground/45">sandbox_id</dt>
                      <dd className="truncate text-foreground/80">{sandbox.sandboxId}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-foreground/45">session_id</dt>
                      <dd className="truncate text-foreground/80">{sandbox.sessionId}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          </div>
        )}

        {status?.result && isDone && (
          <div className="mt-6 rounded-2xl border border-[#5C9A70]/30 bg-[#E3EFE5]/50 p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#2f5d3f] mb-2">
              Workflow completed
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">{status.result.output}</p>
          </div>
        )}

        {sandbox && sandbox.events.length > 0 && (
          <div className="mt-6 rounded-2xl border border-black/[0.08] bg-[#171a17] p-5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-white/50 mb-3">
              <Terminal className="w-3.5 h-3.5" />
              Structured logs
            </div>
            <pre className="text-[11px] font-mono text-[#a6e3a1] leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
              {sandbox.events.map((e) => JSON.stringify(e)).join("\n")}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
