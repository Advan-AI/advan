"use client"

import { useEffect, useMemo, useState } from "react"
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
  type XYPosition,
} from "@xyflow/react"
import { GitBranch } from "lucide-react"
import { usePipelineStore } from "@/lib/pipeline/use-pipeline-store"

const NODE_WIDTH = 168
const NODE_HEIGHT = 58

export function ReconnectableEdge(props: EdgeProps) {
  const {
    id,
    selected,
    source,
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    markerEnd,
    markerStart,
    style,
    interactionWidth,
  } = props
  const { screenToFlowPosition } = useReactFlow()
  const nodes = usePipelineStore((s) => s.nodes)
  const reconnectEdgeToNode = usePipelineStore((s) => s.reconnectEdgeToNode)
  const [dragPoint, setDragPoint] = useState<XYPosition | null>(null)

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX: dragPoint ? dragPoint.x : targetX,
    targetY: dragPoint ? dragPoint.y : targetY,
    targetPosition,
  })

  const dropTargets = useMemo(() => nodes.filter((node) => node.id !== source), [nodes, source])

  useEffect(() => {
    if (!dragPoint) return

    function onPointerMove(event: PointerEvent) {
      setDragPoint(screenToFlowPosition({ x: event.clientX, y: event.clientY }))
    }

    function onPointerUp(event: PointerEvent) {
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const targetNodeId = findDropTarget(point, dropTargets)
      setDragPoint(null)
      if (targetNodeId) reconnectEdgeToNode(id, "target", targetNodeId)
    }

    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp, { once: true })
    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
    }
  }, [dragPoint, dropTargets, id, reconnectEdgeToNode, screenToFlowPosition])

  function startWireDrag(event: React.PointerEvent) {
    if (!selected) return
    event.preventDefault()
    event.stopPropagation()
    setDragPoint(screenToFlowPosition({ x: event.clientX, y: event.clientY }))
  }

  const handlePoint = dragPoint ?? { x: labelX, y: labelY }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={style}
        interactionWidth={interactionWidth}
      />
      {selected && (
        <>
          <path
            d={edgePath}
            fill="none"
            stroke="transparent"
            strokeWidth={30}
            className="nodrag nopan"
            style={{ cursor: dragPoint ? "grabbing" : "grab", pointerEvents: "stroke" }}
            onPointerDown={startWireDrag}
          />
          <EdgeLabelRenderer>
            <button
              type="button"
              aria-label="Reconnect wire"
              onPointerDown={startWireDrag}
              className="nodrag nopan absolute flex h-7 w-7 items-center justify-center rounded-full border border-[#171A17]/15 bg-white text-[var(--dash-accent)] shadow-[0_8px_20px_-12px_rgba(0,0,0,0.45)] transition hover:scale-105"
              style={{
                transform: `translate(-50%, -50%) translate(${handlePoint.x}px, ${handlePoint.y}px)`,
                pointerEvents: "all",
                cursor: dragPoint ? "grabbing" : "grab",
              }}
            >
              <GitBranch className="h-3.5 w-3.5" />
            </button>
          </EdgeLabelRenderer>
        </>
      )}
    </>
  )
}

function findDropTarget(point: XYPosition, nodes: { id: string; position: XYPosition; measured?: { width?: number; height?: number } }[]) {
  let nearest: { id: string; distance: number } | null = null

  for (const node of nodes) {
    const width = node.measured?.width ?? NODE_WIDTH
    const height = node.measured?.height ?? NODE_HEIGHT
    const center = { x: node.position.x + width / 2, y: node.position.y + height / 2 }
    const inside =
      point.x >= node.position.x &&
      point.x <= node.position.x + width &&
      point.y >= node.position.y &&
      point.y <= node.position.y + height

    if (inside) return node.id

    const distance = Math.hypot(point.x - center.x, point.y - center.y)
    if (!nearest || distance < nearest.distance) nearest = { id: node.id, distance }
  }

  return nearest && nearest.distance <= 140 ? nearest.id : null
}
