"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useMemo } from "react"
import {
  MessageSquare,
  Ticket,
  Users,
  BookOpen,
  BarChart3,
  Sparkles,
  Box,
  LayoutGrid,
  GitBranch,
  Plug,
  LayoutDashboard,
  ChevronDown,
  Crown,
  CreditCard,
} from "lucide-react"
import { api } from "@/lib/api/trpc-client"
import { formatCount } from "@/lib/dashboard/format"
import { useNotifications } from "@/lib/realtime/notifications-store"

type NavCountKey = "conversations" | "tickets"

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  count?: number | null
  countKey?: NavCountKey
  countLoading?: boolean
  tag?: string
}

const PRIMARY: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/conversations", label: "Conversations", icon: MessageSquare, countKey: "conversations" },
  { href: "/dashboard/tickets", label: "Tickets", icon: Ticket, countKey: "tickets" },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/knowledge-base", label: "Knowledge Base", icon: BookOpen },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
]

const COPILOT: NavItem[] = [
  { href: "/dashboard/copilot", label: "Copilot", icon: Sparkles, tag: "New" },
  { href: "/dashboard/tap-box", label: "Tap Box", icon: Box },
  { href: "/dashboard/workflows", label: "Workflows", icon: LayoutGrid },
]

const AUTOMATION: NavItem[] = [
  { href: "/dashboard/orchestration", label: "Orchestration", icon: GitBranch },
  { href: "/dashboard/integrations", label: "Integrations", icon: Plug },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
]

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={`group relative flex items-center gap-3 px-2.5 py-2 rounded-lg text-[13.5px] font-medium transition-all ${
        active
          ? "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)] font-semibold"
          : "text-[var(--dash-ink-soft)] hover:bg-[rgba(107,92,214,0.07)] hover:text-[var(--dash-ink)]"
      }`}
    >
      <Icon className={`w-[17px] h-[17px] shrink-0 ${active ? "opacity-100" : "opacity-80"}`} />
      <span className="truncate">{item.label}</span>
      {item.countKey != null && (
        <span
          className={`ml-auto min-w-[1.25rem] text-center text-[11px] font-semibold rounded-md px-1.5 py-px ${
            active
              ? "bg-[rgba(107,92,214,0.18)] text-[var(--dash-accent-deep)]"
              : "bg-black/[0.06] text-[var(--dash-ink-soft)]"
          }`}
          aria-label={
            item.countLoading
              ? `Loading ${item.label.toLowerCase()} count`
              : `${item.count ?? 0} ${item.label.toLowerCase()}`
          }
        >
          {item.countLoading ? (
            <span className="inline-block w-4 h-2.5 rounded skeleton align-middle" />
          ) : (
            formatCount(item.count ?? 0)
          )}
        </span>
      )}
      {item.tag && (
        <span className="ml-auto text-[9px] font-bold uppercase tracking-wider bg-[var(--dash-sage)] text-white px-1.5 py-0.5 rounded">
          {item.tag}
        </span>
      )}
    </Link>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] font-bold tracking-[0.13em] uppercase text-[var(--dash-ink-faint)] px-2.5 pt-4 pb-1.5">
      {children}
    </div>
  )
}

export function DashboardSidebar() {
  const pathname = usePathname() || ""

  const { data: overview, isLoading: countsLoading } = api.analytics.overview.useQuery(
    undefined,
    {
      staleTime: 30_000,
      refetchInterval: 60_000,
      refetchOnWindowFocus: true,
    }
  )

  const { data: billingInfo } = api.billing.getBillingInfo.useQuery(
    undefined,
    {
      staleTime: 30_000,
      refetchInterval: 60_000,
    }
  )

  const realTimeUnreadCount = useNotifications((s) => s.unreadCount)

  const navCounts = useMemo(
    () => ({
      conversations: (overview?.metrics.openConversations ?? 0) + realTimeUnreadCount,
      tickets: overview?.queue.total ?? 0,
    }),
    [overview, realTimeUnreadCount]
  )

  const primaryNav = useMemo<NavItem[]>(
    () =>
      PRIMARY.map((item) => {
        if (!item.countKey) return item
        return {
          ...item,
          count: navCounts[item.countKey],
          countLoading: countsLoading,
        }
      }),
    [navCounts, countsLoading]
  )

  const orgName = billingInfo?.org?.name ?? "Acme Inc."
  const planName = billingInfo?.currentPlan?.name ?? "Enterprise Plan"
  const orgInitial = orgName.charAt(0).toUpperCase()
  const isStarter = billingInfo?.currentPlan?.key === "starter" || !billingInfo?.currentPlan

  const trialEndsAt = billingInfo?.org?.trialEndsAt ? new Date(billingInfo.org.trialEndsAt) : null
  const trialDaysRemaining = trialEndsAt 
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0
  const isTrialing = billingInfo?.org?.subscriptionStatus === "trialing" || (trialEndsAt && trialEndsAt > new Date())

  const planSubText = isTrialing 
    ? `${trialDaysRemaining} ${trialDaysRemaining === 1 ? "day" : "days"} left`
    : planName

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <aside className="w-[14.25rem] shrink-0 dash-bg-sidebar border-r dash-border self-stretch">
      <div className="sticky top-0 h-screen flex flex-col px-3.5 py-5 overflow-y-auto">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-2 pb-4">
        <Image
          src="/images/advan-logo.svg"
          alt="Advan"
          width={34}
          height={34}
          className="rounded-[9px]"
          priority
        />
        <span className="text-[21px] font-extrabold tracking-tight text-[var(--dash-ink)]">Advan</span>
      </Link>

      <nav className="flex flex-col gap-1">
        {primaryNav.map((i) => (
          <NavLink key={i.href} item={i} active={isActive(i.href)} />
        ))}

        <GroupLabel>AI Copilot</GroupLabel>
        {COPILOT.map((i) => (
          <NavLink key={i.href} item={i} active={isActive(i.href)} />
        ))}

        <GroupLabel>Automation</GroupLabel>
        {AUTOMATION.map((i) => (
          <NavLink key={i.href} item={i} active={isActive(i.href)} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-2.5">
        {isStarter && (
          <div className="dash-card-raised p-3.5 relative overflow-hidden">
            {isTrialing && trialDaysRemaining > 0 && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-[rgba(107,92,214,0.08)]">
                <div 
                  className="h-full bg-[var(--dash-accent)] transition-all duration-500" 
                  style={{ width: `${Math.min(100, (trialDaysRemaining / 14) * 100)}%` }} 
                />
              </div>
            )}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Crown className="w-[15px] h-[15px] text-[var(--dash-amber)]" />
                <span className="text-[13px] font-bold text-[var(--dash-ink)]">
                  {isTrialing ? "Free Trial Period" : "Upgrade to Pro"}
                </span>
              </div>
              {isTrialing && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[rgba(107,92,214,0.1)] text-[var(--dash-accent-deep)]">
                  {trialDaysRemaining}d left
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-[var(--dash-ink-soft)] leading-[1.5] mb-2.5">
              {isTrialing 
                ? "Experience the full power of Advan AI. Upgrade to lock in your workspace features." 
                : "Unlock advanced AI, automation & more."}
            </p>
            <Link
              href="/dashboard/billing"
              className="flex items-center justify-center w-full h-8 rounded-lg border border-[var(--dash-accent)] text-[var(--dash-accent-deep)] text-[12.5px] font-semibold hover:bg-[var(--dash-accent)] hover:text-white transition-colors"
            >
              Upgrade Now
            </Link>
          </div>
        )}

        <Link
          href="/dashboard/billing"
          className="flex items-center gap-2.5 p-2.5 rounded-[11px] border dash-border dash-bg-card hover:dash-shadow-sm transition cursor-pointer text-left"
        >
          <div className="w-[30px] h-[30px] rounded-lg dash-bg-deep flex items-center justify-center text-[13px] font-bold text-[var(--dash-ink-soft)]">
            {orgInitial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-bold leading-tight text-[var(--dash-ink)] truncate">{orgName}</div>
            <div className="text-[10.5px] text-[var(--dash-ink-faint)] truncate">{planSubText}</div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-[var(--dash-ink-faint)]" />
        </Link>
      </div>
      </div>
    </aside>
  )
}
