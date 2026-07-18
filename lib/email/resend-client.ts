import { Resend } from "resend"
import { requireEmailConfig } from "./config"

let client: Resend | null = null

/** Singleton Resend SDK client (lazy — validates env on first use). */
export function getResendClient(): Resend {
  if (!client) {
    const { apiKey } = requireEmailConfig()
    client = new Resend(apiKey)
  }
  return client
}

/** Reset singleton (tests only). */
export function resetResendClient(): void {
  client = null
}
