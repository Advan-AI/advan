import {
  MessageSquare, Brain, BookOpen, Sparkles, UserCheck, Database, ArrowUpRight,
  type LucideIcon, Box,
} from "lucide-react"
import type { Tone } from "@/lib/pipeline/registry"

/** Maps registry `iconName` strings to lucide components (client-only concern). */
export const ICONS: Record<string, LucideIcon> = {
  MessageSquare, Brain, BookOpen, Sparkles, UserCheck, Database, ArrowUpRight,
}

export function iconFor(name: string): LucideIcon {
  return ICONS[name] ?? Box
}

export const TONE_STYLE: Record<Tone, { fg: string; bg: string; border: string }> = {
  violet: { fg: "#4E3FB6", bg: "#ECE9FB", border: "rgba(107,92,214,0.40)" },
  blue: { fg: "#244e8a", bg: "#E1E9F3", border: "rgba(90,133,195,0.40)" },
  amber: { fg: "#8a5a1e", bg: "#F4E8D3", border: "rgba(197,136,60,0.40)" },
  rose: { fg: "#8a3e3e", bg: "#F1DFDE", border: "rgba(190,106,106,0.40)" },
  sage: { fg: "#2f5d3f", bg: "#E3EFE5", border: "rgba(92,154,112,0.40)" },
  slate: { fg: "#2A2520", bg: "#EDE7DA", border: "rgba(60,50,30,0.20)" },
}
