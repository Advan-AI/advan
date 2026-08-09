"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { httpBatchLink, loggerLink } from "@trpc/client"
import { SessionProvider } from "next-auth/react"
import { usePathname } from "next/navigation"
import { api } from "@/lib/api/trpc-client"

function normalizeTrpcEndpoint(raw?: string) {
  const value = raw?.trim()
  if (!value) return "/api/trpc"

  // Allow either a full endpoint URL (.../api/trpc) or just the origin.
  if (value.endsWith("/api/trpc")) {
    return value.replace(/\/$/, "")
  }

  return `${value.replace(/\/$/, "")}/api/trpc`
}

function getTrpcUrl() {
  // Preferred in split deployments (frontend on Vercel, API on Cloud Run).
  if (process.env.NEXT_PUBLIC_TRPC_URL) {
    return normalizeTrpcEndpoint(process.env.NEXT_PUBLIC_TRPC_URL)
  }

  // Backward compatibility for older env naming.
  if (process.env.NEXT_PUBLIC_API_URL) {
    return normalizeTrpcEndpoint(process.env.NEXT_PUBLIC_API_URL)
  }

  // Default same-origin for single-deployment setups.
  return "/api/trpc"
}

/**
 * Root providers wrapper:
 * - SessionProvider  (NextAuth v5 — Phase 1)
 * - QueryClientProvider (TanStack Query — Phase 3)
 * - TRPCProvider (tRPC React — Phase 3)
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const needsSession =
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/signin") ||
    pathname?.startsWith("/onboarding") ||
    // /billing/success calls useSession() (see app/billing/success/page.tsx)
    pathname?.startsWith("/billing")
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
          },
        },
      })
  )

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: (opts) => {
            // Keep logger output local-only. In production, rely on server logs and
            // explicit UI error states instead of browser console noise.
            if (process.env.NODE_ENV !== "development") return false
            return opts.direction === "up" || (opts.direction === "down" && opts.result instanceof Error)
          },
        }),
        httpBatchLink({
          url: getTrpcUrl(),
          fetch(url, options) {
            return fetch(url, { ...options, credentials: "include" })
          },
        }),
      ],
    })
  )

  const content = (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </api.Provider>
  )

  return needsSession ? <SessionProvider>{content}</SessionProvider> : content
}
