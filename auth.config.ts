import type { NextAuthConfig } from "next-auth"

/**
 * Edge-compatible auth config — no Node.js-only modules.
 * Used by middleware.ts for route protection on the Vercel Edge.
 * Full config (with DB + bcrypt) lives in auth.ts.
 */
export const authConfig: NextAuthConfig = {
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
