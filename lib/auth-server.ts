/**
 * Server-side auth helper.
 * Import `auth` from here in Server Components, tRPC context,
 * and server actions — never from `next-auth` directly.
 */
export { auth, signIn, signOut } from "@/auth"
