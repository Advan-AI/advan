import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { AgentDef, AgentState } from './types';
import { Brain, BookOpen, Banknote, PhoneCall, ShieldCheck, Sparkles, UserCheck } from 'lucide-react';

const TONE_COLORS: Record<string, { fg: string; bg: string; border: string; flow: string }> = {
  violet: { fg: "#4E3FB6", bg: "#ECE9FB", border: "rgba(107,92,214,0.40)",  flow: "#6B5CD6" },
  blue:   { fg: "#244e8a", bg: "#E1E9F3", border: "rgba(90,133,195,0.40)",  flow: "#5A85C3" },
  amber:  { fg: "#8a5a1e", bg: "#F4E8D3", border: "rgba(197,136,60,0.40)",  flow: "#C5883C" },
  rose:   { fg: "#8a3e3e", bg: "#F1DFDE", border: "rgba(190,106,106,0.40)", flow: "#BE6A6A" },
  sage:   { fg: "#2f5d3f", bg: "#E3EFE5", border: "rgba(92,154,112,0.40)",  flow: "#5C9A70" },
  slate:  { fg: "#2A2520", bg: "#EDE7DA", border: "rgba(60,50,30,0.20)",    flow: "#6E6656" },
};

const ICON_MAP: Record<string, any> = {
  triage: Brain,
  knowledge: BookOpen,
  billing: Banknote,
  voice: PhoneCall,
  policy: ShieldCheck,
  composer: Sparkles,
  human: UserCheck,
};

export const AgentNode = memo(({ data }: NodeProps<{ agent: AgentDef; state: AgentState }>) => {
  const { agent, state } = data;
  const Icon = ICON_MAP[agent.id] || Brain;
  const colors = TONE_COLORS[agent.tone];
  const isLive = state === "thinking" || state === "processing";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group relative"
      style={{ width: 156 }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: colors.flow, border: 'none', width: 8, height: 8 }}
      />
      
      <motion.div
        animate={
          isLive
            ? {
                boxShadow: [
                  `0 0 0 0 ${colors.flow}40`,
                  `0 0 0 10px ${colors.flow}00`,
                  `0 0 0 0 ${colors.flow}00`,
                ],
              }
            : { boxShadow: "0 4px 12px -4px rgba(0,0,0,0.1)" }
        }
        transition={isLive ? { duration: 1.5, repeat: Infinity } : { duration: 0.3 }}
        className="rounded-xl border bg-white/90 backdrop-blur-sm p-3 transition-colors"
        style={{ borderColor: isLive ? colors.border : 'rgba(0,0,0,0.08)' }}
      >
        <div className="flex items-center gap-2.5">
          <div 
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ backgroundColor: colors.bg, color: colors.fg }}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11.5px] font-bold leading-tight truncate">{agent.label}</div>
            <div className="text-[9.5px] text-foreground/50 truncate">{agent.role}</div>
          </div>
        </div>
      </motion.div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: colors.flow, border: 'none', width: 8, height: 8 }}
      />
    </motion.div>
  );
});

AgentNode.displayName = 'AgentNode';
