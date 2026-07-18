import { z } from "zod"
import { eq } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { hash } from "bcryptjs"

import { router, protectedProcedure } from "../trpc"
import { db } from "@/lib/db"
import { users, organizations } from "@/lib/db/schema"

export const userRouter = router({
  /**
   * Fetch current user profile details
   */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, ctx.user.id),
      columns: { id: true, name: true, email: true, role: true, chatAvailable: true, image: true, createdAt: true },
    })
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" })
    }
    if (user.image && user.image.startsWith("avatars/")) {
      try {
        const { getAvatarUrl } = await import("@/lib/storage/s3-client")
        user.image = await getAvatarUrl(user.image)
      } catch (err) {
        console.error("Failed to sign avatar URL:", err)
      }
    }
    return user
  }),

  /**
   * Update current user profile details
   */
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name cannot be empty"),
        email: z.string().email("Invalid email address"),
        chatAvailable: z.boolean().optional(),
        image: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const emailLower = input.email.toLowerCase().trim()
      const existing = await db.query.users.findFirst({
        where: eq(users.email, emailLower),
      })
      if (existing && existing.id !== ctx.user.id) {
        throw new TRPCError({ code: "CONFLICT", message: "A user with this email address already exists" })
      }

      const updateData: any = {
        name: input.name.trim(),
        email: emailLower,
        chatAvailable: input.chatAvailable ?? true,
      }

      if (input.image !== undefined) {
        updateData.image = input.image
      }

      await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, ctx.user.id))

      return { success: true }
    }),

  /**
   * Securely update password
   */
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: z.string().min(6, "New password must be at least 6 characters"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.user.id),
      })
      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" })
      }

      const { compare } = await import("bcryptjs")
      const matches = await compare(input.currentPassword, user.passwordHash)
      if (!matches) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Incorrect current password" })
      }

      const passwordHash = await hash(input.newPassword, 12)
      await db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, ctx.user.id))

      return { success: true }
    }),

  /**
   * Fetch current organization settings
   */
  getOrgSettings: protectedProcedure.query(async ({ ctx }) => {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, ctx.user.orgId),
    })
    if (!org) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" })
    }
    return org
  }),

  /**
   * Update organization settings
   */
  updateOrgSettings: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Organization name cannot be empty"),
        slug: z
          .string()
          .min(2, "Subdomain/slug must be at least 2 characters")
          .regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only organization administrators can modify settings" })
      }

      const slugLower = input.slug.toLowerCase().trim()
      const existing = await db.query.organizations.findFirst({
        where: eq(organizations.slug, slugLower),
      })
      if (existing && existing.id !== ctx.user.orgId) {
        throw new TRPCError({ code: "CONFLICT", message: "Subdomain/slug already taken" })
      }

      await db
        .update(organizations)
        .set({
          name: input.name.trim(),
          slug: slugLower,
        })
        .where(eq(organizations.id, ctx.user.orgId))

      return { success: true }
    }),
})
