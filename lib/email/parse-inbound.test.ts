import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { EmailReceivedEvent, GetReceivingEmailResponseSuccess } from "resend"
import { resetEmailConfigCache } from "./config"
import {
  InboundParseError,
  parseInboundEmail,
  sanitizeInboundHtml,
  sanitizeInboundText,
} from "./parse-inbound"

const CONV_ID = "2d527dc9-828b-442d-9f8c-405287878169"
const DOMAIN = "mail.example.com"
const PROVIDER_ID = "inb_abc123"

function seedEmailEnv() {
  process.env.RESEND_API_KEY = "re_test_key"
  process.env.EMAIL_FROM = `Support <support@${DOMAIN}>`
  process.env.EMAIL_INBOUND_DOMAIN = DOMAIN
  process.env.RESEND_WEBHOOK_SECRET = "whsec_test_secret"
  resetEmailConfigCache()
}

function fixtureWebhook(): EmailReceivedEvent {
  return {
    type: "email.received",
    created_at: "2026-07-02T12:00:00.000Z",
    data: {
      email_id: PROVIDER_ID,
      created_at: "2026-07-02T12:00:00.000Z",
      from: "Customer <customer@startup.io>",
      to: [`reply+${CONV_ID}@${DOMAIN}`],
      bcc: [],
      cc: [],
      received_for: [`reply+${CONV_ID}@${DOMAIN}`],
      message_id: "<inbound-msg@resend.dev>",
      subject: "Re: Billing question",
      attachments: [],
    },
  }
}

function fixtureReceivedEmail(
  overrides: Partial<GetReceivingEmailResponseSuccess> = {},
): GetReceivingEmailResponseSuccess {
  return {
    object: "email",
    id: PROVIDER_ID,
    to: [`reply+${CONV_ID}@${DOMAIN}`],
    from: "customer@startup.io",
    created_at: "2026-07-02T12:00:00.000Z",
    subject: "Re: Billing question",
    bcc: null,
    cc: null,
    reply_to: null,
    received_for: [`reply+${CONV_ID}@${DOMAIN}`],
    html: "<p>Hello support</p>",
    text: "Hello support",
    headers: { "message-id": "<inbound-msg@resend.dev>" },
    message_id: "<inbound-msg@resend.dev>",
    attachments: [],
    ...overrides,
  }
}

describe("parse-inbound", () => {
  beforeEach(seedEmailEnv)
  afterEach(() => {
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_FROM
    delete process.env.EMAIL_INBOUND_DOMAIN
    delete process.env.RESEND_WEBHOOK_SECRET
    resetEmailConfigCache()
  })

  describe("parseInboundEmail", () => {
    it("normalizes webhook + receiving.get into app shape", () => {
      const parsed = parseInboundEmail({
        webhookEvent: fixtureWebhook(),
        receivedEmail: fixtureReceivedEmail(),
      })

      expect(parsed).toEqual({
        conversationId: CONV_ID,
        from: "customer@startup.io",
        subject: "Re: Billing question",
        text: "Hello support",
        html: "<p>Hello support</p>",
        headers: { "message-id": "<inbound-msg@resend.dev>" },
        providerId: PROVIDER_ID,
      })
    })

    it("throws when conversation cannot be resolved from to addresses", () => {
      expect(() =>
        parseInboundEmail({
          webhookEvent: {
            ...fixtureWebhook(),
            data: {
              ...fixtureWebhook().data,
              to: ["support@other.com"],
              received_for: [],
            },
          },
          receivedEmail: fixtureReceivedEmail({
            to: ["support@other.com"],
            received_for: [],
          }),
        }),
      ).toThrow(InboundParseError)
    })
  })

  describe("sanitization", () => {
    it("strips script tags from html fixture payload", () => {
      const dirty =
        '<p>Hi</p><script>alert("xss")</script><p onclick="evil()">Click</p>'
      const clean = sanitizeInboundHtml(dirty)

      expect(clean).not.toContain("<script")
      expect(clean).not.toContain("alert")
      expect(clean).not.toContain("onclick")
      expect(clean).toContain("<p>Hi</p>")
    })

    it("strips iframe/object/embed tags", () => {
      const dirty =
        "<p>ok</p><iframe src=\"https://evil.com\"></iframe><object data=\"x\"></object><embed src=\"y\" />"
      const clean = sanitizeInboundHtml(dirty)
      expect(clean).not.toMatch(/iframe|object|embed/i)
      expect(clean).toContain("ok")
    })

    it("sanitizes text bodies that contain html", () => {
      const clean = sanitizeInboundText('Hello<script>alert(1)</script>')
      expect(clean).toBe("Hello")
    })

    it("sanitizes html in parseInboundEmail output", () => {
      const parsed = parseInboundEmail({
        webhookEvent: fixtureWebhook(),
        receivedEmail: fixtureReceivedEmail({
          html: '<p>Question</p><script document.write("xss")></script>',
          text: null,
        }),
      })

      expect(parsed.html).not.toContain("script")
      expect(parsed.html).toContain("Question")
    })
  })
})
