#!/usr/bin/env tsx
/**
 * Seed script to create a demo organization and admin user for local development
 */

import { db } from "@/lib/db"
import { organizations, users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import crypto from "crypto"

const DEMO_EMAIL = "admin@example.com"
const DEMO_PASSWORD = "password123"
const DEMO_ORG_NAME = "Demo Organization"

async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex")
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err)
      resolve(salt + ":" + derivedKey.toString("hex"))
    })
  })
}

async function main() {
  console.log("🌱 Seeding database with demo organization and user...")

  // Check if user already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, DEMO_EMAIL),
  })

  if (existingUser) {
    console.log(`✅ User ${DEMO_EMAIL} already exists (org_id: ${existingUser.orgId})`)
    console.log(`\nYou can now log in with:`)
    console.log(`  Email: ${DEMO_EMAIL}`)
    console.log(`  Password: ${DEMO_PASSWORD}`)
    return
  }

  // Create organization
  const [org] = await db
    .insert(organizations)
    .values({
      name: DEMO_ORG_NAME,
      slug: "demo-org",
      inboundEmailAlias: `demo-${Date.now()}@advan.local`,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      planId: null,
      subscriptionStatus: null,
      trialEndsAt: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
    })
    .returning()

  console.log(`✅ Created organization: ${org.name} (${org.id})`)

  // Create admin user
  const passwordHash = await hashPassword(DEMO_PASSWORD)
  const [user] = await db
    .insert(users)
    .values({
      orgId: org.id,
      email: DEMO_EMAIL,
      name: "Admin User",
      passwordHash,
      emailVerified: true,
      role: "admin",
    })
    .returning()

  console.log(`✅ Created user: ${user.email} (${user.id})`)
  console.log(`\n🎉 Setup complete! You can now log in with:`)
  console.log(`  Email: ${DEMO_EMAIL}`)
  console.log(`  Password: ${DEMO_PASSWORD}`)
  console.log(`\n🔗 Visit: http://localhost:3000/login`)
}

main()
  .then(() => {
    console.log("\n✨ Done!")
    process.exit(0)
  })
  .catch((err) => {
    console.error("\n❌ Seed failed:", err)
    process.exit(1)
  })
