"use client"

import { BarChart3, Calendar, Download, TrendingUp } from "lucide-react"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"

const BARS = [38, 52, 47, 61, 73, 68, 81, 79, 92, 88, 96, 102]
const SPARK = [10, 12, 9, 14, 18, 16, 22, 27, 25, 31, 30, 36]

export default function AnalyticsPage() {
  const maxBar = Math.max(...BARS)
  return (
    <div>
      <DashPageHeader
        eyebrow="Reports"
        title="Analytics"
        subtitle="Resolution velocity, AI confidence, and CSAT — explained with the same sources Advan cites in every reply."
        actions={
          <>
            <button className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border dash-border bg-[var(--dash-card)] text-[13px] font-semibold text-[var(--dash-ink-soft)] hover:dash-shadow-sm transition">
              <Calendar className="w-4 h-4" /> Last 30 days
            </button>
            <button className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] shadow-[0_8px_22px_-10px_rgba(107,92,214,0.6)] hover:-translate-y-px transition">
              <Download className="w-4 h-4" /> Export
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {[
          { k: "AI resolution rate", v: "72%", d: "+9pts" },
          { k: "Avg first response",  v: "11s", d: "-42%" },
          { k: "Avg confidence",      v: "94%", d: "+3pts" },
          { k: "CSAT",                v: "4.86", d: "+0.22" },
        ].map((c) => (
          <div key={c.k} className="dash-card p-4">
            <div className="text-[11.5px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">{c.k}</div>
            <div className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--dash-ink)]">{c.v}</div>
            <div className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[var(--dash-sage)]">
              <TrendingUp className="w-3 h-3" /> {c.d}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
        <DashCard
          title="Tickets resolved · daily"
          icon={<BarChart3 className="w-[18px] h-[18px]" />}
        >
          <div className="flex items-end gap-2 h-[180px] mt-2">
            {BARS.map((b, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-md bg-gradient-to-t from-[#6B5CD6] to-[#8E80E5] transition-all"
                  style={{ height: `${(b / maxBar) * 160}px` }}
                />
                <span className="text-[9.5px] text-[var(--dash-ink-faint)]">{i + 1}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[11.5px] text-[var(--dash-ink-soft)]">
            12-day window · 1,284 resolved · 72% AI-led
          </div>
        </DashCard>

        <DashCard title="CSAT trend" icon={<TrendingUp className="w-[18px] h-[18px]" />}>
          <svg viewBox="0 0 240 120" className="w-full h-[120px]" aria-hidden>
            <defs>
              <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#5C9A70" stopOpacity="0.35" />
                <stop offset="1" stopColor="#5C9A70" stopOpacity="0" />
              </linearGradient>
            </defs>
            {(() => {
              const m = Math.max(...SPARK)
              const pts = SPARK.map((p, i) => `${(i / (SPARK.length - 1)) * 240},${120 - (p / m) * 110}`).join(" ")
              return (
                <>
                  <polyline fill="none" stroke="#5C9A70" strokeWidth="2.4" strokeLinecap="round" points={pts} />
                  <polygon fill="url(#spark-fill)" points={`0,120 ${pts} 240,120`} />
                </>
              )
            })()}
          </svg>
          <div className="mt-1 flex items-center justify-between text-[11.5px]">
            <span className="text-[var(--dash-ink-faint)]">Apr 21 → May 21</span>
            <span className="font-bold text-[var(--dash-sage)]">+0.22</span>
          </div>
        </DashCard>
      </div>
    </div>
  )
}
