import { formatDistanceToNow } from "date-fns"

export function getGreeting(firstName: string, date = new Date()): string {
  const hour = date.getHours()
  const period =
    hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"
  return `Good ${period}, ${firstName}`
}

export function getInitials(name: string | null | undefined): string {
  if (!name?.trim()) return "?"
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || ms <= 0) return "—"
  if (ms < 1_000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${Math.round(ms / 1_000)}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
  return `${(ms / 3_600_000).toFixed(1)}h`
}

export function formatCsat(value: number | null | undefined): string {
  if (value == null) return "—"
  return value.toFixed(2)
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "—"
  return `${value}%`
}

export function formatCount(value: number | null | undefined): string {
  if (value == null) return "—"
  return value.toLocaleString()
}

export function formatRelativeTime(
  date: Date | string | null | undefined
): string {
  if (!date) return "—"
  const parsed = typeof date === "string" ? new Date(date) : date
  if (Number.isNaN(parsed.getTime())) return "—"
  return formatDistanceToNow(parsed, { addSuffix: true })
}
