"use client"

import { useCallback, useMemo, useRef } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type IsValidConnection,
  type NodeTypes,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { usePipelineStore } from "@/lib/pipeline/use-pipeline-store"
import { usePipelineExecution } from "@/lib/pipeline/execution-store"
import { nodeRegistry } from "@/lib/pipeline/registry"
import { validatePipelineConnection } from "@/lib/pipeline/connection-validation"
import { PipelineNodeView } from "./pipeline-node"

const NODE_DRAG_MIME = "application/advan-node-type"

export function PipelineCanvas() {
  const wrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()

  const nodes = usePipelineStore((s) => s.nodes)
  const baseEdges = usePipelineStore((s) => s.edges)
  const nodeStatuses = usePipelineExecution((s) => s.nodeStatuses)

  const edges = useMemo(
    () =>
      baseEdges.map((e) => {
        const src = nodeStatuses[e.source]
        const tgt = nodeStatuses[e.target]
        const flowing = src === "running" || tgt === "running"
        const done = src === "completed" && tgt !== "failed"
        const failed = src === "failed" || tgt === "failed"

        return {
          ...e,
          animated: flowing,
          style: {
            stroke: flowing ? "#6B5CD6" : failed ? "var(--dash-rose)" : done ? "var(--dash-sage)" : "#B6A98C",
            strokeWidth: flowing ? 2.5 : 2,
          },
        }
      }),
    [baseEdges, nodeStatuses]
  )
  const onNodesChange = usePipelineStore((s) => s.onNodesChange)
  const onEdgesChange = usePipelineStore((s) => s.onEdgesChange)
  const onConnect = usePipelineStore((s) => s.onConnect)
  const addNode = usePipelineStore((s) => s.addNode)
  const select = usePipelineStore((s) => s.select)

  // Every registered type renders via the single registry-driven view (Open-Closed).
  const nodeTypes = useMemo<NodeTypes>(
    () => Object.fromEntries(nodeRegistry.all().map((d) => [d.type, PipelineNodeView])),
    []
  )

  const isValidConnection = useCallback<IsValidConnection>(
    (c) =>
      validatePipelineConnection({
        nodes: nodes.map((node) => ({ id: node.id, type: node.type ?? "unknown" })),
        edges: baseEdges as never,
        source: c.source,
        target: c.target,
        sourceHandle: c.sourceHandle,
        targetHandle: c.targetHandle,
      }).ok,
    [baseEdges, nodes]
  )

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const type = event.dataTransfer.getData(NODE_DRAG_MIME)
      if (!type || !nodeRegistry.has(type)) return
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      addNode(type, position)
    },
    [screenToFlowPosition, addNode]
  )

  return (
    <div ref={wrapper} className="relative h-full w-full" onDrop={onDrop} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodeClick={(_, n) => select(n.id)}
        onPaneClick={() => select(null)}
        onlyRenderVisibleElements
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ style: { stroke: "#6B5CD6", strokeWidth: 2 } }}
      >
        <Background color="#d9d2c2" gap={20} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable className="!bg-white/70" />
      </ReactFlow>
    </div>
  )
}
