"use client"

import { create } from "zustand"
import { temporal } from "zundo"
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  reconnectEdge as xyReconnectEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type XYPosition,
} from "@xyflow/react"
import { nodeRegistry } from "./registry"
import { validatePipelineConnection } from "./connection-validation"
import type { Pipeline } from "./schema"
import "./nodes" // side-effect: populate the registry

function safeRandomUUID(): string {
  if (typeof window !== "undefined" && typeof window.crypto !== "undefined" && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID()
  }
  if (typeof window !== "undefined" && typeof window.crypto !== "undefined" && typeof window.crypto.getRandomValues === "function") {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
      (
        Number(c) ^
        (window.crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))
      ).toString(16)
    )
  }
  // Standard Math.random fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export interface PipelineStore {
  nodes: Node[]
  edges: Edge[]
  selectedId: string | null
  selectedEdgeId: string | null
  dirty: boolean
  lastConnectionError: string | null

  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (conn: Connection) => void
  onReconnect: (edge: Edge, conn: Connection) => void
  reconnectEdgeToNode: (edgeId: string, endpoint: "source" | "target", nodeId: string) => void
  addNode: (type: string, position: XYPosition) => void
  duplicateNode: (id: string) => void
  deleteNode: (id: string) => void
  deleteEdge: (id: string) => void
  updateNodeConfig: (id: string, data: Record<string, unknown>) => void
  select: (id: string | null) => void
  selectEdge: (id: string | null) => void
  loadPipeline: (p: Pipeline, options?: { dirty?: boolean }) => void
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
      selectedEdgeId: null,
      dirty: false,
      lastConnectionError: null,

      // React Flow batches drag deltas into change sets → cheap, position-only updates
      onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes), dirty: true }),
      onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges), dirty: true }),

      onConnect: (conn) => {
        if (!conn.source || !conn.target) return
        let source = conn.source
        let target = conn.target
        let sourceHandle = conn.sourceHandle
        let targetHandle = conn.targetHandle

        const sNode = get().nodes.find((n) => n.id === source)
        const tNode = get().nodes.find((n) => n.id === target)
        if (sNode && tNode && nodeRegistry.has(sNode.type) && nodeRegistry.has(tNode.type)) {
          const sReg = nodeRegistry.get(sNode.type)
          const isSourceInput = sReg.inputs.some((p) => p.id === sourceHandle)
          if (isSourceInput) {
            source = conn.target!
            target = conn.source!
            sourceHandle = conn.targetHandle
            targetHandle = conn.sourceHandle
          }
        }

        const validation = validatePipelineConnection({
          nodes: get().nodes.map((node) => ({ id: node.id, type: node.type ?? "unknown" })),
          edges: get().edges as never,
          source,
          target,
          sourceHandle,
          targetHandle,
        })
        if (!validation.ok) {
          set({ lastConnectionError: validation.reason })
          return
        }
        set({
          edges: addEdge(
            {
              id: safeRandomUUID(),
              source,
              target,
              sourceHandle: sourceHandle ?? null,
              targetHandle: targetHandle ?? null,
            },
            get().edges
          ),
          dirty: true,
          lastConnectionError: null,
        })
      },

      onReconnect: (edge, conn) => {
        if (!conn.source || !conn.target) return
        let source = conn.source
        let target = conn.target
        let sourceHandle = conn.sourceHandle
        let targetHandle = conn.targetHandle

        const sNode = get().nodes.find((n) => n.id === source)
        const tNode = get().nodes.find((n) => n.id === target)
        if (sNode && tNode && nodeRegistry.has(sNode.type) && nodeRegistry.has(tNode.type)) {
          const sReg = nodeRegistry.get(sNode.type)
          const isSourceInput = sReg.inputs.some((p) => p.id === sourceHandle)
          if (isSourceInput) {
            source = conn.target!
            target = conn.source!
            sourceHandle = conn.targetHandle
            targetHandle = conn.sourceHandle
          }
        }

        const remainingEdges = get().edges.filter((item) => item.id !== edge.id)
        const validation = validatePipelineConnection({
          nodes: get().nodes.map((node) => ({ id: node.id, type: node.type ?? "unknown" })),
          edges: remainingEdges as never,
          source,
          target,
          sourceHandle,
          targetHandle,
        })
        if (!validation.ok) {
          set({ lastConnectionError: validation.reason })
          return
        }
        set({
          edges: xyReconnectEdge(
            edge,
            { source, target, sourceHandle, targetHandle },
            get().edges
          ),
          dirty: true,
          selectedEdgeId: edge.id,
          selectedId: null,
          lastConnectionError: null,
        })
      },

      reconnectEdgeToNode: (edgeId, endpoint, nodeId) => {
        const edge = get().edges.find((item) => item.id === edgeId)
        const nextNode = get().nodes.find((item) => item.id === nodeId)
        if (!edge || !nextNode?.type || !nodeRegistry.has(nextNode.type)) return

        const source = endpoint === "source" ? nodeId : edge.source
        const target = endpoint === "target" ? nodeId : edge.target
        const sourceNode = get().nodes.find((item) => item.id === source)
        const targetNode = get().nodes.find((item) => item.id === target)
        if (!sourceNode?.type || !targetNode?.type || !nodeRegistry.has(sourceNode.type) || !nodeRegistry.has(targetNode.type)) return

        const sourcePorts = nodeRegistry.get(sourceNode.type).outputs
        const targetPorts = nodeRegistry.get(targetNode.type).inputs
        const remainingEdges = get().edges.filter((item) => item.id !== edgeId)

        for (const sourcePort of sourcePorts) {
          for (const targetPort of targetPorts) {
            const validation = validatePipelineConnection({
              nodes: get().nodes.map((node) => ({ id: node.id, type: node.type ?? "unknown" })),
              edges: remainingEdges as never,
              source,
              target,
              sourceHandle: sourcePort.id,
              targetHandle: targetPort.id,
            })

            if (!validation.ok) continue

            set({
              edges: get().edges.map((item) =>
                item.id === edgeId
                  ? { ...item, source, target, sourceHandle: sourcePort.id, targetHandle: targetPort.id }
                  : item,
              ),
              dirty: true,
              selectedEdgeId: edgeId,
              selectedId: null,
              lastConnectionError: null,
            })
            return
          }
        }

        set({ lastConnectionError: "No compatible port was found between those two blocks." })
      },

      addNode: (type, position) => {
        const def = nodeRegistry.get(type)
        const node: Node = {
          id: safeRandomUUID(),
          type,
          position,
          data: { ...def.defaults },
        }
        set({ nodes: [...get().nodes, node], dirty: true, selectedId: node.id, selectedEdgeId: null })
      },

      duplicateNode: (id) => {
        const node = get().nodes.find((item) => item.id === id)
        if (!node) return
        const copy: Node = {
          ...node,
          id: safeRandomUUID(),
          position: { x: node.position.x + 36, y: node.position.y + 36 },
          selected: false,
          data: { ...(node.data ?? {}) },
        }
        set({ nodes: [...get().nodes, copy], dirty: true, selectedId: copy.id, selectedEdgeId: null })
      },

      deleteNode: (id) => {
        set({
          nodes: get().nodes.filter((node) => node.id !== id),
          edges: get().edges.filter((edge) => edge.source !== id && edge.target !== id),
          selectedId: get().selectedId === id ? null : get().selectedId,
          selectedEdgeId: null,
          dirty: true,
        })
      },

      deleteEdge: (id) => {
        set({
          edges: get().edges.filter((edge) => edge.id !== id),
          selectedEdgeId: get().selectedEdgeId === id ? null : get().selectedEdgeId,
          dirty: true,
        })
      },

      updateNodeConfig: (id, data) =>
        set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, data } : n)), dirty: true }),

      select: (selectedId) => set({ selectedId, selectedEdgeId: null }),

      selectEdge: (selectedEdgeId) => set({ selectedEdgeId, selectedId: null }),

      loadPipeline: (p, options) =>
        set({
          nodes: p.nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
          edges: p.edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle ?? null,
            targetHandle: e.targetHandle ?? null,
          })),
          dirty: options?.dirty ?? false,
          selectedId: null,
          selectedEdgeId: null,
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
