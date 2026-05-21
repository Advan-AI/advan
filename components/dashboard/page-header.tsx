import type { ReactNode } from "react"

export function DashPageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
      <div>
        {eyebrow && (
          <div className="text-[11px] font-bold uppercase tracking-[0.13em] text-[var(--dash-ink-faint)] mb-1.5">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-[var(--dash-ink)] leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[13.5px] text-[var(--dash-ink-soft)] max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function DashCard({
  title,
  icon,
  right,
  children,
  className = "",
  padded = true,
}: {
  title?: ReactNode
  icon?: ReactNode
  right?: ReactNode
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div className={`dash-card overflow-hidden flex flex-col ${className}`}>
      {(title || right) && (
        <div className="flex items-center gap-2.5 px-4 py-3.5 border-b dash-border-soft">
          {icon && <span className="text-[var(--dash-accent)]">{icon}</span>}
          {title && (
            <span className="text-[14px] font-bold text-[var(--dash-ink)]">{title}</span>
          )}
          {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
        </div>
      )}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </div>
  )
}
