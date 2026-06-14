import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { compare } from "bcryptjs"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { authConfig } from "./auth.config"

/** Trailing slash on NEXTAUTH_URL/AUTH_URL breaks OAuth redirect_uri vs Google Console. */
function normalizePublicAuthUrls() {
  for (const key of ["NEXTAUTH_URL", "AUTH_URL"] as const) {
    const v = process.env[key]
    if (typeof v !== "string") continue
    const trimmed = v.trim().replace(/\/+$/, "")
    if (trimmed && trimmed !== v) process.env[key] = trimmed
  }
}
normalizePublicAuthUrls()

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { email, password } = parsed.data

        const user = await db.query.users.findFirst({
          where: eq(users.email, email.toLowerCase()),
        })

        if (!user?.passwordHash) return null

        const valid = await compare(password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? null,
          orgId: user.orgId,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    authorized: authConfig.callbacks!.authorized!,

    /**
     * After Google (or any provider) returns, Auth.js redirects here.
     * Keep same-origin absolute URLs and relative paths (e.g. /dashboard).
     * Fix redirect_uri_mismatch in Google: set Console URI exactly to
     * `{NEXTAUTH_URL}/api/auth/callback/google` with the same host as the browser.
     */
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`
      try {
        const next = new URL(url)
        const base = new URL(baseUrl)
        if (next.origin === base.origin) return url
      } catch {
        /* ignore */
      }
      return baseUrl
    },

    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false

        const existing = await db.query.users.findFirst({
          where: eq(users.email, user.email),
        })

        if (!existing) {
          // Google users must be provisioned by an admin (or via seed)
          return "/signin?error=AccountNotFound"
        }

        ;(user as any).orgId = existing.orgId
        ;(user as any).role = existing.role
        user.id = existing.id
      }
      return true
    },

    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.orgId = (user as any).orgId
        token.role = (user as any).role
      }
      return token
    },

    session({ session, token }) {
      session.user.id = token.id
      session.user.orgId = token.orgId
      session.user.role = token.role
      return session
    },
  },
})
