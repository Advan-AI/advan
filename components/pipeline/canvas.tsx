"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import {
  ReactFlow,
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  useReactFlow,
  type EdgeTypes,
  type IsValidConnection,
  type NodeTypes,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { usePipelineStore } from "@/lib/pipeline/use-pipeline-store"
import { usePipelineExecution } from "@/lib/pipeline/execution-store"
import { nodeRegistry } from "@/lib/pipeline/registry"
import { validatePipelineConnection } from "@/lib/pipeline/connection-validation"
import { PipelineNodeView } from "./pipeline-node"
import { ReconnectableEdge } from "./reconnectable-edge"

const NODE_DRAG_MIME = "application/advan-node-type"

export function PipelineCanvas() {
  const wrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, setCenter } = useReactFlow()

  const nodes = usePipelineStore((s) => s.nodes)
  const baseEdges = usePipelineStore((s) => s.edges)
  const selectedEdgeId = usePipelineStore((s) => s.selectedEdgeId)
  const nodeStatuses = usePipelineExecution((s) => s.nodeStatuses)

  // Auto-focus & Center viewport on running nodes to naturally guide the user visually as the pipeline executes
  useEffect(() => {
    const runningNodeIds = Object.keys(nodeStatuses).filter((id) => nodeStatuses[id] === "running")
    if (runningNodeIds.length > 0) {
      let totalX = 0
      let totalY = 0
      let count = 0

      for (const id of runningNodeIds) {
        const node = nodes.find((n) => n.id === id)
        if (node && node.position) {
          totalX += node.position.x + 84
          totalY += node.position.y + 32
          count++
        }
      }

      if (count > 0) {
        setCenter(totalX / count, totalY / count, {
          zoom: runningNodeIds.length > 1 ? 0.95 : 1.1,
          duration: 800,
        })
      }
    }
  }, [nodeStatuses, nodes, setCenter])

  const edges = useMemo(
    () =>
      baseEdges.map((e) => {
        const src = nodeStatuses[e.source]
        const tgt = nodeStatuses[e.target]
        const flowing = src === "running" || tgt === "running"
        const done = src === "completed" && tgt !== "failed"
        const failed = src === "failed" || tgt === "failed"
        const selected = e.id === selectedEdgeId

        return {
          ...e,
          type: "reconnectable",
          selected,
          reconnectable: true,
          focusable: true,
          interactionWidth: selected ? 24 : 18,
          animated: flowing,
          style: {
            stroke: selected ? "#171A17" : flowing ? "#6B5CD6" : failed ? "var(--dash-rose)" : done ? "var(--dash-sage)" : "#B6A98C",
            strokeWidth: selected ? 3 : flowing ? 2.5 : 2,
          },
        }
      }),
    [baseEdges, nodeStatuses, selectedEdgeId]
  )
  const onNodesChange = usePipelineStore((s) => s.onNodesChange)
  const onEdgesChange = usePipelineStore((s) => s.onEdgesChange)
  const onConnect = usePipelineStore((s) => s.onConnect)
  const onReconnect = usePipelineStore((s) => s.onReconnect)
  const addNode = usePipelineStore((s) => s.addNode)
  const select = usePipelineStore((s) => s.select)
  const selectEdge = usePipelineStore((s) => s.selectEdge)
  const reconnectEdgeToNode = usePipelineStore((s) => s.reconnectEdgeToNode)

  const edgeReconnectSuccessful = useRef(true)

  const onReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false
  }, [])

  const handleReconnect = useCallback((oldEdge: any, newConnection: any) => {
    edgeReconnectSuccessful.current = true
    onReconnect(oldEdge, newConnection)
  }, [onReconnect])

  const onReconnectEnd = useCallback((_: any, edge: any) => {
    if (!edgeReconnectSuccessful.current) {
      usePipelineStore.getState().deleteEdge(edge.id)
    }
    edgeReconnectSuccessful.current = true
  }, [])

  // Every registered type renders via the single registry-driven view (Open-Closed).
  const nodeTypes = useMemo<NodeTypes>(
    () => Object.fromEntries(nodeRegistry.all().map((d) => [d.type, PipelineNodeView])),
    []
  )
  const edgeTypes = useMemo<EdgeTypes>(() => ({ reconnectable: ReconnectableEdge }), [])

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
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={handleReconnect}
        onReconnectStart={onReconnectStart}
        onReconnectEnd={onReconnectEnd}
        edgesReconnectable
        reconnectRadius={18}
        isValidConnection={isValidConnection}
        onNodeClick={(_, n) => {
          select(n.id)
        }}
        onEdgeClick={(_, edge) => selectEdge(edge.id)}
        onPaneClick={() => select(null)}
        connectionMode={ConnectionMode.Loose}
        nodesConnectable
        edgesFocusable
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
