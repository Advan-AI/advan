"use client"
import { type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { AnimatePresence, motion } from "framer-motion"
import { useState, useEffect } from "react"
import Link from "next/link"
import { DashboardSidebar } from "./sidebar"
import { DashboardTopbar } from "./topbar"
import { Loader2, MessageSquare, X } from "lucide-react"
import { useBillingRestriction } from "@/hooks/use-billing-restriction"
import { api } from "@/lib/api/trpc-client"
import { useNotifications, stopFlashingBrowserTab } from "@/lib/realtime/notifications-store"
import { useCopilot } from "@/lib/copilot/store"
import * as SocketIO from "socket.io-client"

const getDashSocketUrl = () => {
  const envUrl = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SOCKET_URL : null;
  if (envUrl && !envUrl.includes("localhost:3002") && !envUrl.includes("127.0.0.1:3002")) {
    return envUrl;
  }
  if (typeof window === "undefined") return "http://localhost:3002";
  const isLocal = window.location.hostname === "localhost" ||
                  window.location.hostname === "127.0.0.1" ||
                  window.location.hostname === "0.0.0.0";
  return isLocal
    ? `${window.location.protocol}//${window.location.hostname}:3002`
    : `${window.location.protocol}//${window.location.hostname}`;
};

const DASH_SOCKET_URL = getDashSocketUrl();

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, status } = useSession()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { isRestricted, subscriptionStatus } = useBillingRestriction()

  const { data: onboarding, isLoading: onboardingLoading } = api.auth.getOnboardingStatus.useQuery(undefined, {
    enabled: status === "authenticated",
    refetchOnWindowFocus: false,
    retry: false,
  })

  // ── Global real-time notification listener (Facebook style) ──────────────────────
  const addNotification = useNotifications((s) => s.addNotification)
  const activeToast = useNotifications((s) => s.activeToast)
  const dismissToast = useNotifications((s) => s.dismissToast)
  const orgId = session?.user?.orgId

  // Connect socket.io globally for real-time customer messages
  useEffect(() => {
    if (!orgId) return

    let sock: ReturnType<typeof SocketIO.connect> | null = null
    try {
      sock = SocketIO.connect(DASH_SOCKET_URL, {
        auth: { orgId },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 8,
      })
    } catch (e) {
      console.error("Global socket init failed:", e)
      return
    }

    sock.on("visitor:message", (d: { conversationId: string; content: string }) => {
      const currentActiveId = useCopilot.getState().activeConversationId

      // If the agent is on the conversations page looking at this exact conversation, do not notify!
      if (currentActiveId === d.conversationId) {
        return
      }

      // Add to global notification store
      addNotification({
        conversationId: d.conversationId,
        channel: "chat",
        content: d.content,
      })
    })

    sock.on("customer:message", (d: {
      conversationId: string
      channel: "email" | "chat" | "voice" | "slack" | "portal"
      content: string
      customerName?: string | null
      customerEmail?: string | null
    }) => {
      const currentActiveId = useCopilot.getState().activeConversationId

      if (currentActiveId === d.conversationId) {
        return
      }

      addNotification({
        conversationId: d.conversationId,
        channel: d.channel,
        content: d.content,
        customerName: d.customerName ?? undefined,
        customerEmail: d.customerEmail ?? null,
      })
    })

    return () => {
      sock?.disconnect()
    }
  }, [orgId, addNotification])

  // Automatically dismiss toast after 6 seconds
  useEffect(() => {
    if (!activeToast) return
    const timer = setTimeout(() => {
      dismissToast()
    }, 6000)
    return () => clearTimeout(timer)
  }, [activeToast, dismissToast])

  // Stop browser tab flashing when focus/activity transitions
  useEffect(() => {
    const handleFocus = () => stopFlashingBrowserTab()
    window.addEventListener("focus", handleFocus)
    return () => {
      window.removeEventListener("focus", handleFocus)
    }
  }, [])

  // Close mobile drawer on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Esc + body scroll lock while mobile nav is open
  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false)
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [sidebarOpen])

  useEffect(() => {
    if (status === "authenticated" && onboarding?.isPending) {
      router.push("/onboarding")
    }
  }, [status, onboarding, router])

  // Auth is enforced by proxy.ts — this handles the loading skeleton
  if (status === "loading" || (status === "authenticated" && onboardingLoading)) {
    return (
      <div className="min-h-dvh min-h-screen dash-shell flex">
        <aside className="hidden lg:flex w-[var(--dash-sidebar-w,14.25rem)] shrink-0 dash-bg-sidebar border-r dash-border h-dvh h-screen flex-col gap-3 p-4">
          <div className="flex items-center gap-2.5">
            <div className="skeleton w-9 h-9 rounded-[9px]" />
            <div className="skeleton h-5 w-20 rounded" />
          </div>
          <div className="flex flex-col gap-2 mt-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="skeleton h-8 w-full rounded-lg" />
            ))}
          </div>
          <div className="mt-auto skeleton h-24 w-full rounded-xl" />
        </aside>
        <div className="dash-main">
          <div className="h-[var(--dash-topbar-h,66px)] flex items-center gap-3 px-4 sm:px-6 border-b dash-border">
            <div className="skeleton h-5 w-28 sm:w-36" />
            <div className="ml-auto flex items-center gap-3">
              <div className="skeleton w-9 h-9 rounded-lg" />
              <div className="skeleton w-9 h-9 rounded-full" />
            </div>
          </div>
          <div className="dash-page flex flex-col gap-4">
            <div className="skeleton h-8 w-48 sm:w-72 rounded" />
            <div className="skeleton h-4 w-64 sm:w-96 max-w-full rounded" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-24 rounded-xl" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
              <div className="skeleton h-64 rounded-xl" />
              <div className="skeleton h-64 rounded-xl" />
            </div>
          </div>
        </div>
        <span className="sr-only" role="status">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading workspace
        </span>
      </div>
    )
  }

  return (
    <div className="dash-shell flex min-h-dvh min-h-screen">
      {/* Desktop sidebar */}
      <div className="hidden lg:block shrink-0 h-dvh h-screen sticky top-0">
        <DashboardSidebar />
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-hidden
            />
            <motion.div
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 left-0 z-50 w-[min(20rem,88vw)] max-w-[20rem] lg:hidden shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
            >
              <DashboardSidebar onNavigate={() => setSidebarOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="dash-main">
        <DashboardTopbar
          user={session?.user ?? null}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
        {isRestricted && (
          <div className="mx-[max(1rem,env(safe-area-inset-left))] sm:mx-6 mt-3 sm:mt-4 p-3 sm:p-4 rounded-xl border border-amber-200/50 bg-amber-50/70 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <span className="text-xl shrink-0" role="img" aria-label="warning">⚠️</span>
              <div className="text-[12.5px] sm:text-[13px] leading-relaxed">
                <span className="font-bold">Billing Alert:</span> Your subscription is <span className="font-semibold underline capitalize">{subscriptionStatus}</span>. Knowledge Base uploads, workflow editing, and team invites are locked. Inbound ticketing, chat triage, and copilot remain fully operational.
              </div>
            </div>
            <Link
              href="/dashboard/billing"
              className="shrink-0 text-center text-[12.5px] font-bold px-4 py-2 sm:py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors"
            >
              Update Billing
            </Link>
          </div>
        )}
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="dash-page"
        >
          {children}
        </motion.div>
      </div>

      {/* Global Facebook-style Messenger Alert Toast (Expert UI/UX) */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, x: 100, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 120, scale: 0.85 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed z-[9999] left-3 right-3 bottom-[max(1.25rem,env(safe-area-inset-bottom))] sm:left-auto sm:right-6 sm:bottom-6 sm:w-full sm:max-w-[22.5rem] rounded-xl border border-indigo-200 bg-[#FCFBF8]/95 p-4 shadow-[0_12px_40px_rgba(107,92,214,0.15)] backdrop-blur-md font-sans border-l-4 border-l-[var(--dash-accent)]"
          >
            <div className="flex gap-3">
              {/* Avatar with live pulse status */}
              <div className="relative shrink-0">
                <span className="w-[42px] h-[36px] sm:w-[42px] sm:h-[42px] rounded-full flex items-center justify-center text-[13px] font-bold text-white bg-gradient-to-br from-indigo-400 to-purple-600 shrink-0">
                  {activeToast.customerName
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase() || "WV"}
                </span>
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#22c55e] border-2 border-white animate-ping" />
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#22c55e] border-2 border-white" />
              </div>

              {/* Message Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold tracking-wider text-[var(--dash-accent-deep)] uppercase">
                    {activeToast.channel === "email" ? "New Email Message" : "New Live Message"}
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e] animate-ping" />
                </div>
                <h4 className="mt-0.5 text-xs font-bold text-[var(--dash-ink)] truncate">
                  {activeToast.customerName}
                </h4>
                <p className="mt-1 text-xs text-[var(--dash-ink-soft)] italic line-clamp-2 bg-black/[0.02] border-l-2 border-[var(--dash-accent-wash)] pl-2 py-0.5">
                  "{activeToast.content}"
                </p>
              </div>

              {/* Action Close */}
              <button
                onClick={dismissToast}
                className="h-6 w-6 shrink-0 rounded-full hover:bg-black/[0.04] flex items-center justify-center text-[var(--dash-ink-faint)] hover:text-[var(--dash-ink)] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Accept / Open Actions */}
            <div className="mt-3.5 flex items-center justify-end gap-2 text-[12px]">
              <button
                onClick={dismissToast}
                className="px-3 py-1.5 rounded-lg font-semibold text-[var(--dash-ink-soft)] hover:bg-black/[0.04] transition"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  const targetId = activeToast.conversationId
                  dismissToast()
                  stopFlashingBrowserTab()
                  router.push(`/dashboard/conversations?conversationId=${targetId}`)
                }}
                className="px-4 py-1.5 rounded-lg bg-[var(--dash-accent)] hover:bg-[var(--dash-accent-deep)] text-white font-bold transition shadow-md shadow-[rgba(107,92,214,0.2)] hover:shadow-[rgba(107,92,214,0.3)] hover:-translate-y-px"
              >
                Reply Now
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
