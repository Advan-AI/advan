/* Lightweight client-side mock auth for the Advan dashboard demo.
 * - Persists "signed-in" state in localStorage.
 * - Stores a minimal user profile.
 * - In a real implementation, swap these for server actions / NextAuth /
 *   Supabase / Clerk etc.
 */

const STORAGE_KEY = "advan-auth"

export interface AdvanUser {
  name: string
  email: string
  role: string
  avatarSeed?: string
}

export interface AdvanSession {
  signedInAt: string
  user: AdvanUser
}

export function isBrowser(): boolean {
  return typeof window !== "undefined"
}

export function getSession(): AdvanSession | null {
  if (!isBrowser()) return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AdvanSession
  } catch {
    return null
  }
}

export function isAuthed(): boolean {
  return getSession() !== null
}

export function signInWithEmail(email: string): AdvanSession {
  const trimmed = email.trim().toLowerCase()
  const localPart = trimmed.split("@")[0] || "agent"
  const niceName = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ") || "Sarah Johnson"

  const session: AdvanSession = {
    signedInAt: new Date().toISOString(),
    user: {
      name: niceName,
      email: trimmed || "sarah@acme.co",
      role: "Admin",
      avatarSeed: niceName,
    },
  }
  if (isBrowser()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  }
  return session
}

export function signInWithGoogle(): AdvanSession {
  // Mock Google sign in — returns a canned user.
  const session: AdvanSession = {
    signedInAt: new Date().toISOString(),
    user: {
      name: "Sarah Johnson",
      email: "sarah.johnson@acme.co",
      role: "Admin",
      avatarSeed: "Sarah Johnson",
    },
  }
  if (isBrowser()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  }
  return session
}

export function signOut(): void {
  if (!isBrowser()) return
  window.localStorage.removeItem(STORAGE_KEY)
}
