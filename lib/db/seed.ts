import { hash } from "bcryptjs"
import { db } from "./index"
import {
  organizations,
  users,
  customers,
  tickets,
  knowledgeSources,
} from "./schema"

/**
 * Per-tenant seed script.
 * Creates a demo org + admin user + sample data for local development.
 * Run: npx tsx lib/db/seed.ts
 */
async function seed() {
  console.log("🌱 Seeding database...")

  // 1. Create demo organisation
  const [org] = await db
    .insert(organizations)
    .values({
      name: "Acme Corp",
      slug: "acme",
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
      { orgId: org.id, email: "alice@startup.io", name: "Alice Chen", company: "Startup.io", tier: "growth" },
      { orgId: org.id, email: "bob@enterprise.com", name: "Bob Martinez", company: "Enterprise Co", tier: "enterprise" },
      { orgId: org.id, email: "carol@fintech.co", name: "Carol Williams", company: "FinTech Co", tier: "growth" },
      { orgId: org.id, email: "dan@saas.io", name: "Dan Park", company: "SaaS.io", tier: "free" },
      { orgId: org.id, email: "eva@healthco.com", name: "Eva Brown", company: "HealthCo", tier: "enterprise" },
    ])
    .returning()

  console.log(`  customers: ${sampleCustomers.length}`)

  // 5. Seed sample tickets
  const ticketData = [
    { subject: "Billing overcharge on last invoice", status: "open" as const, priority: "high" as const, channel: "email" as const, customerId: sampleCustomers[0].id },
    { subject: "Webhook not triggering on payment events", status: "pending" as const, priority: "urgent" as const, channel: "chat" as const, customerId: sampleCustomers[1].id },
    { subject: "How to configure SSO for our team?", status: "open" as const, priority: "medium" as const, channel: "portal" as const, customerId: sampleCustomers[2].id },
    { subject: "API rate limit exceeded unexpectedly", status: "resolved" as const, priority: "high" as const, channel: "slack" as const, customerId: sampleCustomers[3].id, aiResolved: true },
    { subject: "Request for HIPAA BAA agreement", status: "open" as const, priority: "urgent" as const, channel: "email" as const, customerId: sampleCustomers[4].id },
    { subject: "Dashboard not loading on mobile", status: "open" as const, priority: "low" as const, channel: "chat" as const, customerId: sampleCustomers[0].id },
    { subject: "Export feature missing from analytics", status: "resolved" as const, priority: "medium" as const, channel: "email" as const, customerId: sampleCustomers[1].id, aiResolved: true },
    { subject: "Password reset email not arriving", status: "pending" as const, priority: "medium" as const, channel: "chat" as const, customerId: sampleCustomers[2].id },
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
