import React, { useMemo } from 'react';
import { ReactFlow, Background, Controls, Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AgentNode } from './agent-node';
import { AgentDef, AgentState, Edge } from './types';

interface PipelineCanvasProps {
  agents: AgentDef[];
  states: Record<string, AgentState>;
  edges: Edge[];
}

const nodeTypes = {
  agent: AgentNode,
};

export function PipelineCanvas({ agents, states, edges }: PipelineCanvasProps) {
  // Translate AgentDefs to React Flow nodes
  const nodes: FlowNode[] = useMemo(() => 
    agents.map((a) => ({
      id: a.id,
      type: 'agent',
      position: { x: a.x, y: a.y },
      data: { agent: a, state: states[a.id] || 'idle' },
    })), [agents, states]
  );

  // Translate Edges to React Flow edges
  const flowEdges: FlowEdge[] = useMemo(() => 
    edges.map((e, index) => ({
      id: `e-${e.from}-${e.to}-${index}`,
      source: e.from,
      target: e.to,
      animated: states[e.from] === 'processing' || states[e.from] === 'thinking',
      style: { stroke: '#6B5CD6', strokeWidth: 2 },
    })), [edges, states]
  );

  return (
    <div className="h-[440px] w-full">
      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#f1f1f1" gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
