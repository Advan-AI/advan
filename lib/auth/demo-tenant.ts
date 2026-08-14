/**
 * Default demo tenant used by seed, Supabase bootstrap SQL, and auto-login.
 * Keep these in sync with lib/db/seed.ts.
 */
export const DEMO_TENANT = {
  orgName: "Acme Corp",
  orgSlug: "acme",
  inboundEmailAlias: "support+acme",
  adminEmail: "admin@acme.co",
  adminName: "Sarah Johnson",
  adminPassword: "password123",
  agentEmail: "agent@acme.co",
  agentName: "James Carter",
} as const

export function isDemoAutoLoginEnabled(): boolean {
  const raw = process.env.DEMO_AUTO_LOGIN?.trim().toLowerCase()
  if (raw === "false" || raw === "0") return false
  if (raw === "true" || raw === "1") return true
  // Public demo + local: dashboard is open without a login form.
  return true
}

export function demoLoginEmail(): string {
  return (process.env.DEMO_LOGIN_EMAIL ?? DEMO_TENANT.adminEmail).trim().toLowerCase()
}
