import { z } from "zod"
import { eq } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { hash } from "bcryptjs"

import { router, protectedProcedure } from "../trpc"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { assertSeatLimit } from "@/lib/billing/subscription-service"

export const teamRouter = router({
  /**
   * List all members of the caller's organization.
   */
  listMembers: protectedProcedure.query(async ({ ctx }) => {
    return db.query.users.findMany({
      where: eq(users.orgId, ctx.user.orgId),
      columns: { id: true, name: true, email: true, role: true, createdAt: true },
    })
  }),

  /**
   * Invite a new member to the organization.
   *
   * Seat enforcement: assertSeatLimit counts existing users and throws if the
   * org is at its plan's seatLimit. Seats are a hard cap — no silent overage.
   */
  addMember: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        role: z.enum(["admin", "member", "viewer"]).default("member"),
        // Temporary password; in production this would be a magic-link invite.
        // Included here so the row is immediately usable without a separate flow.
        password: z.string().min(6),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Hard seat-limit check — throws with a clear upgrade message if at limit.
      try {
        await assertSeatLimit(ctx.user.orgId)
      } catch (err: any) {
        throw new TRPCError({ code: "FORBIDDEN", message: err.message })
      }

      const emailLower = input.email.toLowerCase().trim()

      // 2. Duplicate email guard.
      const existing = await db.query.users.findFirst({
        where: eq(users.email, emailLower),
        columns: { id: true },
      })
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A user with this email address already exists.",
        })
      }

      const passwordHash = await hash(input.password, 12)

      const [newUser] = await db
        .insert(users)
        .values({
          orgId: ctx.user.orgId,
          email: emailLower,
          name: input.name.trim(),
          passwordHash,
          role: input.role,
        })
        .returning({ id: users.id, email: users.email, name: users.name, role: users.role })

      return newUser
    }),

  /**
   * Remove a member from the organization.
   * Admins cannot remove themselves.
   */
  removeMember: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot remove yourself." })
      }

      const target = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
        columns: { id: true, orgId: true },
      })

      if (!target || target.orgId !== ctx.user.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found." })
      }

      await db.delete(users).where(eq(users.id, input.userId))
      return { success: true }
    }),
})
