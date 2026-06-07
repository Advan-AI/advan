import type { NextAuthConfig } from "next-auth"

/**
 * Shared auth config (pages, session strategy, `authorized` callback).
 * Merged into `auth.ts` with providers. `proxy.ts` imports `auth` from there
 * so the proxy and API routes use one NextAuth instance.
 */
export const authConfig: NextAuthConfig = {
  /** Explicit for prod behind proxies; dev is trusted via env defaults too */
  trustHost: true,
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard")
      if (isOnDashboard) return isLoggedIn
      return true
    },
  },
  providers: [],
}
