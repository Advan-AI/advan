"use client"

import { useCallback, useEffect, useRef } from "react"
import { fetchEventSource } from "@microsoft/fetch-event-source"
import { useCopilot } from "./store"
import type { SuggestionEvent } from "./types"

/**
 * Drives the Co-Pilot SSE stream into the Zustand store.
 *
 * Performance: high-frequency `token` events are buffered and flushed once per
 * animation frame, capping store writes (and therefore re-renders) at ~60fps
 * regardless of token throughput. All other events apply immediately.
 */
export function useCopilotStream() {
  const ctrl = useRef<AbortController | null>(null)
  const tokenBuffer = useRef("")
  const rafId = useRef<number | null>(null)

  const flush = useCallback(() => {
    rafId.current = null
    if (!tokenBuffer.current) return
    useCopilot.getState().appendToken(tokenBuffer.current)
    tokenBuffer.current = ""
  }, [])

  const scheduleFlush = useCallback(() => {
    if (rafId.current == null) rafId.current = requestAnimationFrame(flush)
  }, [flush])

  const stop = useCallback(() => {
    ctrl.current?.abort()
    ctrl.current = null
    if (rafId.current != null) cancelAnimationFrame(rafId.current)
    rafId.current = null
    tokenBuffer.current = ""
  }, [])

  const start = useCallback(
    (input: string, opts?: { ticketId?: string; threshold?: number }) => {
      const store = useCopilot.getState()
      if (!input.trim()) return
      store.reset()
      store.setStatus("streaming")
      stop()

      const ac = new AbortController()
      ctrl.current = ac
      let lastId = -1

      void fetchEventSource("/api/copilot/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Last-Event-ID": String(lastId) },
        body: JSON.stringify({ input, ticketId: opts?.ticketId, threshold: opts?.threshold }),
        signal: ac.signal,
        openWhenHidden: true,
        onmessage(ev) {
          if (ev.id) lastId = Number(ev.id)
          if (!ev.data) return
          const e = JSON.parse(ev.data) as SuggestionEvent
          const s = useCopilot.getState()
          switch (e.type) {
            case "token":
              tokenBuffer.current += e.text
              scheduleFlush()
              break
            case "score":
              flush()
              s.setScore(e.stage, e.value)
              break
            case "citation":
              s.addCitation(e.citation)
              break
            case "policy":
              s.setPolicy(e.checks)
              break
            case "hitl":
              s.setHitl({ required: e.required, reason: e.reason, hitlId: e.hitlId })
              break
            case "done":
              flush()
              s.finalize({ suggestionId: e.suggestionId, latencyMs: e.latencyMs, finalText: e.finalText })
              ac.abort() // stream complete — prevent auto-reconnect/regeneration
              break
            case "error":
              s.setError(e.message)
              ac.abort()
              break
          }
        },
        onclose() {
          // Server closed the stream. Returning normally would trigger a retry
          // (and re-run generation), so throw to terminate the connection.
          throw new Error("stream closed")
        },
        onerror(err) {
          // Surface fatal errors; throwing stops fetch-event-source from retrying.
          if (!ac.signal.aborted) {
            useCopilot.getState().setError(err instanceof Error ? err.message : "Stream interrupted")
          }
          throw err
        },
      }).catch(() => {
        /* aborts and fatal errors already reflected in store */
      })
    },
    [flush, scheduleFlush, stop]
  )

  useEffect(() => stop, [stop])

  return { start, stop }
}
