/**
 * Shared JWT verification helper for the chat widget session token.
 *
 * The token is issued by POST /api/chat/session and carries:
 *   { orgId, widgetKey, visitorSessionId }
 *
 * This function is the single source of truth for token verification.
 * It is used by:
 *   - POST /api/chat/intake      (HTTP endpoint)
 *   - /chat-widget socket ns     (Socket.IO middleware in chat-widget-namespace.ts)
 *
 * Keeping verification in one place prevents the class of bug where the
 * HTTP intake path trusts client-supplied identifiers that the socket path
 * would reject.
 */

import { jwtVerify } from "jose"

export interface WidgetTokenPayload {
  orgId: string
  widgetKey: string
  visitorSessionId: string
}

function getSigningKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET / NEXTAUTH_SECRET is not configured")
  return new TextEncoder().encode(secret)
}

/**
 * Verify a widget session JWT.
 *
 * Returns the typed payload on success.
 * Throws if the token is missing, malformed, expired, wrong issuer, wrong key,
 * or has incomplete claims.
 */
export async function verifyWidgetToken(rawToken: string): Promise<WidgetTokenPayload> {
  const { payload } = await jwtVerify(rawToken, getSigningKey(), {
    issuer: "advan:chat-session",
  })

  const p = payload as Partial<WidgetTokenPayload>
  if (!p.orgId || !p.widgetKey || !p.visitorSessionId) {
    throw new Error("Invalid token claims: missing orgId, widgetKey, or visitorSessionId")
  }

  return {
    orgId: p.orgId,
    widgetKey: p.widgetKey,
    visitorSessionId: p.visitorSessionId,
  }
}
