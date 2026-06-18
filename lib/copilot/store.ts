import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import type { Citation, PolicyCheck } from "./types"

export type CopilotStatus = "idle" | "streaming" | "grounding" | "ready" | "error"
export type DecisionStatus = "none" | "sending" | "accepted" | "rejected"

interface CopilotState {
  status: CopilotStatus
  draft: string
  edited: string
  confidence: number | null
  confidenceStage: "retrieval" | "final" | null
  citations: Citation[]
  policyChecks: PolicyCheck[]
  hitl: { required: boolean; reason?: string; hitlId?: string }
  hallucinationFlags: string[]
  suggestionId: string | null
  latencyMs: number | null
  decision: DecisionStatus
  error: string | null

  // actions
  reset: () => void
  appendToken: (t: string) => void
  setScore: (stage: "retrieval" | "final", v: number) => void
  addCitation: (c: Citation) => void
  setPolicy: (checks: PolicyCheck[]) => void
  setHitl: (h: { required: boolean; reason?: string; hitlId?: string }) => void
  finalize: (p: { suggestionId: string; latencyMs: number; finalText: string }) => void
  setStatus: (s: CopilotStatus) => void
  setError: (m: string) => void
  setEdited: (s: string) => void
  setDecision: (d: DecisionStatus) => void
}

const INITIAL = {
  status: "idle" as CopilotStatus,
  draft: "",
  edited: "",
  confidence: null,
  confidenceStage: null,
  citations: [] as Citation[],
  policyChecks: [] as PolicyCheck[],
  hitl: { required: false },
  hallucinationFlags: [] as string[],
  suggestionId: null,
  latencyMs: null,
  decision: "none" as DecisionStatus,
  error: null,
}

/**
 * Co-Pilot client store.
 *
 * `subscribeWithSelector` + narrow selectors mean a token append re-renders ONLY
 * the streaming text consumer — the confidence ring, citation list, and policy
 * panel each subscribe to their own slice and bail out of unrelated updates.
 */
export const useCopilot = create<CopilotState>()(
  subscribeWithSelector((set) => ({
    ...INITIAL,

    reset: () => set({ ...INITIAL }),
    appendToken: (t) => set((s) => ({ draft: s.draft + t, status: "streaming" })),
    setScore: (stage, v) =>
      set({ confidence: v, confidenceStage: stage, status: stage === "final" ? "grounding" : undefined }),
    addCitation: (c) => set((s) => ({ citations: [...s.citations, c] })),
    setPolicy: (checks) => set({ policyChecks: checks }),
    setHitl: (h) => set({ hitl: h }),
    finalize: ({ suggestionId, latencyMs, finalText }) =>
      set((s) => ({
        suggestionId,
        latencyMs,
        status: "ready",
        // adopt the grounded final text as the editable draft (fixes stale-closure bug)
        edited: s.edited && s.edited !== s.draft ? s.edited : finalText,
        draft: finalText,
      })),
    setStatus: (status) => set({ status }),
    setError: (error) => set({ error, status: "error" }),
    setEdited: (edited) => set({ edited }),
    setDecision: (decision) => set({ decision }),
  }))
)
