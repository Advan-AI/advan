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

type SessionUser = Session["user"] | null

interface TopbarProps {
  user: SessionUser
  onOpenSidebar?: () => void
}

export function DashboardTopbar({ user, onOpenSidebar }: TopbarProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

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

  async function handleSignOut() {
    await signOut({ redirect: false })
    router.push("/signin")
  }

  const initials =
    (user?.name || "Sarah Johnson")
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "SJ"

  return (
    <header
      className="h-[66px] flex items-center gap-3 sm:gap-4 px-4 sm:px-6 border-b dash-border sticky top-0 z-30"
      style={{
        background: "rgba(252,250,244,0.82)",
        backdropFilter: "blur(10px)",
      }}
    >
      <button
        onClick={onOpenSidebar}
        className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-black/[0.04] text-[var(--dash-ink-soft)]"
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-2.5 text-[15px] sm:text-[16px] font-bold text-[var(--dash-ink)]">
        <LayoutGrid className="w-[19px] h-[19px] text-[var(--dash-accent)]" />
        <span className="hidden sm:inline">Support Workspace</span>
        <span className="sm:hidden">Workspace</span>
      </div>

      <span className="hidden md:inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--dash-sage)] dash-bg-sage-wash rounded-full px-2.5 py-0.5">
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
          "hidden md:inline-flex items-center gap-1.5 text-[11.5px] font-semibold rounded-full px-2.5 py-0.5 transition-colors",
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

      <div className="hidden md:flex flex-1 max-w-[440px] items-center gap-2.5 dash-bg-card border dash-border rounded-[10px] px-3 py-2 text-[13px] text-[var(--dash-ink-faint)] focus-within:border-[var(--dash-accent)] focus-within:ring-2 focus-within:ring-[var(--dash-accent-wash)] transition">
        <Search className="w-4 h-4 shrink-0" />
        <input
          placeholder="Search tickets, customers or knowledge…"
          className="flex-1 bg-transparent outline-none text-[var(--dash-ink)] placeholder:text-[var(--dash-ink-faint)] text-[13px]"
        />
        <span className="text-[10.5px] font-semibold rounded-[5px] px-1.5 py-0.5 dash-bg-deep text-[var(--dash-ink-soft)]">
          ⌘K
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3.5">
        <button className="relative w-9 h-9 rounded-[9px] border dash-border dash-bg-card hover:dash-shadow-sm hover:-translate-y-px transition flex items-center justify-center">
          <Bell className="w-[17px] h-[17px] text-[var(--dash-ink-soft)]" />
          <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-[var(--dash-rose)] text-white text-[9px] font-bold flex items-center justify-center border-2 border-[var(--dash-card)]">
            3
          </span>
        </button>
        <button className="w-9 h-9 rounded-[9px] border dash-border dash-bg-card hover:dash-shadow-sm hover:-translate-y-px transition flex items-center justify-center">
          <HelpCircle className="w-[17px] h-[17px] text-[var(--dash-ink-soft)]" />
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 pl-1.5 hover:bg-black/[0.04] rounded-lg px-1.5 py-1 transition"
          >
            <span
              className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[12px] font-bold text-white"
              style={{
                background: "linear-gradient(135deg,#8E80E5,#5C4DC1)",
              }}
              aria-hidden
            >
              {initials}
            </span>
            <span className="hidden sm:flex flex-col items-start leading-tight">
              <span className="text-[13px] font-bold text-[var(--dash-ink)]">
                {user?.name || "Sarah Johnson"}
              </span>
              <span className="text-[10.5px] text-[var(--dash-ink-faint)]">
                {user?.role || "Admin"}
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
                  {user?.email || "sarah@acme.co"}
                </div>
              </div>
              <Link
                href="/dashboard/customers"
                className="flex items-center gap-2 px-3.5 py-2 text-[13px] text-[var(--dash-ink-soft)] hover:bg-[var(--dash-accent-wash)] hover:text-[var(--dash-accent-deep)]"
              >
                <User className="w-4 h-4" />
                Profile
              </Link>
              <Link
                href="/dashboard"
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
