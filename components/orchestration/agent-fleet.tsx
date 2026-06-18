import React from 'react';
import { motion } from 'framer-motion';
import { Layers, CheckCircle2, ShieldCheck, Activity } from 'lucide-react';
import { AgentDef, AgentState, Tone } from './types';

const TONE_CLASSES: Record<Tone, { fg: string; bg: string }> = {
  violet: { fg: "#4E3FB6", bg: "#ECE9FB" },
  blue:   { fg: "#244e8a", bg: "#E1E9F3" },
  amber:  { fg: "#8a5a1e", bg: "#F4E8D3" },
  rose:   { fg: "#8a3e3e", bg: "#F1DFDE" },
  sage:   { fg: "#2f5d3f", bg: "#E3EFE5" },
  slate:  { fg: "#2A2520", bg: "#EDE7DA" },
};

interface AgentFleetProps {
  agents: AgentDef[];
  states: Record<string, AgentState>;
  expandedId: string | null;
  onToggle: (id: string) => void;
}

export function AgentFleet({ agents, states, expandedId, onToggle }: AgentFleetProps) {
  return (
    <div className="bg-white/55 px-4 py-4 h-full border-r border-black/[0.06]">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-foreground/50 mb-4 flex items-center gap-1.5">
        <Layers className="w-3 h-3" />
        Agent fleet
      </div>
      <ul className="space-y-2">
        {agents.map((agent) => {
          const state = states[agent.id] || 'idle';
          const isExpanded = expandedId === agent.id;
          const colors = TONE_CLASSES[agent.tone];

          return (
            <li key={agent.id} className="group">
              <button
                onClick={() => onToggle(agent.id)}
                className="w-full flex items-center gap-2.5 rounded-lg border border-transparent hover:border-black/[0.05] hover:bg-white/50 p-2 transition-all text-left"
              >
                <div 
                  className="flex h-7 w-7 items-center justify-center rounded-md"
                  style={{ backgroundColor: colors.bg, color: colors.fg }}
                >
                  <agent.icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11.5px] font-bold text-foreground flex items-center gap-1.5">
                    {agent.label}
                    {state === 'resolved' && <CheckCircle2 className="w-2.5 h-2.5 text-[#5C9A70]" />}
                  </div>
                  <div className="text-[9.5px] text-foreground/45 truncate">{agent.role}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                   <StateBadge state={state} tone={agent.tone} />
                </div>
              </button>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="overflow-hidden px-2 pb-2 mt-1"
                >
                  <div className="bg-white/80 rounded-md p-2 border border-black/[0.03] space-y-1.5">
                    <div className="text-[9px] font-bold text-foreground/40 uppercase tracking-wider">Memory & Context</div>
                    {agent.memory.map((m, i) => (
                      <div key={i} className="text-[10px] text-foreground/70 flex items-start gap-1.5 leading-snug">
                        <span className="w-1 h-1 rounded-full bg-black/20 mt-1" />
                        {m}
                      </div>
                    ))}
                    <div className="flex items-center gap-1 mt-2 p-1 bg-[#E3EFE5]/50 rounded text-[9px] text-[#2f5d3f]">
                      <ShieldCheck className="w-2.5 h-2.5" />
                      Policy Vetted
                    </div>
                  </div>
                </motion.div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StateBadge({ state, tone }: { state: AgentState; tone: Tone }) {
  const isLive = state === "thinking" || state === "processing";
  const styles: Record<AgentState, { bg: string; text: string }> = {
    idle:       { bg: "bg-black/[0.04]", text: "text-foreground/45" },
    thinking:   { bg: "bg-[#ECE9FB]",    text: "text-[#4E3FB6]" },
    processing: { bg: "bg-[#E1E9F3]",    text: "text-[#244e8a]" },
    waiting:    { bg: "bg-[#EDE7DA]",    text: "text-[#2A2520]" },
    resolved:   { bg: "bg-[#E3EFE5]",    text: "text-[#2f5d3f]" },
    escalated:  { bg: "bg-[#F1DFDE]",    text: "text-[#8a3e3e]" },
  };

  return (
    <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${styles[state].bg} ${styles[state].text}`}>
      {isLive && <Activity className="w-2 h-2 animate-pulse" />}
      {state}
    </span>
  );
}
