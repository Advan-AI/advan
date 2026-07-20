"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import * as SocketIO from "socket.io-client"
import { usePipelineExecution, type PipelineStepEvent } from "./execution-store"

const getSocketUrl = () => {
  const envUrl = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SOCKET_URL : null;
  if (envUrl && !envUrl.includes("localhost:3002") && !envUrl.includes("127.0.0.1:3002")) {
    return envUrl;
  }
  if (typeof window === "undefined") return "http://localhost:3002";
  const isLocal = window.location.hostname === "localhost" ||
                  window.location.hostname === "127.0.0.1" ||
                  window.location.hostname === "0.0.0.0";
  return isLocal
    ? `${window.location.protocol}//${window.location.hostname}:3002`
    : `${window.location.protocol}//${window.location.hostname}`;
};

const SOCKET_URL = getSocketUrl();

/**
 * Subscribes to org-scoped pipeline execution events from the Socket.IO server
 * (relayed via Redis pub/sub from the Temporal worker) and feeds them into the
 * execution overlay store.
 */
export function usePipelineRealtime() {
  const { data: session } = useSession()
  const orgId = session?.user?.orgId

  useEffect(() => {
    if (!orgId) return

    let socket: ReturnType<typeof SocketIO.connect> | null = null
    try {
      socket = SocketIO.connect(SOCKET_URL, {
        auth: { orgId },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 8,
      })
    } catch {
      return
    }

    const applyStep = usePipelineExecution.getState().applyStep
    const finishRun = usePipelineExecution.getState().finishRun

    socket.on("pipeline:step", (raw: PipelineStepEvent) => {
      if (!raw?.temporalWorkflowId || !raw?.nodeId) return
      applyStep(raw)
    })

    socket.on("pipeline:run:finished", (raw: { temporalWorkflowId?: string; status?: string }) => {
      if (!raw?.temporalWorkflowId) return
      const status = raw.status === "completed" ? "completed" : "failed"
      finishRun(raw.temporalWorkflowId, status)
    })

    return () => {
      socket?.disconnect()
    }
  }, [orgId])
}
