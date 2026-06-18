"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { httpBatchLink, loggerLink } from "@trpc/client"
import { SessionProvider } from "next-auth/react"
import { usePathname } from "next/navigation"
import { api } from "@/lib/api/trpc-client"

function getBaseUrl() {
  if (typeof window !== "undefined") return ""
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return `http://localhost:${process.env.PORT ?? 3000}`
}

/**
 * Root providers wrapper:
 * - SessionProvider  (NextAuth v5 — Phase 1)
 * - QueryClientProvider (TanStack Query — Phase 3)
 * - TRPCProvider (tRPC React — Phase 3)
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const needsSession = pathname?.startsWith("/dashboard") || pathname?.startsWith("/signin")
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
          enabled: (opts) =>
            process.env.NODE_ENV === "development" ||
            (opts.direction === "down" && opts.result instanceof Error),
        }),
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
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
