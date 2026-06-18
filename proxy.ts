import { auth } from "@/auth"

/**
 * Next.js 16+ network proxy (replaces middleware.ts).
 *
 * Uses the same NextAuth instance as `app/api/auth/[...nextauth]/route.ts`.
 *
 * **Matcher: `/dashboard` only** — matches `auth.config`’s `authorized()` logic
 * (only `/dashboard` requires a session). Running `auth()` on `/signin`, `/`,
 * or other routes makes Auth.js call `getSession()`, which **internally fetches**
 * `/api/auth/session`. That loopback request often fails in dev (`localhost` →
 * IPv6 `::1` vs server on `127.0.0.1`) and logs `[auth][error] TypeError: fetch failed`
 * next to unrelated `GET /api/auth/csrf 200` lines.
 *
 * Still exclude `/api/auth/*` if you broaden this matcher later (avoids re-entry).
 */
export const proxy = auth

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
}
