import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { EmailReceivedEvent, GetReceivingEmailResponseSuccess } from "resend"
import { Webhook } from "svix"
import { resetEmailConfigCache } from "@/lib/email/config"
import type { InboundRouteDeps } from "./route"

const SECRET = `whsec_${Buffer.from("test-secret-for-svix-signing").toString("base64")}`
const DOMAIN = "mail.example.com"
const CONVERSATION_ID = "2d527dc9-828b-442d-9f8c-405287878169"
const ORG_ID = "90c871c9-828b-442d-9f8c-405287878169"
const TICKET_ID = "a37d9a59-828b-442d-9f8c-405287878169"
const CUSTOMER_ID = "63a10d85-828b-442d-9f8c-405287878169"
const PROVIDER_ID = "inb_abc123"

function seedEnv() {
  process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/advan_test"
  process.env.RESEND_API_KEY = "re_test"
  process.env.EMAIL_FROM = `Support <support@${DOMAIN}>`
  process.env.EMAIL_INBOUND_DOMAIN = DOMAIN
  process.env.RESEND_WEBHOOK_SECRET = SECRET
  delete process.env.ALLOW_UNVERIFIED_SENDER_DEV
  resetEmailConfigCache()
}

function clearEnv() {
  delete process.env.RESEND_API_KEY
  delete process.env.EMAIL_FROM
  delete process.env.EMAIL_INBOUND_DOMAIN
  delete process.env.RESEND_WEBHOOK_SECRET
  delete process.env.ALLOW_UNVERIFIED_SENDER_DEV
  resetEmailConfigCache()
}

function webhookFixture(overrides: Partial<EmailReceivedEvent> = {}): EmailReceivedEvent {
  return {
    type: "email.received",
    created_at: "2026-07-02T12:00:00.000Z",
    data: {
      email_id: PROVIDER_ID,
      created_at: "2026-07-02T12:00:00.000Z",
      from: "Customer <customer@startup.io>",
      to: [`reply+${CONVERSATION_ID}@${DOMAIN}`],
      bcc: [],
      cc: [],
      received_for: [`reply+${CONVERSATION_ID}@${DOMAIN}`],
      message_id: "<inbound-msg@resend.dev>",
      subject: "Re: Billing question",
      attachments: [],
    },
    ...overrides,
  }
}

function receivedEmailFixture(
  overrides: Partial<GetReceivingEmailResponseSuccess> = {},
): GetReceivingEmailResponseSuccess {
  return {
    object: "email",
    id: PROVIDER_ID,
    to: [`reply+${CONVERSATION_ID}@${DOMAIN}`],
    from: "customer@startup.io",
    created_at: "2026-07-02T12:00:00.000Z",
    subject: "Re: Billing question",
    bcc: null,
    cc: null,
    reply_to: null,
    received_for: [`reply+${CONVERSATION_ID}@${DOMAIN}`],
    html: "<p>Hello support</p>",
    text: "Hello support",
    headers: {
      "message-id": "<inbound-msg@resend.dev>",
      "in-reply-to": "<prior-inbound@resend.dev>",
      references: "<prior-inbound@resend.dev>",
    },
    message_id: "<inbound-msg@resend.dev>",
    attachments: [],
    ...overrides,
  }
}

function resolvedConversation(overrides = {}) {
  return {
    conversationId: CONVERSATION_ID,
    orgId: ORG_ID,
    ticketId: TICKET_ID,
    ticketOrgId: ORG_ID,
    ticketStatus: "pending" as const,
    customerId: CUSTOMER_ID,
    customerOrgId: ORG_ID,
    customerEmail: "customer@startup.io",
    ...overrides,
  }
}

function signedRequest(event: EmailReceivedEvent, bodyOverride?: string): Request {
  const body = JSON.stringify(event)
  const timestamp = new Date()
  const id = "msg_test_123"
  const signature = new Webhook(SECRET).sign(id, timestamp, body)

  return new Request("http://localhost/api/webhooks/resend/inbound", {
    method: "POST",
    body: bodyOverride ?? body,
    headers: {
      "content-type": "application/json",
      "svix-id": id,
      "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "svix-signature": signature,
    },
  })
}

async function loadRoute() {
  vi.resetModules()
  return import("./route")
}

async function makeDeps(
  overrides: Partial<InboundRouteDeps> = {},
): Promise<InboundRouteDeps> {
  const route = await loadRoute()
  return {
    verifyWebhook: route.productionDeps.verifyWebhook,
    fetchReceivedEmail: vi.fn(async () => receivedEmailFixture()),
    findExistingInboundEvent: vi.fn(async () => null),
    resolveByReplyAddress: vi.fn(async () => resolvedConversation()),
    resolveByStoredMessageIds: vi.fn(async () => null),
    logEmailEvent: vi.fn(async () => undefined),
    insertInboundMessage: vi.fn(async () => undefined),
    rateLimit: vi.fn(async () => null),
    ...overrides,
  }
}

describe("Resend inbound webhook route", () => {
  beforeEach(seedEnv)
  afterEach(clearEnv)

  it("rejects tampered payloads with Svix verification", async () => {
    const route = await loadRoute()
    const deps = await makeDeps()
    const req = signedRequest(
      webhookFixture(),
      JSON.stringify({
        ...webhookFixture(),
        data: { ...webhookFixture().data, email_id: "inb_tampered" },
      }),
    )

    const res = await route.handleInboundRequest(req, deps)

    expect(res.status).toBe(401)
    expect(deps.fetchReceivedEmail).not.toHaveBeenCalled()
    expect(deps.insertInboundMessage).not.toHaveBeenCalled()
  })

  it("treats duplicate inbound providerId as a no-op", async () => {
    const route = await loadRoute()
    const deps = await makeDeps({
      findExistingInboundEvent: vi.fn(async () => ({ id: "evt_existing" })),
    })

    const res = await route.handleInboundRequest(signedRequest(webhookFixture()), deps)

    expect(res.status).toBe(200)
    expect(deps.fetchReceivedEmail).not.toHaveBeenCalled()
    expect(deps.insertInboundMessage).not.toHaveBeenCalled()
    expect(deps.logEmailEvent).not.toHaveBeenCalled()
  })

  it("blocks sender mismatches without inserting a customer message", async () => {
    const route = await loadRoute()
    const deps = await makeDeps({
      resolveByReplyAddress: vi.fn(async () =>
        resolvedConversation({ customerEmail: "actual-customer@startup.io" }),
      ),
    })

    const res = await route.handleInboundRequest(signedRequest(webhookFixture()), deps)

    expect(res.status).toBe(200)
    expect(deps.insertInboundMessage).not.toHaveBeenCalled()
    expect(deps.logEmailEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: PROVIDER_ID,
        status: "sender_mismatch",
        orgId: ORG_ID,
        conversationId: CONVERSATION_ID,
      }),
    )
  })

  it("blocks org-scoping mismatches before writing messages", async () => {
    const route = await loadRoute()
    const deps = await makeDeps({
      resolveByReplyAddress: vi.fn(async () =>
        resolvedConversation({ ticketOrgId: "aaaaaaaa-828b-442d-9f8c-405287878169" }),
      ),
    })

    const res = await route.handleInboundRequest(signedRequest(webhookFixture()), deps)

    expect(res.status).toBe(200)
    expect(deps.insertInboundMessage).not.toHaveBeenCalled()
    expect(deps.logEmailEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: PROVIDER_ID,
        status: "org_scope_mismatch",
        orgId: ORG_ID,
        conversationId: CONVERSATION_ID,
      }),
    )
  })

  it("scrubs PII from inbound content before storage", async () => {
    const route = await loadRoute()

    expect(
      route.scrubInboundStorageContent(
        "My email is customer@startup.io, phone is 555-123-4567, card is 4242 4242 4242 4242.",
      ),
    ).toBe("My email is [EMAIL], phone is [PHONE], card is [CREDIT_CARD].")
  })
})
