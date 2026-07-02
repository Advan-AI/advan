import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { EmailBouncedEvent } from "resend"
import { Webhook } from "svix"
import type { ResendEventsDeps } from "./route"

const SECRET = `whsec_${Buffer.from("test-secret-for-resend-events").toString("base64")}`
const ORG_ID = "90c871c9-828b-442d-9f8c-405287878169"
const CONVERSATION_ID = "2d527dc9-828b-442d-9f8c-405287878169"
const MESSAGE_ID = "a37d9a59-828b-442d-9f8c-405287878169"
const RESEND_ID = "re_abc123"
const CUSTOMER_EMAIL = "customer@startup.io"

function seedEnv() {
  process.env.RESEND_WEBHOOK_SECRET = SECRET
  process.env.RESEND_API_KEY = "re_test"
  process.env.EMAIL_FROM = "Support <support@mail.example.com>"
  process.env.EMAIL_INBOUND_DOMAIN = "mail.example.com"
}

function clearEnv() {
  delete process.env.RESEND_WEBHOOK_SECRET
  delete process.env.RESEND_API_KEY
  delete process.env.EMAIL_FROM
  delete process.env.EMAIL_INBOUND_DOMAIN
}

function bounceFixture(): EmailBouncedEvent {
  return {
    type: "email.bounced",
    created_at: "2026-07-02T12:00:00.000Z",
    data: {
      email_id: RESEND_ID,
      created_at: "2026-07-02T12:00:00.000Z",
      from: "Support <support@mail.example.com>",
      to: [CUSTOMER_EMAIL],
      subject: "Re: Billing question",
      bounce: {
        type: "hard",
        subType: "General",
        message: "Mailbox does not exist",
      },
    },
  }
}

function signedRequest(event: EmailBouncedEvent): Request {
  const body = JSON.stringify(event)
  const timestamp = new Date()
  const id = "msg_events_test_123"
  const signature = new Webhook(SECRET).sign(id, timestamp, body)

  return new Request("http://localhost/api/webhooks/resend/events", {
    method: "POST",
    body,
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
  overrides: Partial<ResendEventsDeps> = {},
): Promise<ResendEventsDeps> {
  const route = await loadRoute()
  return {
    verifyWebhook: route.productionDeps.verifyWebhook,
    findExistingEvent: vi.fn(async () => null),
    resolveOutboundByResendId: vi.fn(async () => ({
      orgId: ORG_ID,
      conversationId: CONVERSATION_ID,
      messageId: MESSAGE_ID,
      customerEmail: CUSTOMER_EMAIL,
      metadata: { email: { resendId: RESEND_ID, deliveryStatus: "sent" as const } },
    })),
    updateMessageDelivery: vi.fn(async () => undefined),
    logEmailEvent: vi.fn(async () => undefined),
    suppressRecipient: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe("Resend delivery events webhook", () => {
  beforeEach(seedEnv)
  afterEach(() => {
    clearEnv()
    vi.restoreAllMocks()
  })

  it("hard bounce events suppress the recipient and mark the message bounced", async () => {
    const route = await loadRoute()
    const deps = await makeDeps()

    const res = await route.handleResendEventRequest(signedRequest(bounceFixture()), deps)

    expect(res.status).toBe(200)
    expect(deps.resolveOutboundByResendId).toHaveBeenCalledWith(RESEND_ID)
    expect(deps.updateMessageDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ messageId: MESSAGE_ID }),
      "bounced",
      "Mailbox does not exist",
    )
    expect(deps.suppressRecipient).toHaveBeenCalledWith({
      orgId: ORG_ID,
      email: CUSTOMER_EMAIL,
      reason: "bounce",
    })
    expect(deps.logEmailEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: `${RESEND_ID}:email.bounced`,
        status: "email.bounced",
      }),
    )
  })

  it("refuses future sends to a suppressed recipient before calling Resend", async () => {
    vi.resetModules()
    const sendMock = vi.fn()

    vi.doMock("@/lib/email/suppression", () => ({
      findSuppressedEmail: vi.fn(async () => ({
        id: "suppressed-1",
        orgId: ORG_ID,
        email: CUSTOMER_EMAIL,
        reason: "bounce",
        createdAt: new Date(),
      })),
    }))

    vi.doMock("@/lib/email/resend-client", () => ({
      getResendClient: () => ({
        emails: { send: sendMock },
      }),
    }))

    const { sendAgentReply } = await import("@/lib/email/send-agent-reply")

    await expect(
      sendAgentReply({
        orgId: ORG_ID,
        conversationId: CONVERSATION_ID,
        to: CUSTOMER_EMAIL,
        ticketSubject: "Billing question",
        agentMessage: "Hello",
      }),
    ).rejects.toMatchObject({
      code: "recipient_suppressed",
      retryable: false,
      message: "Recipient suppressed",
    })

    expect(sendMock).not.toHaveBeenCalled()
  })
})
