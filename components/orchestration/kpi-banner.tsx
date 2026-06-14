import React from 'react';

interface KPIBannerProps {
  stats: {
    handled: number;
    p95: number;
    success: number;
  };
}

export function KPIBanner({ stats }: KPIBannerProps) {
  return (
    <div className="grid grid-cols-3 border-b border-black/[0.06] bg-white/40">
      {[
        { label: "Handled", value: stats.handled.toLocaleString(), suffix: "" },
        { label: "p95 Latency", value: stats.p95.toFixed(2), suffix: "s" },
        { label: "Success Rate", value: stats.success.toFixed(1), suffix: "%" },
      ].map((s, i) => (
        <div
          key={s.label}
          className={`px-4 py-3.5 ${i !== 0 ? "border-l border-black/[0.06]" : ""}`}
        >
          <div className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-foreground/45 mb-1">
            {s.label}
          </div>
          <div className="text-18px font-bold tracking-tight text-foreground flex items-baseline gap-0.5">
            {s.value}
            <span className="text-[10px] font-medium text-foreground/40">{s.suffix}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
