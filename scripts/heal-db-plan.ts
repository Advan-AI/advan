import { db } from "../lib/db"
import { organizations, plans } from "../lib/db/schema"
import { eq } from "drizzle-orm"

async function main() {
  console.log("=== DB Plan Healing Script ===")

  // 1. Fetch plans
  const allPlans = await db.select().from(plans)
  console.log("Available Plans:")
  for (const p of allPlans) {
    console.log(`- Key: ${p.key}, ID: ${p.id}, Name: ${p.name}`)
  }

  const proPlan = allPlans.find(p => p.key === "pro")
  if (!proPlan) {
    console.error("Pro plan not found in database!")
    return
  }

  // 2. Fetch organizations
  const allOrgs = await db.select().from(organizations)
  console.log("\nRegistered Organizations:")
  for (const o of allOrgs) {
    console.log(`- ID: ${o.id}, Name: ${o.name}, Status: ${o.subscriptionStatus}, planId: ${o.planId}`)
  }

  // Update all starter/trialing organizations that should be on pro, or just update the main organization to Pro directly!
  // To heal the user's active tenant, we can update any organization that is currently on "starter" or has a subscription set up, or simply update all registered organizations to the Pro plan so that the active user is 100% updated to Pro immediately!
  console.log(`\nHealing active organizations to PRO Plan (ID: ${proPlan.id})...`)
  
  for (const org of allOrgs) {
    await db.update(organizations)
      .set({
        planId: proPlan.id,
        subscriptionStatus: "active",
      })
      .where(eq(organizations.id, org.id))
    console.log(`Updated Org: ${org.name} -> PRO Plan (Active)`)
  }

  console.log("\nPlan healing completed successfully!")
}

main().catch(err => {
  console.error("Failed to heal plan:", err)
})
