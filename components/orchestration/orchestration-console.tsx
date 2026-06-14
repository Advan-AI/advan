"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Workflow } from 'lucide-react';
import { AgentDef, AgentState, Edge, LogEvent } from './types';
import { AgentFleet } from './agent-fleet';
import { PipelineCanvas } from './pipeline-canvas';
import { ExecutionTrace } from './execution-trace';
import { KPIBanner } from './kpi-banner';
import { ControlBar } from './control-bar';

interface Stage {
  states: Partial<Record<string, AgentState>>;
  edges: Edge[];
  log: { who: string; message: string; tone: "info" | "ok" | "warn" | "err" };
  banner?: string;
}

interface OrchestrationConsoleProps {
  agents: AgentDef[];
  stages: Stage[];
  initialStats: { handled: number; p95: number; success: number };
}

export function OrchestrationConsole({ agents, stages, initialStats }: OrchestrationConsoleProps) {
  const [stage, setStage] = useState(0);
  const [running, setRunning] = useState(true);
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [stats, setStats] = useState(initialStats);

  const STAGE_DURATION = 2600;
  const currentStage = stages[stage];

  // Advance stage logic
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setStage((s) => (s + 1) % stages.length);
    }, STAGE_DURATION);
    return () => clearInterval(interval);
  }, [running, stages.length]);

  // Log events telemetry
  useEffect(() => {
    const cur = stages[stage];
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    setEvents((prev) => [
      { ts, who: cur.log.who as any, message: cur.log.message, tone: cur.log.tone },
      ...prev
    ].slice(0, 15));

    if (stage === stages.length - 1) {
      setStats(s => ({
        handled: s.handled + 1,
        p95: +(3.5 + Math.random() * 0.3).toFixed(2),
        success: +(98.2 + Math.random() * 0.8).toFixed(1)
      }));
    }
  }, [stage, stages]);

  const toggleAgent = useCallback((id: string) => {
    setExpandedAgentId(prev => prev === id ? null : id);
  }, []);

  return (
    <div className="w-full">
      <ControlBar 
        stage={stage} 
        totalStages={stages.length} 
        running={running} 
        banner={currentStage.banner || ""} 
        onSetStage={(i) => { setStage(i); setRunning(false); }}
        onToggleRunning={() => setRunning(!running)}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl border border-black/[0.08] bg-white/70 backdrop-blur-2xl overflow-hidden shadow-2xl"
      >
        {/* Console Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-black/[0.06] bg-white/40">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-[#BE6A6A]" />
            <div className="w-3 h-3 rounded-full bg-[#C5883C]" />
            <div className="w-3 h-3 rounded-full bg-[#5C9A70]" />
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-foreground/50 tracking-wider">
            <Workflow className="w-3.5 h-3.5" />
            advan / orchestrator / engine-v2-production
          </div>
          <div className="ml-auto">
             <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-[#E3EFE5] text-[#2f5d3f] px-2.5 py-1 rounded-full ring-1 ring-[#5C9A70]/30 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5C9A70] animate-pulse" />
                SYSTEM LIVE
             </span>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] bg-black/[0.02]">
          <AgentFleet 
            agents={agents} 
            states={currentStage.states as Record<string, AgentState>} 
            expandedId={expandedAgentId} 
            onToggle={toggleAgent} 
          />

          <div className="relative min-h-[440px] bg-white/20">
            <PipelineCanvas 
              agents={agents} 
              states={currentStage.states as Record<string, AgentState>} 
              edges={currentStage.edges} 
            />
          </div>

          <div className="flex flex-col border-l border-black/[0.06]">
            <KPIBanner stats={stats} />
            <div className="flex-1 overflow-hidden">
               <ExecutionTrace events={events} agents={agents} />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
