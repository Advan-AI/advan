/**
 * Email integration env config (Resend).
 * When RESEND_API_KEY is set, all vars below are required — missing values throw
 * at first access so misconfiguration is never silent.
 */

const REQUIRED_WHEN_ENABLED = [
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "EMAIL_INBOUND_DOMAIN",
  "RESEND_WEBHOOK_SECRET",
] as const

export type EmailEnvKey = (typeof REQUIRED_WHEN_ENABLED)[number]

export interface EmailConfig {
  apiKey: string
  from: string
  inboundDomain: string
  webhookSecret: string
  /**
   * Public-facing address customers use for first contact, e.g.
   * support@toliooldei.resend.app. Informational — used in outbound email
   * footers and UI copy. Set EMAIL_INBOUND_SUPPORT_ADDRESS in .env.
   */
  supportAddress?: string
  /**
   * Org ID used as fallback when an inbound email cannot be matched to an
   * existing conversation via reply-to address or message-id headers.
   * Set EMAIL_INBOUND_DEFAULT_ORG_ID in .env to enable first-contact routing.
   */
  defaultOrgId?: string
}

export class EmailConfigError extends Error {
  readonly missing: EmailEnvKey[]

  constructor(message: string, missing: EmailEnvKey[] = []) {
    super(message)
    this.name = "EmailConfigError"
    this.missing = missing
  }
}

let cachedConfig: EmailConfig | null = null

export function isEmailFeatureEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(env.RESEND_API_KEY?.trim())
}

function findMissingVars(env: NodeJS.ProcessEnv): EmailEnvKey[] {
  return REQUIRED_WHEN_ENABLED.filter((key) => !env[key]?.trim())
}

/**
 * Load and validate email config. Throws EmailConfigError when the feature is
 * enabled (RESEND_API_KEY set) but any companion var is missing.
 */
export function getEmailConfig(
  env: NodeJS.ProcessEnv = process.env,
): EmailConfig {
  if (!isEmailFeatureEnabled(env)) {
    throw new EmailConfigError(
      "Email feature is disabled. Set RESEND_API_KEY to enable outbound/inbound mail.",
    )
  }

  const missing = findMissingVars(env)
  if (missing.length > 0) {
    throw new EmailConfigError(
      `Email feature is enabled but required environment variables are missing: ${missing.join(", ")}. ` +
        "Set all of RESEND_API_KEY, EMAIL_FROM, EMAIL_INBOUND_DOMAIN, and RESEND_WEBHOOK_SECRET.",
      missing,
    )
  }

  return {
    apiKey: env.RESEND_API_KEY!.trim(),
    from: env.EMAIL_FROM!.trim(),
    inboundDomain: env.EMAIL_INBOUND_DOMAIN!.trim().toLowerCase(),
    webhookSecret: env.RESEND_WEBHOOK_SECRET!.trim(),
    supportAddress: env.EMAIL_INBOUND_SUPPORT_ADDRESS?.trim() || undefined,
    defaultOrgId: env.EMAIL_INBOUND_DEFAULT_ORG_ID?.trim() || undefined,
  }
}

/** Cached config for process lifetime — validates once on first call. */
export function requireEmailConfig(): EmailConfig {
  if (!cachedConfig) {
    cachedConfig = getEmailConfig()
  }
  return cachedConfig
}

/** Reset cached config (tests only). */
export function resetEmailConfigCache(): void {
  cachedConfig = null
}
