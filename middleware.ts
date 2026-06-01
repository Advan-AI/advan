import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

/**
 * Middleware using the edge-compatible authConfig.
 * Protects /dashboard/* routes — redirects to /signin if unauthenticated.
 */
export const { auth: middleware } = NextAuth(authConfig)

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|icon.svg|apple-icon.png).*)",
  ],
}
