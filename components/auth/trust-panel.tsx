"use client"

import { AuditTicker } from "@/components/auth/audit-ticker"

const STATS = [
  { value: "92%", label: "replies with sources" },
  { value: "<4s", label: "p95 resolution" },
  { value: "100%", label: "interactions audited" },
]

/**
 * Dark trust panel shown beside the sign-in form — reinforces the brand at the
 * moment of highest skepticism (entering credentials).
 */
export function TrustPanel() {
  return (
    <div
      className="relative isolate hidden lg:flex flex-col justify-between overflow-hidden p-10 xl:p-12"
      style={{ background: "linear-gradient(180deg, #2A2520 0%, #1c1814 100%)" }}
    >
      {/* Glows */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/3 w-[460px] h-[320px] rounded-full bg-[#6B5CD6]/30 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 w-[380px] h-[300px] rounded-full bg-[#5C9A70]/20 blur-3xl" />
      </div>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />

      <div className="inline-flex items-center gap-2 self-start rounded-full bg-white/10 border border-white/10 backdrop-blur px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#E1D8FA]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#C8BEFF] dash-pulse-dot" />
        Trust Engine · Always on
      </div>

      <div className="my-8">
        <h2 className="text-[32px] xl:text-[38px] font-semibold leading-[1.1] tracking-tight text-white max-w-md">
          Every answer your team sends is{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: "linear-gradient(135deg, #C8BEFF 0%, #FFFFFF 55%, #B6E2C2 100%)",
            }}
          >
            cited, scored, and logged
          </span>
        </h2>
        <p className="mt-4 text-[14px] leading-relaxed text-white/60 max-w-md">
          Sign in to a workspace where every reply carries its evidence — the
          same transparency your customers and auditors see.
        </p>
      </div>

      <AuditTicker />

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        {STATS.map((s) => (
          <div key={s.label} className="flex items-baseline gap-1.5">
            <span className="text-[20px] font-bold text-white tracking-tight">{s.value}</span>
            <span className="text-[11.5px] text-white/55">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
