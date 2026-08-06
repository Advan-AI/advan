import "dotenv/config"
import { hash } from "bcryptjs"
import { sql } from "drizzle-orm"
import { db } from "./index"
import {
  plans,
  organizations,
  users,
  customers,
  tickets,
  knowledgeSources,
  conversations,
  messages,
} from "./schema"

/**
 * Per-tenant seed script.
 * Creates a demo org + admin user + sample data for local development.
 * Run: npx tsx lib/db/seed.ts
 */
async function seed() {
  console.log("🌱 Seeding database...")

  console.log("🌱 Cleaning existing database tables...")
  await db.execute(sql`TRUNCATE TABLE
    "messages",
    "conversations",
    "tickets",
    "knowledge_sources",
    "customers",
    "users",
    "widget_configs",
    "usage_events",
    "email_events",
    "audit_logs",
    "suppressed_emails",
    "hitl_queue",
    "pipeline_runs",
    "pipeline_run_steps",
    "workflows",
    "jobs",
    "organizations",
    "plans"
    CASCADE;`)

  // 0. Seed subscription plans
  // NOTE ON STRIPE PRICE CONFIGURATION:
  // These placeholder Stripe Price IDs must be replaced with real Stripe Dashboard-created Product/Price IDs before going live.
  // In a production environment, the flat monthly subscription price and the metered overage price are represented as TWO SEPARATE Stripe Price objects per plan:
  // - Flat price (licensed recurring: e.g. price_starter_flat_placeholder) - e.g. $29.00/mo flat
  // - Metered overage price (recurring metered: e.g. price_starter_metered_placeholder) - e.g. $0.05 per conversation or message over the included limit.
  // Both are attached as separate subscription items on the exact same customer subscription.
  console.log("🌱 Seeding subscription plans...")
  const seededPlans = await db
    .insert(plans)
    .values([
      {
        key: "starter",
        name: "Starter",
        seatLimit: 2,
        includedMessages: 500,
        monthlyPriceCents: 2900,
        stripePriceId: process.env.STRIPE_PRICE_STARTER_FLAT ?? "price_starter_flat_placeholder",
        stripeMeteredPriceId: process.env.STRIPE_PRICE_STARTER_METERED ?? "price_starter_metered_placeholder",
        active: true,
      },
      {
        key: "pro",
        name: "Pro",
        seatLimit: 5,
        includedMessages: 2000,
        monthlyPriceCents: 5900,
        stripePriceId: process.env.STRIPE_PRICE_PRO_FLAT ?? "price_pro_flat_placeholder",
        stripeMeteredPriceId: process.env.STRIPE_PRICE_PRO_METERED ?? "price_pro_metered_placeholder",
        active: true,
      },
      {
        key: "enterprise",
        name: "Enterprise",
        seatLimit: 100,
        includedMessages: 10000,
        // Enterprise is negotiated/custom pricing — this value is never shown
        // directly to users (the UI renders "Custom" for plan.key === "enterprise").
        // Kept non-zero only so downstream sums/reports don't divide-by-zero or
        // treat Enterprise as free; it is not a real monthly figure.
        monthlyPriceCents: 49900,
        stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE_FLAT ?? "price_enterprise_flat_placeholder",
        stripeMeteredPriceId: process.env.STRIPE_PRICE_ENTERPRISE_METERED ?? "price_enterprise_metered_placeholder",
        active: true,
      },
    ])
    .returning()

  const proPlan = seededPlans.find((p) => p.key === "pro")!
  console.log(`  plans: seeded 3 plans (Starter, Pro, Enterprise)`)

  // 1. Create demo organisation
  const [org] = await db
    .insert(organizations)
    .values({
      name: "Acme Corp",
      slug: "acme",
      inboundEmailAlias: "support+acme",
      planId: proPlan.id,
      subscriptionStatus: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days out
    })
    .returning()

  console.log(`  org: ${org.name} (${org.id})`)

  // 2. Create admin user (password: "password123")
  const passwordHash = await hash("password123", 12)

  const [admin] = await db
    .insert(users)
    .values({
      orgId: org.id,
      email: "admin@acme.co",
      name: "Sarah Johnson",
      passwordHash,
      role: "admin",
    })
    .returning()

  console.log(`  admin: ${admin.email}`)

  // 3. Create a support agent
  const agentHash = await hash("password123", 12)
  const [agent] = await db
    .insert(users)
    .values({
      orgId: org.id,
      email: "agent@acme.co",
      name: "James Carter",
      passwordHash: agentHash,
      role: "member",
    })
    .returning()

  console.log(`  agent: ${agent.email}`)

  // 4. Seed 5 sample customers
  const sampleCustomers = await db
    .insert(customers)
    .values([
      { orgId: org.id, email: "alice@startup.io", name: "Alice Chen", company: "Startup.io", tier: "growth", csatAvg: "4.8" },
      { orgId: org.id, email: "bob@enterprise.com", name: "Bob Martinez", company: "Enterprise Co", tier: "enterprise", csatAvg: "4.9" },
      { orgId: org.id, email: "carol@fintech.co", name: "Carol Williams", company: "FinTech Co", tier: "growth", csatAvg: "4.7" },
      { orgId: org.id, email: "dan@saas.io", name: "Dan Park", company: "SaaS.io", tier: "free", csatAvg: "4.5" },
      { orgId: org.id, email: "eva@healthco.com", name: "Eva Brown", company: "HealthCo", tier: "enterprise", csatAvg: "4.95" },
    ])
    .returning()

  console.log(`  customers: ${sampleCustomers.length}`)

  // 5. Seed sample tickets
  const ticketData = [
    { subject: "Billing overcharge on last invoice", status: "open" as const, priority: "high" as const, channel: "email" as const, customerId: sampleCustomers[0].id, firstReplyMs: 14_000, confidenceScore: 88 },
    { subject: "Webhook not triggering on payment events", status: "pending" as const, priority: "urgent" as const, channel: "chat" as const, customerId: sampleCustomers[1].id, firstReplyMs: 9_500, confidenceScore: 91 },
    { subject: "How to configure SSO for our team?", status: "open" as const, priority: "medium" as const, channel: "portal" as const, customerId: sampleCustomers[2].id, firstReplyMs: 22_000, confidenceScore: 86 },
    { subject: "API rate limit exceeded unexpectedly", status: "resolved" as const, priority: "high" as const, channel: "slack" as const, customerId: sampleCustomers[3].id, aiResolved: true, firstReplyMs: 8_200, confidenceScore: 96 },
    { subject: "Request for HIPAA BAA agreement", status: "open" as const, priority: "urgent" as const, channel: "email" as const, customerId: sampleCustomers[4].id, firstReplyMs: 31_000, confidenceScore: 84 },
    { subject: "Dashboard not loading on mobile", status: "open" as const, priority: "low" as const, channel: "chat" as const, customerId: sampleCustomers[0].id, firstReplyMs: 18_500, confidenceScore: 79 },
    { subject: "Export feature missing from analytics", status: "resolved" as const, priority: "medium" as const, channel: "email" as const, customerId: sampleCustomers[1].id, aiResolved: true, firstReplyMs: 11_000, confidenceScore: 93 },
    { subject: "Password reset email not arriving", status: "pending" as const, priority: "medium" as const, channel: "chat" as const, customerId: sampleCustomers[2].id, firstReplyMs: 12_400, confidenceScore: 90 },
  ]

  const seededTickets = await db
    .insert(tickets)
    .values(ticketData.map((t) => ({ ...t, orgId: org.id, assignedTo: agent.id })))
    .returning()

  console.log(`  tickets: ${seededTickets.length}`)

  // 6. Seed Knowledge Base articles
  const kbData = [
    {
      title: "Billing & Refund Policy",
      content: "Refunds are processed within 5-7 business days. Charges above $50 require manager approval. Partial refunds are available for unused portions of annual plans.",
      sourceType: "document" as const,
    },
    {
      title: "Webhook Configuration Guide",
      content: "To configure webhooks: 1. Navigate to Settings > Integrations. 2. Enter your endpoint URL. 3. Select events to subscribe to. 4. Copy the signing secret for validation.",
      sourceType: "document" as const,
    },
    {
      title: "SSO Setup Documentation",
      content: "Advan supports SAML 2.0 and OIDC SSO. Enterprise plan required. Configuration steps: 1. Add your Identity Provider metadata URL. 2. Map attributes: email, name, role. 3. Test with a non-admin account first.",
      sourceType: "document" as const,
    },
    {
      title: "API Rate Limits",
      content: "Rate limits by plan: Starter 100 req/min, Growth 1000 req/min, Enterprise custom. Rate limit headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset.",
      sourceType: "document" as const,
    },
    {
      title: "HIPAA Compliance & BAA",
      content: "Advan is HIPAA-ready on Enterprise plans. BAA agreements are available upon request. Data is encrypted in transit (TLS 1.3) and at rest (AES-256). PHI handling documentation available on request.",
      sourceType: "document" as const,
    },
  ]

  const seededKB = await db
    .insert(knowledgeSources)
    .values(kbData.map((k) => ({ ...k, orgId: org.id })))
    .returning()

  console.log(`  knowledge sources: ${seededKB.length}`)

  // 7. Seed conversations — one per ticket, channel mirrors the ticket channel
  const seededConvs = await db
    .insert(conversations)
    .values(
      seededTickets.map((t) => ({
        orgId: org.id,
        ticketId: t.id,
        channel: t.channel,
        customerId: t.customerId ?? undefined,
      }))
    )
    .returning()

  console.log(`  conversations: ${seededConvs.length}`)

  // 8. Seed realistic messages for each conversation
  type MsgTemplate = {
    role: "user" | "assistant" | "agent"
    content: string
    metadata?: {
      confidence?: number
      latencyMs?: number
      model?: string
      isInternal?: boolean
      citations?: Array<{ source: string; url?: string; confidence: number }>
    }
  }

  const convMessages: MsgTemplate[][] = [
    // [0] Billing overcharge — Alice Chen (email)
    [
      { role: "user", content: "Hi, I was reviewing my last invoice and noticed a charge that looks incorrect. I was billed $299 but thought my plan was $199/month. Can you help clarify this?" },
      { role: "assistant", content: "Hi Alice! I've reviewed your account and can see that you were charged $299 last month. This includes your Growth plan ($199) plus a $100 overage for API calls exceeding your monthly limit. Would you like me to pull up the detailed usage report?", metadata: { confidence: 88, latencyMs: 1240, model: "gpt-4o", citations: [{ source: "Billing & Refund Policy", confidence: 0.92 }] } },
      { role: "agent", content: "Hi Alice, Sarah here from the support team. I can confirm you hit 150% of your API quota in June. I'll waive the $100 overage charge as a one-time courtesy since you weren't notified in advance — a $100 credit will appear on your next bill." },
      { role: "user", content: "Oh I see, I didn't realise I was going over my limit. The credit is really appreciated, thank you so much!" },
      { role: "agent", content: "Credit applied ✓. I've also enabled usage alerts so you'll get an email at 80% and 95% of your quota going forward.", metadata: { isInternal: false } },
    ],

    // [1] Webhook not triggering — Bob Martinez (chat)
    [
      { role: "user", content: "Our payment webhooks stopped firing about 2 hours ago. We're using payment.completed and payment.failed events. No errors in our logs but events just aren't arriving." },
      { role: "assistant", content: "I can see your webhook endpoint at api.enterprise.com/webhooks last received an event at 14:32 UTC. There were 3 failed delivery attempts after that with HTTP 503 responses from your endpoint — it appears your server was temporarily unavailable rather than a config issue on our end.", metadata: { confidence: 91, latencyMs: 980, model: "gpt-4o", citations: [{ source: "Webhook Configuration Guide", confidence: 0.95 }] } },
      { role: "agent", content: "Confirmed in our delivery logs: 3 attempts, exponential backoff, 503s from your side. Queued events will auto-redeliver once your endpoint recovers. Current queue: 47 events pending.", metadata: { isInternal: false } },
      { role: "user", content: "That makes sense — we had a deployment at 14:30 that caused a brief outage. The endpoint is back up now. Are the queued events being sent?" },
      { role: "agent", content: "Yes, delivery resumed. 43 of 47 queued events delivered in the last 5 minutes; remaining 4 are in-flight.", metadata: { isInternal: false } },
      { role: "agent", content: "Internal: customer confirmed self-inflicted outage from deployment. No action needed on our side. Marking resolved after delivery confirms.", metadata: { isInternal: true } },
    ],

    // [2] SSO configuration — Carol Williams (portal)
    [
      { role: "user", content: "We're trying to set up SSO for our engineering team. We use Okta as our IdP. What do I need to configure on both ends?" },
      { role: "assistant", content: "Setting up Okta SAML 2.0 with Advan is straightforward:\n\n1. **In Advan**: Settings → Security → SSO. Enable SAML 2.0, copy your SP Entity ID and ACS URL.\n2. **In Okta**: Create a new SAML app, paste the SP Entity ID and ACS URL.\n3. **Attribute mapping**: `email` → `user.email`, `name` → `user.displayName`.\n\nWould you like a walkthrough of any specific step?", metadata: { confidence: 86, latencyMs: 1450, model: "gpt-4o", citations: [{ source: "SSO Setup Documentation", confidence: 0.97 }] } },
      { role: "user", content: "Very helpful! What about role mapping? We want Okta admins to automatically get admin access in Advan." },
      { role: "assistant", content: "Add a `role` attribute in your Okta SAML statements:\n- Name: `role`\n- Value: `appuser.role` (or your group-based expression)\n\nAdvan accepts `admin`, `member`, or `viewer`. Members not matching any value default to `member`.", metadata: { confidence: 84, latencyMs: 1120, model: "gpt-4o" } },
      { role: "user", content: "Perfect, I'll try this now. Thank you!" },
    ],

    // [3] API rate limit — Dan Park (slack) — AI resolved
    [
      { role: "user", content: "We keep hitting rate limits even though we're on the Growth plan with 1000 req/min. Our usage monitor shows we're only at 600 req/min average." },
      { role: "assistant", content: "Rate limits are applied per-endpoint, not just overall. On Growth, while the global cap is 1000 req/min, individual endpoints like `/v1/search` have a sub-limit of 200 req/min. Your analytics dashboard was likely making many search calls in parallel. Fix: implement request batching or switch to `/v1/batch-search`.", metadata: { confidence: 96, latencyMs: 890, model: "gpt-4o", citations: [{ source: "API Rate Limits", confidence: 0.98 }] } },
      { role: "agent", content: "AI correctly identified the root cause. Batch endpoint docs: https://docs.advan.ai/api/batch-search", metadata: { isInternal: false } },
      { role: "agent", content: "Internal: marking AI-resolved. Confidence 96% — no human action needed. @Dan check the docs link above.", metadata: { isInternal: true } },
    ],

    // [4] HIPAA BAA — Eva Brown (email)
    [
      { role: "user", content: "We need a Business Associate Agreement (BAA) to comply with HIPAA requirements. We process PHI through your platform. Can you provide one?" },
      { role: "assistant", content: "BAA agreements are available on Enterprise plans. Based on your current subscription, you are eligible. To proceed, please provide your legal entity name and the name and email of the authorised signatory.", metadata: { confidence: 84, latencyMs: 1380, model: "gpt-4o", citations: [{ source: "HIPAA Compliance & BAA", confidence: 0.96 }] } },
      { role: "agent", content: "Hi Eva, escalating to our compliance team. You'll receive the BAA at eva@healthco.com within 1 business day. You can also expedite by emailing legal@advan.ai directly.", metadata: { isInternal: false } },
      { role: "agent", content: "Internal: flagged for legal review. Priority: urgent. Enterprise tier — pre-approved BAA template applies. Assigned to @compliance-team.", metadata: { isInternal: true } },
    ],

    // [5] Dashboard not loading on mobile — Alice Chen (chat)
    [
      { role: "user", content: "The analytics dashboard doesn't load on my iPhone — blank white screen after the loading spinner. Started happening after the last update." },
      { role: "assistant", content: "This sounds like a rendering issue from our recent dashboard update which introduced CSS changes affecting Safari on iOS. Known workaround: clear Safari cache (Settings → Safari → Clear History and Website Data) and try again. A fix is scheduled for the next release.", metadata: { confidence: 79, latencyMs: 1650, model: "gpt-4o" } },
      { role: "user", content: "Clearing the cache fixed it! Thanks for the quick response." },
      { role: "agent", content: "Great to hear! We'll make sure to test Safari iOS more thoroughly before future releases. Closing this for now — reopen anytime if it recurs.", metadata: { isInternal: false } },
    ],

    // [6] Export feature — Bob Martinez (email) — AI resolved
    [
      { role: "user", content: "I need to export my analytics data to CSV for a board presentation but I can't find the export option. Is this feature available?" },
      { role: "assistant", content: "CSV export is available in the Analytics section. Click the ⬇ Export button in the top-right corner of any analytics view. You can export the current view or a custom date range. Note: exports are limited to the last 90 days on the Growth plan.", metadata: { confidence: 93, latencyMs: 760, model: "gpt-4o" } },
      { role: "agent", content: "Resolved by AI. If you need exports beyond 90 days, our Enterprise plan includes full historical exports. Let us know if you need anything else!", metadata: { isInternal: false } },
    ],

    // [7] Password reset — Carol Williams (chat)
    [
      { role: "user", content: "I requested a password reset 30 minutes ago but never received the email. I've checked spam too. My email is carol@fintech.co" },
      { role: "assistant", content: "I can see a reset email was sent at 09:15 UTC but shows as 'soft bounced' — your mail server temporarily rejected it. Please wait a few minutes or try again. If it persists, ask your IT team to whitelist noreply@advan.ai.", metadata: { confidence: 90, latencyMs: 1100, model: "gpt-4o" } },
      { role: "user", content: "I asked IT and they've whitelisted the domain. Can you resend it?" },
      { role: "agent", content: "Resend triggered! You should receive the reset email within 2 minutes. If it still doesn't arrive, reply here and we'll set a temporary password manually.", metadata: { isInternal: false } },
    ],
  ]

  for (let i = 0; i < seededConvs.length; i++) {
    const conv = seededConvs[i]
    const msgs = convMessages[i] ?? []
    if (msgs.length > 0) {
      await db.insert(messages).values(
        msgs.map((m) => ({
          conversationId: conv.id,
          role: m.role,
          content: m.content,
          metadata: m.metadata ?? null,
        }))
      )
    }
  }

  console.log(`  messages: seeded across ${seededConvs.length} conversations`)

  console.log("\n✅ Seed complete!")
  console.log("\n  Login credentials:")
  console.log("  Email:    admin@acme.co")
  console.log("  Password: password123")

  process.exit(0)
}

seed().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
