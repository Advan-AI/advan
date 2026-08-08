import { z } from "zod"
import { eq, and, gt, isNull } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { hash } from "bcryptjs"
import crypto from "crypto"

import { router, publicProcedure, protectedProcedure } from "../trpc"
import { db } from "@/lib/db"
import { organizations, users, widgetConfigs, emailVerifications } from "@/lib/db/schema"
import { getResendClient } from "@/lib/email/resend-client"
import { renderOtpEmail } from "@/lib/email/templates/otp"

const OTP_EXPIRY_MINUTES = 15

function generateOtp(): string {
  return String(crypto.randomInt(100000, 999999))
}

function generateWidgetKey(): string {
  const buf = crypto.randomBytes(16)
  return `wk_live_${buf.toString("hex")}`
}

export const authRouter = router({
  signup: publicProcedure
    .input(
      z.object({
        orgName: z.string().min(2, "Organization name must be at least 2 characters."),
        orgSlug: z
          .string()
          .min(2, "Subdomain/slug must be at least 2 characters.")
          .regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens."),
        adminName: z.string().min(2, "Name must be at least 2 characters."),
        adminEmail: z.string().email("Please provide a valid email address."),
        password: z.string().min(6, "Password must be at least 6 characters."),
      })
    )
    .mutation(async ({ input }) => {
      const slugLower = input.orgSlug.toLowerCase().trim()
      const emailLower = input.adminEmail.toLowerCase().trim()

      // 1. Check slug + email conflicts
      const existingOrg = await db.query.organizations.findFirst({
        where: eq(organizations.slug, slugLower),
        columns: { id: true },
      })
      if (existingOrg) {
        throw new TRPCError({ code: "CONFLICT", message: "An organization with this subdomain/slug already exists." })
      }

      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, emailLower),
        columns: { id: true },
      })
      if (existingUser) {
        throw new TRPCError({ code: "CONFLICT", message: "A user with this email address is already registered." })
      }

      // 2. Provision org + user + widget in a transaction (emailVerified=false)
      const passwordHash = await hash(input.password, 12)
      const widgetKey = generateWidgetKey()

      const result = await db.transaction(async (tx) => {
        const [newOrg] = await tx.insert(organizations).values({
          name: input.orgName.trim(),
          slug: slugLower,
          inboundEmailAlias: `support+${slugLower}`,
        }).returning()

        const [newUser] = await tx.insert(users).values({
          orgId: newOrg.id,
          email: emailLower,
          name: input.adminName.trim(),
          passwordHash,
          role: "admin",
          chatAvailable: true,
          emailVerified: false,
        }).returning()

        const [newWidget] = await tx.insert(widgetConfigs).values({
          orgId: newOrg.id,
          widgetKey,
          allowedOrigins: [],
          preChatFormEnabled: true,
        }).returning()

        return { orgId: newOrg.id, userId: newUser.id, widgetKey: newWidget.widgetKey }
      })

      // 3. Generate OTP and send verification email
      const otp = generateOtp()
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

      await db.insert(emailVerifications).values({ email: emailLower, otp, expiresAt })

      const resend = getResendClient()
      await resend.emails.send({
        from: process.env.EMAIL_FROM!,
        to: emailLower,
        subject: "Verify your Advan AI workspace",
        html: renderOtpEmail({ otp, name: input.adminName.trim(), expiresInMinutes: OTP_EXPIRY_MINUTES }),
      })

      return { success: true, orgId: result.orgId, userId: result.userId, requiresVerification: true }
    }),

  verifyOtp: publicProcedure
    .input(z.object({
      email: z.string().email(),
      otp: z.string().length(6),
    }))
    .mutation(async ({ input }) => {
      const emailLower = input.email.toLowerCase().trim()

      const record = await db.query.emailVerifications.findFirst({
        where: and(
          eq(emailVerifications.email, emailLower),
          eq(emailVerifications.otp, input.otp),
          gt(emailVerifications.expiresAt, new Date()),
          isNull(emailVerifications.usedAt),
        ),
      })

      if (!record) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired verification code." })
      }

      // Mark OTP used + mark user verified
      await db.update(emailVerifications)
        .set({ usedAt: new Date() })
        .where(eq(emailVerifications.id, record.id))

      await db.update(users)
        .set({ emailVerified: true })
        .where(eq(users.email, emailLower))

      const user = await db.query.users.findFirst({
        where: eq(users.email, emailLower),
        columns: { orgId: true },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." })

      // Every new workspace starts on a 14-day free trial — no card, no
      // Stripe checkout required. Upgrading to a paid plan happens later
      // from the Billing page ("Upgrade to Starter").
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, user.orgId),
        columns: { subscriptionStatus: true },
      })
      if (!org?.subscriptionStatus) {
        await db.update(organizations)
          .set({
            subscriptionStatus: "trialing",
            trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          })
          .where(eq(organizations.id, user.orgId))
      }

      return { success: true }
    }),

  resendOtp: publicProcedure
    .input(z.object({ email: z.string().email(), name: z.string() }))
    .mutation(async ({ input }) => {
      const emailLower = input.email.toLowerCase().trim()

      const user = await db.query.users.findFirst({
        where: eq(users.email, emailLower),
        columns: { id: true, emailVerified: true },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." })
      if (user.emailVerified) throw new TRPCError({ code: "BAD_REQUEST", message: "Email already verified." })

      const otp = generateOtp()
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)
      await db.insert(emailVerifications).values({ email: emailLower, otp, expiresAt })

      const resend = getResendClient()
      await resend.emails.send({
        from: process.env.EMAIL_FROM!,
        to: emailLower,
        subject: "Your new Advan AI verification code",
        html: renderOtpEmail({ otp, name: input.name, expiresInMinutes: OTP_EXPIRY_MINUTES }),
      })

      return { success: true }
    }),

  getBillingStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, ctx.user.orgId),
        columns: {
          id: true,
          name: true,
          subscriptionStatus: true,
        },
      })
      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" })
      }
      return org
    }),

  getOnboardingStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, ctx.user.orgId),
      })
      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" })
      }
      const isPending = org.slug.startsWith("pending-") || org.name === "Pending Onboarding"
      return {
        isPending,
        orgName: org.name === "Pending Onboarding" ? "" : org.name,
        orgSlug: org.slug.startsWith("pending-") ? "" : org.slug,
      }
    }),

  completeOnboarding: protectedProcedure
    .input(
      z.object({
        orgName: z.string().min(2, "Workspace name must be at least 2 characters."),
        orgSlug: z
          .string()
          .min(2, "Subdomain/slug must be at least 2 characters.")
          .regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens."),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const slugLower = input.orgSlug.toLowerCase().trim()
      const nameTrimmed = input.orgName.trim()

      const existingOrg = await db.query.organizations.findFirst({
        where: eq(organizations.slug, slugLower),
      })
      if (existingOrg && existingOrg.id !== ctx.user.orgId) {
        throw new TRPCError({ code: "CONFLICT", message: "This workspace subdomain is already taken." })
      }

      await db
        .update(organizations)
        .set({
          name: nameTrimmed,
          slug: slugLower,
          inboundEmailAlias: `support+${slugLower}`,
        })
        .where(eq(organizations.id, ctx.user.orgId))

      return { success: true }
    }),
})
