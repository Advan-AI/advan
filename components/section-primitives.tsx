"use client"

import { motion } from "framer-motion"
import type { ReactNode } from "react"

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-200/90">
      {children}
    </div>
  )
}

export function SectionTitle({ children, align = "center" }: { children: ReactNode; align?: "center" | "left" }) {
  return (
    <h2
      className={`text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-[1.1] text-gradient ${
        align === "center" ? "text-center" : ""
      }`}
    >
      {children}
    </h2>
  )
}

export function SectionLede({ children, align = "center" }: { children: ReactNode; align?: "center" | "left" }) {
  return (
    <p
      className={`text-base lg:text-lg text-white/60 max-w-2xl leading-relaxed ${
        align === "center" ? "text-center mx-auto" : ""
      }`}
    >
      {children}
    </p>
  )
}

export function SectionHeader({
  eyebrow,
  title,
  lede,
  align = "center",
}: {
  eyebrow?: ReactNode
  title: ReactNode
  lede?: ReactNode
  align?: "center" | "left"
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6 }}
      className={`flex flex-col gap-4 ${align === "center" ? "items-center text-center" : "items-start"} max-w-3xl ${align === "center" ? "mx-auto" : ""}`}
    >
      {eyebrow ? <SectionEyebrow>{eyebrow}</SectionEyebrow> : null}
      <SectionTitle align={align}>{title}</SectionTitle>
      {lede ? <SectionLede align={align}>{lede}</SectionLede> : null}
    </motion.div>
  )
}

export function GlassCard({
  children,
  className = "",
  glow,
}: {
  children: ReactNode
  className?: string
  glow?: "cyan" | "violet" | "blue" | "green"
}) {
  const glowMap: Record<string, string> = {
    cyan: "shadow-[0_20px_60px_-20px_rgba(34,211,238,0.35)]",
    violet: "shadow-[0_20px_60px_-20px_rgba(167,139,250,0.35)]",
    blue: "shadow-[0_20px_60px_-20px_rgba(59,130,246,0.35)]",
    green: "shadow-[0_20px_60px_-20px_rgba(52,211,153,0.35)]",
  }
  return (
    <div className={`relative rounded-2xl glass p-6 transition-all hover:-translate-y-0.5 hover:border-white/15 ${glow ? glowMap[glow] : ""} ${className}`}>
      {children}
    </div>
  )
}
