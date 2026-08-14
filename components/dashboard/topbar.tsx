"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  Bell,
  HelpCircle,
  LayoutGrid,
  LogOut,
  Menu,
  MessageCircle,
  Search,
  Settings,
  User,
} from "lucide-react"
import type { Session } from "next-auth"
import { api } from "@/lib/api/trpc-client"
import { useNotifications } from "@/lib/realtime/notifications-store"

type SessionUser = Session["user"] | null

interface TopbarProps {
  user: SessionUser
  onOpenSidebar?: () => void
}

export function DashboardTopbar({ user, onOpenSidebar }: TopbarProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false)
  
  const notifications = useNotifications((s) => s.notifications)
  const unreadCount = useNotifications((s) => s.unreadCount)
  const markAsRead = useNotifications((s) => s.markAsRead)
  const clearAllNotifications = useNotifications((s) => s.clearAll)

  // ── Chat availability toggle ───────────────────────────────────────────────
  const { data: chatStatusData } = api.conversations.getAgentChatStatus.useQuery(undefined, {
    staleTime: 60_000,
  })
  const chatAvailable = chatStatusData?.chatAvailable ?? true

  const setChatAvailable = api.conversations.setAgentChatAvailable.useMutation({
    // Optimistic local state — feels instant even without refetch.
    onMutate: async () => {
      await utils.conversations.getAgentChatStatus.cancel()
    },
    onSettled: () => {
      void utils.conversations.getAgentChatStatus.invalidate()
    },
  })
  const utils = api.useUtils()

  const { data: profile } = api.user.getProfile.useQuery(undefined, {
    staleTime: 60_000,
  })

  async function handleSignOut() {
    await signOut({ redirect: false })
    router.push("/signin")
  }

  const initials =
    (profile?.name || user?.name || "Sarah Johnson")
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "SJ"

  const avatarImage = profile?.image || user?.image

  return (
    <header
      className="h-[var(--dash-topbar-h,66px)] min-h-[56px] flex items-center gap-2 sm:gap-3 md:gap-4 px-3 sm:px-4 md:px-6 border-b dash-border sticky top-0 z-30"
      style={{
        background: "rgba(252,250,244,0.82)",
        backdropFilter: "blur(10px)",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <button
        onClick={onOpenSidebar}
        className="lg:hidden p-2.5 -ml-1 rounded-lg hover:bg-black/[0.04] text-[var(--dash-ink-soft)] touch-manipulation"
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-2 sm:gap-2.5 text-[14px] sm:text-[15px] md:text-[16px] font-bold text-[var(--dash-ink)] min-w-0">
        <LayoutGrid className="w-[18px] h-[18px] sm:w-[19px] sm:h-[19px] text-[var(--dash-accent)] shrink-0" />
        <span className="hidden sm:inline truncate">Support Workspace</span>
        <span className="sm:hidden truncate">Workspace</span>
      </div>

      <span className="hidden md:inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--dash-sage)] dash-bg-sage-wash rounded-full px-2.5 py-0.5 shrink-0">
        <span className="w-[7px] h-[7px] rounded-full bg-[var(--dash-sage)] dash-pulse-dot" />
        Online
      </span>

      {/* Chat availability toggle */}
      <button
        type="button"
        title={chatAvailable ? "Click to go offline for chat" : "Click to accept live chat"}
        onClick={() => setChatAvailable.mutate({ available: !chatAvailable })}
        disabled={setChatAvailable.isPending}
        className={[
          "hidden md:inline-flex items-center gap-1.5 text-[11.5px] font-semibold rounded-full px-2.5 py-0.5 transition-colors shrink-0",
          chatAvailable
            ? "text-[#166534] bg-[#DCFCE7] hover:bg-[#BBF7D0]"
            : "text-[var(--dash-ink-faint)] bg-[var(--dash-bg-deep)] hover:bg-[var(--dash-bg-deep)]/80",
          setChatAvailable.isPending ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
        ].join(" ")}
        aria-label={chatAvailable ? "Available for live chat — click to go offline" : "Offline for live chat — click to go online"}
        aria-pressed={chatAvailable}
      >
        <MessageCircle className="w-[13px] h-[13px]" />
        <span>{chatAvailable ? "Chat on" : "Chat off"}</span>
        {/* Visual pill toggle */}
        <span
          className={[
            "relative inline-flex w-7 h-4 rounded-full transition-colors duration-200",
            chatAvailable ? "bg-[#22c55e]" : "bg-[var(--dash-ink-faint)]/30",
          ].join(" ")}
          aria-hidden
        >
          <span
            className={[
              "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200",
              chatAvailable ? "translate-x-3.5" : "translate-x-0.5",
            ].join(" ")}
          />
        </span>
      </button>

      <div className="hidden lg:flex flex-1 max-w-[27.5rem] 3xl:max-w-[36rem] items-center gap-2.5 dash-bg-card border dash-border rounded-[10px] px-3 py-2 text-[13px] text-[var(--dash-ink-faint)] focus-within:border-[var(--dash-accent)] focus-within:ring-2 focus-within:ring-[var(--dash-accent-wash)] transition min-w-0">
        <Search className="w-4 h-4 shrink-0" />
        <input
          placeholder="Search tickets, customers or knowledge…"
          className="flex-1 min-w-0 bg-transparent outline-none text-[var(--dash-ink)] placeholder:text-[var(--dash-ink-faint)] text-[13px]"
        />
        <span className="text-[10.5px] font-semibold rounded-[5px] px-1.5 py-0.5 dash-bg-deep text-[var(--dash-ink-soft)] shrink-0">
          ⌘K
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5 md:gap-3.5 shrink-0">
        {/* Mobile chat toggle */}
        <button
          type="button"
          onClick={() => setChatAvailable.mutate({ available: !chatAvailable })}
          disabled={setChatAvailable.isPending}
          className={[
            "md:hidden w-9 h-9 rounded-[9px] border dash-border dash-bg-card flex items-center justify-center transition",
            chatAvailable ? "text-[#166534]" : "text-[var(--dash-ink-faint)]",
          ].join(" ")}
          aria-label={chatAvailable ? "Chat on — tap to go offline" : "Chat off — tap to go online"}
          aria-pressed={chatAvailable}
        >
          <MessageCircle className="w-[17px] h-[17px]" />
        </button>

        {/* Real-time Dynamic Notifications Bell (Facebook style) */}
        <div className="relative">
          <button
            onClick={() => setNotifDropdownOpen((v) => !v)}
            className={`relative w-9 h-9 rounded-[9px] border dash-border dash-bg-card hover:dash-shadow-sm hover:-translate-y-px transition flex items-center justify-center ${
              notifDropdownOpen ? "border-[var(--dash-accent)] ring-2 ring-[var(--dash-accent-wash)]" : ""
            }`}
            aria-label={`${unreadCount} unread notifications`}
          >
            <Bell className="w-[17px] h-[17px] text-[var(--dash-ink-soft)]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--dash-rose)] text-white text-[9.5px] font-extrabold flex items-center justify-center border-2 border-[var(--dash-card)] animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {notifDropdownOpen && (
            <div
              className="fixed inset-x-3 top-[calc(var(--dash-topbar-h,66px)+0.5rem)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2.5 sm:w-[21.25rem] rounded-xl dash-card-raised overflow-hidden z-50 shadow-[0_12px_32px_rgba(0,0,0,0.08)] bg-[#FCFBF8] border dash-border max-h-[min(70dvh,420px)] flex flex-col"
              onMouseLeave={() => setNotifDropdownOpen(false)}
            >
              {/* Header */}
              <div className="px-4 py-3 border-b dash-border flex items-center justify-between bg-[#FAF9F5]">
                <span className="text-[13.5px] font-extrabold text-[var(--dash-ink)]">Notifications</span>
                {notifications.length > 0 && (
                  <button
                    onClick={clearAllNotifications}
                    className="text-[10.5px] font-semibold text-[var(--dash-rose)] hover:underline"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto divide-y dash-border overscroll-contain">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-[12px] text-[var(--dash-ink-faint)] italic">
                    No new notifications
                  </div>
                ) : (
                  notifications.map((n) => {
                    const parsedTime = new Date(n.timestamp)
                    const relativeTime = isNaN(parsedTime.getTime())
                      ? "Just now"
                      : Math.floor((Date.now() - parsedTime.getTime()) / 60000) < 1
                        ? "Just now"
                        : `${Math.floor((Date.now() - parsedTime.getTime()) / 60000)}m ago`

                    const itemInitials = n.customerName
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase() || "WV"

                    return (
                      <button
                        key={n.id}
                        onClick={() => {
                          markAsRead(n.conversationId)
                          setNotifDropdownOpen(false)
                          router.push(`/dashboard/conversations?conversationId=${n.conversationId}`)
                        }}
                        className={`w-full text-left px-4 py-3 hover:bg-[rgba(107,92,214,0.04)] flex gap-3 transition-colors ${
                          !n.read ? "bg-[rgba(107,92,214,0.02)]" : ""
                        }`}
                      >
                        {/* Rounded Avatar with status */}
                        <div className="relative shrink-0">
                          <span className="w-[36px] h-[36px] rounded-full flex items-center justify-center text-[12px] font-bold text-white bg-gradient-to-br from-indigo-400 to-purple-600">
                            {itemInitials}
                          </span>
                          {!n.read && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#22c55e] border border-white" />
                          )}
                        </div>

                        {/* Content text */}
                        <div className="flex-1 min-w-0 font-sans">
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-[12px] truncate ${!n.read ? "font-bold text-[var(--dash-ink)]" : "text-[var(--dash-ink-soft)]"}`}>
                              {n.customerName}
                            </span>
                            <span className="text-[10px] text-[var(--dash-ink-faint)] shrink-0">
                              {relativeTime}
                            </span>
                          </div>
                          <p className="text-[11.5px] text-[var(--dash-ink-soft)] line-clamp-2 mt-0.5 font-normal leading-relaxed italic">
                            "{n.content}"
                          </p>
                        </div>

                        {/* Red Dot Indicator */}
                        {!n.read && (
                          <div className="shrink-0 flex items-center">
                            <span className="w-2 h-2 rounded-full bg-[var(--dash-rose)]" />
                          </div>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>
        <button className="hidden sm:flex w-9 h-9 rounded-[9px] border dash-border dash-bg-card hover:dash-shadow-sm hover:-translate-y-px transition items-center justify-center">
          <HelpCircle className="w-[17px] h-[17px] text-[var(--dash-ink-soft)]" />
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 pl-1.5 hover:bg-black/[0.04] rounded-lg px-1.5 py-1 transition"
          >
            <span
              className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[12px] font-bold text-white overflow-hidden shrink-0"
              style={{
                background: avatarImage ? "none" : "linear-gradient(135deg,#8E80E5,#5C4DC1)",
              }}
              aria-hidden
            >
              {avatarImage ? (
                <img src={avatarImage} alt={profile?.name || user?.name || "User Avatar"} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </span>
            <span className="hidden sm:flex flex-col items-start leading-tight">
              <span className="text-[13px] font-bold text-[var(--dash-ink)]">
                {profile?.name || user?.name || "Sarah Johnson"}
              </span>
              <span className="text-[10.5px] text-[var(--dash-ink-faint)] capitalize">
                {profile?.role || user?.role || "Admin"}
              </span>
            </span>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 rounded-xl dash-card-raised overflow-hidden z-40"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <div className="px-3.5 py-3 border-b dash-border-soft">
                <div className="text-[13px] font-bold text-[var(--dash-ink)] truncate">
                  {user?.name || "Sarah Johnson"}
                </div>
                <div className="text-[11px] text-[var(--dash-ink-faint)] truncate">
                  {user?.email || "admin@acme.co"}
                </div>
              </div>
              <Link
                href="/dashboard/settings?tab=profile"
                className="flex items-center gap-2 px-3.5 py-2 text-[13px] text-[var(--dash-ink-soft)] hover:bg-[var(--dash-accent-wash)] hover:text-[var(--dash-accent-deep)]"
              >
                <User className="w-4 h-4" />
                Profile
              </Link>
              <Link
                href="/dashboard/settings"
                className="flex items-center gap-2 px-3.5 py-2 text-[13px] text-[var(--dash-ink-soft)] hover:bg-[var(--dash-accent-wash)] hover:text-[var(--dash-accent-deep)]"
              >
                <Settings className="w-4 h-4" />
                Settings
              </Link>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3.5 py-2 text-[13px] text-[var(--dash-rose)] hover:bg-[#F1DFDE]"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
