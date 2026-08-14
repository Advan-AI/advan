import type { Session } from "next-auth"
import { eq } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { demoLoginEmail, isDemoAutoLoginEnabled } from "./demo-tenant"

export async function getEffectiveSession(): Promise<Session | null> {
  const session = await auth()
  if (session?.user?.id && session.user.orgId) return session

  if (!isDemoAutoLoginEnabled()) return session

  const email = demoLoginEmail()
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: {
      id: true,
      email: true,
      name: true,
      image: true,
      orgId: true,
      role: true,
    },
  })

  if (!user) return session

  return {
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      orgId: user.orgId,
      role: user.role,
    },
  }
}
