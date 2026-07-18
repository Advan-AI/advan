export const STATUS_TONE: Record<string, string> = {
  open: "bg-[var(--dash-amber-wash)] text-[#8a5a1e]",
  pending: "bg-[var(--dash-blue-wash)] text-[#244e8a]",
  resolved: "bg-[var(--dash-sage-wash)] text-[#2f5d3f]",
  closed: "bg-[var(--dash-line)] text-[var(--dash-ink-faint)]",
}

export const PRIORITY_TONE: Record<string, string> = {
  low: "bg-[var(--dash-line)]",
  medium: "bg-[var(--dash-blue)]",
  high: "bg-[var(--dash-amber)]",
  urgent: "bg-[var(--dash-rose)]",
}

export const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  chat: "Chat",
  voice: "Voice",
  slack: "Slack",
  portal: "Portal",
}
