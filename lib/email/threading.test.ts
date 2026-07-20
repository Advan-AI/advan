import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { resetEmailConfigCache } from "./config"
import {
  buildMessageId,
  buildReplyToAddress,
  buildThreadingHeaders,
  extractConversationIdFromAddresses,
  parseReplyToLocalPart,
} from "./threading"

const CONV_ID = "2d527dc9-828b-442d-9f8c-405287878169"
const DOMAIN = "mail.example.com"

function seedEmailEnv() {
  process.env.RESEND_API_KEY = "re_test_key"
  process.env.EMAIL_FROM = `Support <support@${DOMAIN}>`
  process.env.EMAIL_INBOUND_DOMAIN = DOMAIN
  process.env.RESEND_WEBHOOK_SECRET = "whsec_test_secret"
  resetEmailConfigCache()
}

describe("threading", () => {
  beforeEach(seedEmailEnv)
  afterEach(() => {
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_FROM
    delete process.env.EMAIL_INBOUND_DOMAIN
    delete process.env.RESEND_WEBHOOK_SECRET
    resetEmailConfigCache()
  })

  describe("buildReplyToAddress", () => {
    it("builds plus-address on inbound domain", () => {
      expect(buildReplyToAddress(CONV_ID)).toBe(
        `reply+${CONV_ID}@${DOMAIN}`,
      )
    })
  })

  describe("buildMessageId", () => {
    it("embeds conversation id, timestamp, and domain", () => {
      const ts = 1_700_000_000_000
      expect(buildMessageId(CONV_ID, ts)).toBe(
        `<conv-${CONV_ID}-${ts}@${DOMAIN}>`,
      )
    })

    it("generates unique ids for different timestamps", () => {
      const a = buildMessageId(CONV_ID, 1000)
      const b = buildMessageId(CONV_ID, 2000)
      expect(a).not.toBe(b)
    })

    it("generates unique ids for different conversations at same timestamp", () => {
      const other = "a1b2c3d4-e5f6-4789-a012-3456789abcde"
      const ts = 1_700_000_000_000
      expect(buildMessageId(CONV_ID, ts)).not.toBe(buildMessageId(other, ts))
    })
  })

  describe("buildThreadingHeaders", () => {
    it("includes In-Reply-To and References when prior inbound ids exist", () => {
      const headers = buildThreadingHeaders(CONV_ID, [
        { messageId: "<first@resend.dev>" },
        { messageId: "<second@resend.dev>" },
      ], 999)

      expect(headers.replyTo).toBe(`reply+${CONV_ID}@${DOMAIN}`)
      expect(headers.messageId).toBe(`<conv-${CONV_ID}-999@${DOMAIN}>`)
      expect(headers.inReplyTo).toBe("<second@resend.dev>")
      expect(headers.references).toBe("<first@resend.dev> <second@resend.dev>")
    })

    it("omits In-Reply-To when no prior messages", () => {
      const headers = buildThreadingHeaders(CONV_ID, [], 100)
      expect(headers.inReplyTo).toBeUndefined()
      expect(headers.references).toBeUndefined()
    })
  })

  describe("parseReplyToLocalPart", () => {
    it("extracts uuid from reply+ local part", () => {
      expect(parseReplyToLocalPart(`reply+${CONV_ID}@${DOMAIN}`)).toBe(CONV_ID)
    })

    it("returns null for non-reply addresses", () => {
      expect(parseReplyToLocalPart(`support@${DOMAIN}`)).toBeNull()
    })
  })

  describe("extractConversationIdFromAddresses", () => {
    it("resolves id from display-name wrapped address", () => {
      const id = extractConversationIdFromAddresses(
        [`Advan Support <reply+${CONV_ID}@${DOMAIN}>`],
        DOMAIN,
      )
      expect(id).toBe(CONV_ID)
    })

    it("returns null when domain does not match", () => {
      expect(
        extractConversationIdFromAddresses([`reply+${CONV_ID}@other.com`], DOMAIN),
      ).toBeNull()
    })
  })
})
