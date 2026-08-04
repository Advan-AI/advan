/**
 * Integration test: Pre-chat questions → ticket title generation
 *
 * Flow:
 *   1. Seed widget config with pre-chat questions
 *   2. Fetch session (should include widgetConfig with questions)
 *   3. Create conversation with subject from pre-chat answer
 *   4. Verify ticket title uses the pre-chat answer
 */

import { db } from "../lib/db"
import { widgetConfigs, organizations, tickets, conversations } from "../lib/db/schema"
import { eq } from "drizzle-orm"

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
}

function pass(label: string, detail?: string) {
  console.log(`${COLORS.green}✓ ${label}${COLORS.reset}${detail ? ` (${detail})` : ""}`)
}

function fail(label: string, detail?: string): never {
  console.error(`${COLORS.red}✗ ${label}${COLORS.reset}${detail ? ` — ${detail}` : ""}`)
  process.exit(1)
}

function info(msg: string) {
  console.log(`${COLORS.cyan}ℹ ${msg}${COLORS.reset}`)
}

async function main() {
  console.log("\n=== Pre-Chat Questions Integration Test ===\n")

  // 1. Find or create test org
  info("Looking for test organization...")
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, "acme"),
  })

  if (!org) {
    fail("Test organization not found", "Expected 'acme' org from seed data")
  }
  pass("Found test organization", org.name)

  // 2. Find or create widget config
  info("Setting up widget config with pre-chat questions...")
  let config = await db.query.widgetConfigs.findFirst({
    where: eq(widgetConfigs.orgId, org.id),
  })

  if (!config) {
    const [inserted] = await db
      .insert(widgetConfigs)
      .values({
        orgId: org.id,
        widgetKey: `wk_test_${Date.now()}`,
        allowedOrigins: ["http://localhost:3000"],
        preChatFormEnabled: true,
        preChatQuestions: [],
      })
      .returning()
    config = inserted!
  }

  // 3. Update with test questions
  const testQuestions = [
    {
      id: "q1",
      text: "What do you need help with?",
      type: "preset" as const,
      options: ["Billing issue", "Technical support", "Product inquiry", "Other"],
      required: true,
    },
    {
      id: "q2",
      text: "Please describe your issue",
      type: "custom" as const,
      required: false,
    },
  ]

  await db
    .update(widgetConfigs)
    .set({
      preChatFormEnabled: true,
      preChatQuestions: testQuestions,
    })
    .where(eq(widgetConfigs.id, config.id))

  pass("Widget config updated with pre-chat questions", `${testQuestions.length} questions`)

  // 4. Test session endpoint (should return config)
  info("Testing POST /api/chat/session...")
  const sessionRes = await fetch("http://localhost:3000/api/chat/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      widgetKey: config.widgetKey,
      origin: "http://localhost:3000",
    }),
  })

  if (!sessionRes.ok) {
    fail("Session endpoint failed", `${sessionRes.status} ${sessionRes.statusText}`)
  }

  const sessionBody = await sessionRes.json()
  pass("Session created", `token: ${sessionBody.token.slice(0, 20)}...`)

  if (!sessionBody.widgetConfig) {
    fail("Session response missing widgetConfig")
  }

  if (!sessionBody.widgetConfig.preChatFormEnabled) {
    fail("preChatFormEnabled is false")
  }

  if (!Array.isArray(sessionBody.widgetConfig.preChatQuestions) || sessionBody.widgetConfig.preChatQuestions.length === 0) {
    fail("preChatQuestions is empty or not an array")
  }

  pass("Widget config returned in session", `${sessionBody.widgetConfig.preChatQuestions.length} questions`)

  // 5. Create a new conversation with subject from pre-chat answer
  info("Creating conversation with pre-chat subject...")
  const preChatSubject = "Billing issue" // Simulating user selecting the first option

  const createRes = await fetch("http://localhost:3000/api/chat/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${sessionBody.token}`,
    },
    body: JSON.stringify({
      displayName: "Pre-Chat Test User",
      subject: preChatSubject,
      initialMessage: "I have a question about my recent invoice.",
    }),
  })

  if (!createRes.ok) {
    const errorBody = await createRes.text()
    fail("Create session failed", `${createRes.status} - ${errorBody}`)
  }

  const createBody = await createRes.json()
  pass("Conversation created", `ID: ${createBody.conversationId}`)

  // 6. Verify ticket title
  info("Verifying ticket title...")
  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, createBody.conversationId),
  })

  if (!conversation) {
    fail("Conversation not found in database")
  }

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, conversation.ticketId),
  })

  if (!ticket) {
    fail("Ticket not found for conversation")
  }

  const expectedTitle = "Pre-Chat Test User · Billing issue"
  if (ticket.subject !== expectedTitle) {
    fail(
      "Ticket subject mismatch",
      `Expected: "${expectedTitle}", Got: "${ticket.subject}"`
    )
  }

  pass("Ticket title correctly generated from pre-chat answer", `"${ticket.subject}"`)

  // 7. Test without pre-chat (fallback to old behavior)
  info("Testing fallback: conversation without pre-chat subject...")
  const fallbackRes = await fetch("http://localhost:3000/api/chat/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${sessionBody.token}`,
    },
    body: JSON.stringify({
      displayName: "Fallback Test",
      initialMessage: "Where is my refund?",
    }),
  })

  if (!fallbackRes.ok) {
    fail("Fallback session creation failed")
  }

  const fallbackBody = await fallbackRes.json()
  const fallbackConv = await db.query.conversations.findFirst({
    where: eq(conversations.id, fallbackBody.conversationId),
  })

  if (!fallbackConv) {
    fail("Fallback conversation not found")
  }

  const fallbackTicket = await db.query.tickets.findFirst({
    where: eq(tickets.id, fallbackConv.ticketId),
  })

  if (!fallbackTicket) {
    fail("Fallback ticket not found")
  }

  const expectedFallback = "Fallback Test · Where is my refund?"
  if (fallbackTicket.subject !== expectedFallback) {
    fail(
      "Fallback title mismatch",
      `Expected: "${expectedFallback}", Got: "${fallbackTicket.subject}"`
    )
  }

  pass("Fallback behavior works (no pre-chat subject)", `"${fallbackTicket.subject}"`)

  console.log(`\n${COLORS.green}=== All tests passed! ===${COLORS.reset}\n`)
  process.exit(0)
}

main().catch((err) => {
  console.error(`\n${COLORS.red}Unhandled error:${COLORS.reset}`, err)
  process.exit(1)
})
