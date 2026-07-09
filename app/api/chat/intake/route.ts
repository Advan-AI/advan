/**
 * Public chat intake endpoint.
 *
 * POST /api/chat/intake
 *
 * Accepts a visitor message from the embedded chat widget and funnels it
 * through the shared auto-intake pipeline (creates/resolves customer,
 * ticket, and conversation; inserts the user message; enqueues the
 * copilot-triage job).
 *
 * Online mode (agent available):
 *   The caller should then connect to the /chat-widget Socket.IO namespace
 *   with handshake.auth = { token, conversationId } to receive real-time
 *   events:
 *     agent:message   — AI auto-replied or human agent sent a reply
 *     triage:pending  — Escalated; show "an agent will respond shortly"
 *
 * Offline mode (no agent online + pre-chat form submitted):
 *   Pass `visitorEmail` and optionally `visitorName`.  The intake creates
 *   the customer with their email address and marks the conversation as
 *   chatOfflineDelivery=true so the triage worker routes the first reply
 *   through the existing email path (same suppression / deliverability
 *   checks as a literal email ticket).
 *   When an agent comes online later and the visitor reconnects, the
 *   /chat-widget namespace handler clears chatOfflineDelivery, restoring
 *   live socket delivery for subsequent messages.
 *
 * Authentication: NONE — intentionally unauthenticated so the public widget
 * can submit messages without a session. Rate-limited per IP below.
 *
 * Security notes:
 *   - orgId must be a valid UUID; invalid values produce 400.
 *   - Content is capped at 8 000 characters and trimmed.
 *   - PII masking and HTML sanitization happen inside processVisitorMessage.
 *   - visitorSessionId is scoped to orgId — two orgs can share a session ID
 *     without collision (customer lookup is always org-scoped).
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { resolveOrCreateIntake } from "@/lib/tickets/auto-intake"
import { isOrgChatAccepting } from "@/lib/realtime/event-bus"
import { sanitizeInboundText } from "@/lib/email/parse-inbound"
import { PIIMasker } from "@/lib/governance/pii-masker"

export const runtime = "nodejs"

// ─── Rate limiting (best-effort, in-memory) ───────────────────────────────────

const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 30 // messages per window per IP

type WindowEntry = { count: number; resetAt: number }
const rateBuckets = new Map<string, WindowEntry>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateBuckets.get(ip)
  if (!entry || now > entry.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count += 1
  return true
}

// Prune stale entries periodically so the map doesn't grow unboundedly.
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateBuckets) {
    if (now > entry.resetAt) rateBuckets.delete(key)
  }
}, RATE_WINDOW_MS * 5)

// ─── Input schema ─────────────────────────────────────────────────────────────

const IntakeSchema = z.object({
  /** Public org identifier; supplied by the widget embed script. */
  orgId: z.string().uuid({ message: "orgId must be a valid UUID" }),
  /** Message text from the visitor. */
  content: z.string().min(1, "content is required").max(8000).trim(),
  /**
   * Visitor session identifier (browser-generated UUID from localStorage).
   * Correlates follow-up messages from the same visitor into one open ticket.
   * Generated server-side when omitted.
   */
  visitorSessionId: z.string().min(1).max(128).optional(),
  /** Optional subject line; falls back to the first 120 chars of content. */
  subject: z.string().max(255).optional(),
  /**
   * Pre-chat form: visitor's email address.
   * Required when the widget is in offline mode (no agents online).
   * Stored on the customer row and used to deliver the agent reply via email.
   * Must pass standard email validation; common disposable domains are NOT
   * filtered here — that is a policy concern for the notification worker.
   */
  visitorEmail: z.string().trim().email("visitorEmail must be a valid email").optional(),
  /**
   * Pre-chat form: visitor's display name (optional).
   * Stored as customers.name when creating a new visitor customer row.
   */
  visitorName: z.string().trim().max(120).optional(),
})

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Rate limit ─────────────────────────────────────────────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anonymous"

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = IntakeSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { orgId, content, visitorSessionId, subject, visitorEmail, visitorName } = parsed.data

  // ── Sanitize content ───────────────────────────────────────────────────────
  // Same two-pass pipeline as the socket-based processVisitorMessage.
  const sanitized = PIIMasker.mask(sanitizeInboundText(content))

  // ── Determine delivery mode ────────────────────────────────────────────────
  // Check agent availability from Redis (maintained by the socket server).
  // Falls back to false (offline) on Redis unavailability so the email path
  // is used as the safe default rather than silently dropping replies.
  const agentsOnline = await isOrgChatAccepting(orgId)
  const offlineMode = !agentsOnline

  // When no agents are online and the visitor provides their email, mark the
  // conversation for email-based delivery.  The widget MUST collect visitorEmail
  // when both preChatFormEnabled=true and agentsOnline=false (enforced client-
  // side); we accept it here without requiring it so the intake endpoint stays
  // backward-compatible for direct API callers.
  const chatOfflineDelivery = offlineMode && Boolean(visitorEmail)

  const sessionId = visitorSessionId ?? `anon-${crypto.randomUUID()}`

  // ── Intake ─────────────────────────────────────────────────────────────────
  try {
    const customerIdentifier =
      visitorEmail
        ? { visitorSessionId: sessionId, email: visitorEmail }
        : { visitorSessionId: sessionId }

    const result = await resolveOrCreateIntake({
      orgId,
      channel: "chat",
      customerIdentifier,
      content: sanitized,
      subject,
      customerName: visitorName,
      chatOfflineDelivery,
    })

    return NextResponse.json(
      {
        conversationId: result.conversationId,
        messageId: result.messageId,
        ticketId: result.ticketId,
        isNewTicket: result.isNewTicket,
        offlineMode: chatOfflineDelivery,
        status: "received",
      },
      { status: 202 }
    )
  } catch (err) {
    console.error("[ChatIntake] Error processing message:", (err as Error).message)
    return NextResponse.json(
      { error: "Failed to process message. Please try again." },
      { status: 500 }
    )
  }
}
