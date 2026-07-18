import { db } from "./index"
import { users, organizations } from "./schema"
import { eq } from "drizzle-orm"

async function main() {
  const email = "muhammadarslantoor@gmail.com";
  console.log("Checking for organization...");
  
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, "acme"),
  });
  
  if (!org) {
    console.error("Acme organization not found! Please run seed first or create an organization.");
    process.exit(1);
  }
  
  console.log(`Found Acme organization: ${org.id}`);
  
  console.log(`Checking if user ${email} already exists...`);
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });
  
  if (existing) {
    console.log(`User ${email} already exists inside organization: ${existing.orgId}`);
  } else {
    console.log(`Inserting user ${email} as admin...`);
    const [inserted] = await db.insert(users).values({
      orgId: org.id,
      email: email.toLowerCase(),
      name: "Muhammad Arslan Toor",
      role: "admin",
      chatAvailable: true,
      emailVerified: true,
    }).returning();
    
    console.log(`Successfully created user:`, inserted);
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
