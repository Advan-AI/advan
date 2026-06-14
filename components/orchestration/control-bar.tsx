import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Activity } from 'lucide-react';

interface ControlBarProps {
  stage: number;
  totalStages: number;
  running: boolean;
  banner: string;
  onSetStage: (i: number) => void;
  onToggleRunning: () => void;
}

export function ControlBar({ 
  stage, 
  totalStages, 
  running, 
  banner, 
  onSetStage, 
  onToggleRunning 
}: ControlBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-9 mb-5 flex flex-wrap items-center justify-center gap-4"
    >
      <div className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/70 backdrop-blur-md px-3 py-1.5 shadow-sm">
        {Array.from({ length: totalStages }).map((_, i) => {
          const active = i === stage;
          const completed = i < stage;
          return (
            <button
              key={i}
              onClick={() => onSetStage(i)}
              aria-label={`Jump to stage ${i + 1}`}
              className={`text-[10.5px] font-bold rounded-full w-6 h-6 inline-flex items-center justify-center transition-all ${
                active
                  ? "bg-[#6B5CD6] text-white shadow-md scale-110"
                  : completed
                  ? "bg-[#E3EFE5] text-[#2f5d3f]"
                  : "text-foreground/40 hover:text-foreground/75 hover:bg-black/[0.03]"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      
      <button
        onClick={onToggleRunning}
        className="inline-flex items-center gap-2 text-[11.5px] font-bold text-[#4E3FB6] hover:underline bg-[#ECE9FB] px-3 py-1.5 rounded-full transition-colors"
      >
        {running ? "Pause Evolution" : "Resume Flow"}
        <Zap className={`w-3 h-3 ${running ? 'animate-pulse' : ''}`} />
      </button>

      <div className="h-4 w-px bg-black/[0.1] hidden sm:block" />

      <span className="text-[11.5px] text-foreground/60 font-medium flex items-center gap-2 bg-white/50 px-3 py-1.5 rounded-full backdrop-blur-sm border border-black/[0.04]">
        <Activity className="w-3.5 h-3.5 text-[#5C9A70]" />
        {banner}
      </span>
    </motion.div>
  );
}
