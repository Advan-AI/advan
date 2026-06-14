import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity } from 'lucide-react';
import { AgentDef, LogEvent, Tone } from './types';

const TONE_COLORS: Record<Tone, { fg: string; bg: string }> = {
  violet: { fg: "#4E3FB6", bg: "#ECE9FB" },
  blue:   { fg: "#244e8a", bg: "#E1E9F3" },
  amber:  { fg: "#8a5a1e", bg: "#F4E8D3" },
  rose:   { fg: "#8a3e3e", bg: "#F1DFDE" },
  sage:   { fg: "#2f5d3f", bg: "#E3EFE5" },
  slate:  { fg: "#2A2520", bg: "#EDE7DA" },
};

interface ExecutionTraceProps {
  events: LogEvent[];
  agents: AgentDef[];
}

export function ExecutionTrace({ events, agents }: ExecutionTraceProps) {
  return (
    <div className="bg-white/55 flex flex-col h-full">
      <div className="px-4 py-4 flex items-center justify-between border-b border-black/[0.06]">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-foreground/50 flex items-center gap-1.5">
          <Activity className="w-3 h-3" />
          Execution trace
        </div>
        <span className="text-[10px] font-mono text-foreground/45">
          LIVE TELEMETRY
        </span>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <div className="px-3 py-3 space-y-2 max-h-[400px] overflow-y-auto scrollbar-hide">
          <AnimatePresence initial={false}>
            {events.map((event, i) => {
              const agent = agents.find((a) => a.id === event.who);
              if (!agent) return null;
              const colors = TONE_COLORS[agent.tone];
              
              const dotCls =
                event.tone === "err" ? "bg-[#BE6A6A]" :
                event.tone === "warn" ? "bg-[#C5883C]" :
                event.tone === "ok" ? "bg-[#5C9A70]" : "bg-[#6B5CD6]";

              return (
                <motion.div
                  key={`${event.ts}-${i}`}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-2.5 rounded-lg border border-black/[0.04] bg-white/80 p-2.5 shadow-sm"
                >
                  <div 
                    className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: colors.bg, color: colors.fg }}
                  >
                    <agent.icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[11px] font-bold text-foreground">{agent.label}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
                      <span className="ml-auto font-mono text-[9.5px] text-foreground/40">{event.ts}</span>
                    </div>
                    <div className="text-[11px] text-foreground/60 leading-normal font-medium">
                      {event.message}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/90 to-transparent" />
      </div>
    </div>
  );
}
