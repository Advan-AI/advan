import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import type { Citation, PolicyCheck } from "./types"

export type CopilotStatus = "idle" | "streaming" | "grounding" | "ready" | "error"
export type DecisionStatus = "none" | "sending" | "accepted" | "rejected"

export interface ConversationCopilotState {
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
}

interface CopilotState {
  // active fields
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

  // persistent map
  activeConversationId: string | null
  byConversation: Record<string, ConversationCopilotState>

  // actions
  setActiveConversationId: (id: string | null) => void
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

const INITIAL: ConversationCopilotState = {
  status: "idle",
  draft: "",
  edited: "",
  confidence: null,
  confidenceStage: null,
  citations: [],
  policyChecks: [],
  hitl: { required: false },
  hallucinationFlags: [],
  suggestionId: null,
  latencyMs: null,
  decision: "none",
  error: null,
}

/**
 * Co-Pilot client store with Multi-Conversation persistence cache mapping.
 *
 * `subscribeWithSelector` + narrow selectors mean a token append re-renders ONLY
 * the streaming text consumer — the confidence ring, citation list, and policy
 * panel each subscribe to their own slice and bail out of unrelated updates.
 */
export const useCopilot = create<CopilotState>()(
  subscribeWithSelector((set) => ({
    ...INITIAL,
    activeConversationId: null,
    byConversation: {},

    setActiveConversationId: (id) =>
      set((s) => {
        const oldId = s.activeConversationId
        const byConversation = { ...s.byConversation }

        // Save current active state to old conversation
        if (oldId) {
          byConversation[oldId] = {
            status: s.status,
            draft: s.draft,
            edited: s.edited,
            confidence: s.confidence,
            confidenceStage: s.confidenceStage,
            citations: s.citations,
            policyChecks: s.policyChecks,
            hitl: s.hitl,
            hallucinationFlags: s.hallucinationFlags,
            suggestionId: s.suggestionId,
            latencyMs: s.latencyMs,
            decision: s.decision,
            error: s.error,
          }
        }

        // Load new active state
        const nextState = id ? byConversation[id] : undefined

        return {
          activeConversationId: id,
          byConversation,
          status: nextState?.status ?? INITIAL.status,
          draft: nextState?.draft ?? INITIAL.draft,
          edited: nextState?.edited ?? INITIAL.edited,
          confidence: nextState?.confidence ?? INITIAL.confidence,
          confidenceStage: nextState?.confidenceStage ?? INITIAL.confidenceStage,
          citations: nextState?.citations ?? INITIAL.citations,
          policyChecks: nextState?.policyChecks ?? INITIAL.policyChecks,
          hitl: nextState?.hitl ?? INITIAL.hitl,
          hallucinationFlags: nextState?.hallucinationFlags ?? INITIAL.hallucinationFlags,
          suggestionId: nextState?.suggestionId ?? INITIAL.suggestionId,
          latencyMs: nextState?.latencyMs ?? INITIAL.latencyMs,
          decision: nextState?.decision ?? INITIAL.decision,
          error: nextState?.error ?? INITIAL.error,
        }
      }),

    reset: () =>
      set((s) => {
        const byConversation = { ...s.byConversation }
        if (s.activeConversationId) {
          byConversation[s.activeConversationId] = { ...INITIAL }
        }
        return {
          ...INITIAL,
          byConversation,
        }
      }),

    appendToken: (t) => set((s) => ({ draft: s.draft + t, status: "streaming" })),
    setScore: (stage, v) =>
      set((s) => ({
        confidence: v,
        confidenceStage: stage,
        status: stage === "final" ? "grounding" : s.status,
      })),
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
