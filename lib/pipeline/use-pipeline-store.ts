"use client"

import { create } from "zustand"
import { temporal } from "zundo"
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type XYPosition,
} from "@xyflow/react"
import { nodeRegistry } from "./registry"
import { wouldCreateCycle } from "./topology"
import type { Pipeline } from "./schema"
import "./nodes" // side-effect: populate the registry

export interface PipelineStore {
  nodes: Node[]
  edges: Edge[]
  selectedId: string | null
  dirty: boolean
  lastConnectionError: string | null

  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (conn: Connection) => void
  addNode: (type: string, position: XYPosition) => void
  updateNodeConfig: (id: string, data: Record<string, unknown>) => void
  select: (id: string | null) => void
  loadPipeline: (p: Pipeline) => void
  toPipeline: () => Pipeline
  clearError: () => void
  markSaved: () => void
}

export const usePipelineStore = create<PipelineStore>()(
  temporal(
    (set, get) => ({
      nodes: [],
      edges: [],
      selectedId: null,
      dirty: false,
      lastConnectionError: null,

      // React Flow batches drag deltas into change sets → cheap, position-only updates
      onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes), dirty: true }),
      onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges), dirty: true }),

      onConnect: (conn) => {
        if (!conn.source || !conn.target) return
        if (wouldCreateCycle(get().edges as { source: string; target: string }[], conn.source, conn.target)) {
          set({ lastConnectionError: "That connection would create a cycle — pipelines must be acyclic." })
          return
        }
        set({ edges: addEdge({ ...conn, id: crypto.randomUUID() }, get().edges), dirty: true, lastConnectionError: null })
      },

      addNode: (type, position) => {
        const def = nodeRegistry.get(type)
        const node: Node = {
          id: crypto.randomUUID(),
          type,
          position,
          data: { ...def.defaults },
        }
        set({ nodes: [...get().nodes, node], dirty: true, selectedId: node.id })
      },

      updateNodeConfig: (id, data) =>
        set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, data } : n)), dirty: true }),

      select: (selectedId) => set({ selectedId }),

      loadPipeline: (p) =>
        set({
          nodes: p.nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
          edges: p.edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle ?? null,
            targetHandle: e.targetHandle ?? null,
          })),
          dirty: false,
          selectedId: null,
        }),

      toPipeline: () => ({
        schemaVersion: 1,
        nodes: get().nodes.map((n) => ({
          id: n.id,
          type: n.type ?? "unknown",
          position: n.position,
          data: (n.data ?? {}) as Record<string, unknown>,
        })),
        edges: get().edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle ?? null,
          targetHandle: e.targetHandle ?? null,
        })),
      }),

      clearError: () => set({ lastConnectionError: null }),

      markSaved: () => set({ dirty: false }),
    }),
    {
      limit: 50,
      // Track only the graph for undo/redo — not selection or transient errors.
      partialize: (s) => ({ nodes: s.nodes, edges: s.edges }),
    }
  )
)
