const AVATAR_COLORS = [
  "#4F46E5",
  "#0D9488",
  "#DB2777",
  "#D97706",
  "#2563EB",
]

export interface PresenceAgent {
  id: string
  name: string
  initials: string
}

export function presenceTitle(
  agents: PresenceAgent[],
  teamName: string,
  agentCount: number
): string {
  if (agents.length === 1) return agents[0].name
  if (agents.length > 1) return `${agents[0].name} & team`
  if (agentCount > 1) return teamName
  return teamName
}

export function AgentPresenceStack({
  online,
  agents,
  agentCount,
  teamName,
}: {
  online: boolean
  agents: PresenceAgent[]
  agentCount: number
  teamName: string
}) {
  const visible = agents.slice(0, 2)
  const remainder = Math.max(0, agentCount - Math.max(visible.length, 1))
  const showPlus = online && remainder > 0

  if (!online || (visible.length === 0 && !showPlus)) {
    const initials =
      teamName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join("") || "S"
    return (
      <div className="relative flex-shrink-0">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white ring-2 ring-white/25"
          style={{ background: AVATAR_COLORS[0] }}
          aria-hidden
        >
          {initials}
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-primary ${
            online ? "bg-emerald-400" : "bg-amber-300"
          }`}
        />
      </div>
    )
  }

  const stack =
    visible.length > 0
      ? visible
      : [{ id: "a1", name: teamName, initials: teamName.slice(0, 1).toUpperCase() }]

  return (
    <div className="relative flex items-center flex-shrink-0" aria-label={`${agentCount} online`}>
      <div className="flex items-center">
        {stack.map((agent, i) => (
          <div
            key={agent.id}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white ring-2 ring-primary"
            style={{
              background: AVATAR_COLORS[i % AVATAR_COLORS.length],
              marginLeft: i === 0 ? 0 : -10,
              zIndex: stack.length - i,
            }}
            title={agent.name}
          >
            {agent.initials}
          </div>
        ))}
        {showPlus && (
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white ring-2 ring-primary bg-white/25"
            style={{ marginLeft: -10, zIndex: 0 }}
            title={`${remainder} more online`}
          >
            +{remainder}
          </div>
        )}
      </div>
      <span className="absolute -bottom-0.5 left-[26px] w-2.5 h-2.5 rounded-full border-2 border-primary bg-emerald-400" />
    </div>
  )
}

export function AgentAvatar({ initials, name }: { initials?: string; name?: string }) {
  const label = (initials?.trim() || name?.slice(0, 1) || "S").slice(0, 2).toUpperCase()
  return (
    <div
      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold ring-1 ring-black/5"
      style={{ background: AVATAR_COLORS[0] }}
      title={name}
    >
      {label}
    </div>
  )
}

export function VisitorAvatar() {
  return (
    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground text-[10px] font-bold">
      Y
    </div>
  )
}
