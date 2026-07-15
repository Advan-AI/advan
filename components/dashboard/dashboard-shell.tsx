"use client"

import { type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { AnimatePresence, motion } from "framer-motion"
import { useState, useEffect } from "react"
import Link from "next/link"
import { DashboardSidebar } from "./sidebar"
import { DashboardTopbar } from "./topbar"
import { Loader2 } from "lucide-react"
import { useBillingRestriction } from "@/hooks/use-billing-restriction"

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { isRestricted, subscriptionStatus } = useBillingRestriction()

  // Close mobile drawer on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Auth is enforced by proxy.ts — this handles the loading skeleton
  if (status === "loading") {
    return (
      <div className="min-h-screen dash-shell flex">
        <aside className="hidden lg:flex w-[228px] shrink-0 dash-bg-sidebar border-r dash-border h-screen flex-col gap-3 p-4">
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
        <div className="flex-1 flex flex-col">
          <div className="h-[66px] flex items-center gap-3 px-6 border-b dash-border">
            <div className="skeleton h-5 w-36" />
            <div className="ml-auto flex items-center gap-3">
              <div className="skeleton w-9 h-9 rounded-lg" />
              <div className="skeleton w-9 h-9 rounded-full" />
            </div>
          </div>
          <div className="flex-1 p-6 flex flex-col gap-4">
            <div className="skeleton h-8 w-72 rounded" />
            <div className="skeleton h-4 w-96 rounded" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
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
    <div className="dash-shell flex min-h-screen">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
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
            />
            <motion.div
              key="drawer"
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
            >
              <DashboardSidebar />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">
        <DashboardTopbar
          user={session?.user ?? null}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
        {isRestricted && (
          <div className="mx-4 sm:mx-6 mt-4 p-4 rounded-xl border border-amber-200/50 bg-amber-50/70 dark:bg-amber-950/20 backdrop-blur-sm text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-start sm:items-center gap-3">
              <span className="text-xl" role="img" aria-label="warning">⚠️</span>
              <div className="text-[13px] leading-relaxed">
                <span className="font-bold">Billing Alert:</span> Your subscription is <span className="font-semibold underline capitalize">{subscriptionStatus}</span>. Knowledge Base uploads, workflow editing, and team invites are locked. Inbound ticketing, chat triage, and copilot remain fully operational.
              </div>
            </div>
            <Link
              href="/dashboard/billing"
              className="shrink-0 text-center text-[12.5px] font-bold px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors"
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
          className="flex-1 px-4 sm:px-6 py-5"
        >
          {children}
        </motion.div>
      </div>
    </div>
  )
}
