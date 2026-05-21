"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { DashboardSidebar } from "./sidebar"
import { DashboardTopbar } from "./topbar"
import { getSession, type AdvanSession } from "@/lib/auth"
import { Loader2 } from "lucide-react"

export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [session, setSession] = useState<AdvanSession | null>(null)
  const [checked, setChecked] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const s = getSession()
    if (!s) {
      router.replace("/signin")
      return
    }
    setSession(s)
    setChecked(true)
  }, [router])

  // Close mobile drawer on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  if (!checked) {
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
