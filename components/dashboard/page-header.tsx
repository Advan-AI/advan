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
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4 mb-4 sm:mb-5">
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <div className="text-[11px] font-bold uppercase tracking-[0.13em] text-[var(--dash-ink-faint)] mb-1.5">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[clamp(1.25rem,2.5vw+0.6rem,1.75rem)] font-bold tracking-tight text-[var(--dash-ink)] leading-tight break-words">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[13px] sm:text-[13.5px] text-[var(--dash-ink-soft)] max-w-3xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end shrink-0">
          {actions}
        </div>
      )}
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
    <div className={`dash-card overflow-hidden flex flex-col min-w-0 ${className}`}>
      {(title || right) && (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 px-3 sm:px-4 py-3 sm:py-3.5 border-b dash-border-soft">
          {icon && <span className="text-[var(--dash-accent)] shrink-0">{icon}</span>}
          {title && (
            <span className="text-[13.5px] sm:text-[14px] font-bold text-[var(--dash-ink)] min-w-0 flex-1 [&:has(>span)]:flex">
              {title}
            </span>
          )}
          {right && (
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2 min-w-0 max-w-full">
              {right}
            </div>
          )}
        </div>
      )}
      <div className={`flex-1 flex flex-col min-h-0 min-w-0 ${padded ? "p-3 sm:p-4" : ""}`}>
        {children}
      </div>
    </div>
  )
}
