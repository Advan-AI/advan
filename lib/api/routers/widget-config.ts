import { z } from "zod"
import { eq } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import crypto from "crypto"

import { router, protectedProcedure } from "../trpc"
import { db } from "@/lib/db"
import { widgetConfigs } from "@/lib/db/schema"

function generateWidgetKey(): string {
  const buf = crypto.randomBytes(16)
  return `wk_live_${buf.toString("hex")}`
}

export const widgetConfigRouter = router({
  /**
   * get:
   * Returns the current organization's widget config or null if none exists.
   */
  get: protectedProcedure.query(async ({ ctx }) => {
    const config = await db.query.widgetConfigs.findFirst({
      where: eq(widgetConfigs.orgId, ctx.user.orgId),
    })
    return config ?? null
  }),

  /**
   * create:
   * Provisions a new widget configuration for the org with a securely generated key.
   * Enforces 1:1 relation—if an org already has a config, it throws an error.
   */
  create: protectedProcedure.mutation(async ({ ctx }) => {
    const existing = await db.query.widgetConfigs.findFirst({
      where: eq(widgetConfigs.orgId, ctx.user.orgId),
      columns: { id: true },
    })

    if (existing) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "An active widget config already exists for this organization.",
      })
    }

    const newKey = generateWidgetKey()

    const [inserted] = await db
      .insert(widgetConfigs)
      .values({
        orgId: ctx.user.orgId,
        widgetKey: newKey,
        allowedOrigins: [],
        preChatFormEnabled: true,
      })
      .returning()

    return inserted
  }),

  /**
   * updateOrigins:
   * Updates allowedOrigins for the caller's own org's config only (verifying orgId match).
   */
  updateOrigins: protectedProcedure
    .input(z.object({ allowedOrigins: z.array(z.string().url()) }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(widgetConfigs)
        .set({ allowedOrigins: input.allowedOrigins })
        .where(eq(widgetConfigs.orgId, ctx.user.orgId))
        .returning()

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Widget config not found.",
        })
      }

      return updated
    }),

  /**
   * rotateKey:
   * Generates a new widgetKey for the org, invalidating the old one immediately.
   */
  rotateKey: protectedProcedure.mutation(async ({ ctx }) => {
    const newKey = generateWidgetKey()

    const [updated] = await db
      .update(widgetConfigs)
      .set({ widgetKey: newKey })
      .where(eq(widgetConfigs.orgId, ctx.user.orgId))
      .returning()

    if (!updated) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Widget config not found.",
      })
    }

    return updated
  }),

  /**
   * delete:
   * Disables/deletes the widget entirely for that org.
   */
  delete: protectedProcedure.mutation(async ({ ctx }) => {
    const [deleted] = await db
      .delete(widgetConfigs)
      .where(eq(widgetConfigs.orgId, ctx.user.orgId))
      .returning()

    if (!deleted) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Widget config not found.",
      })
    }

    return { success: true }
  }),

  /**
   * deactivate:
   * Alias of delete, disables/deletes the widget entirely for that org.
   */
  deactivate: protectedProcedure.mutation(async ({ ctx }) => {
    const [deleted] = await db
      .delete(widgetConfigs)
      .where(eq(widgetConfigs.orgId, ctx.user.orgId))
      .returning()

    if (!deleted) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Widget config not found.",
      })
    }

    return { success: true }
  }),

  /**
   * updatePreChatQuestions:
   * Updates the pre-chat intake questions shown before first message.
   */
  updatePreChatQuestions: protectedProcedure
    .input(
      z.object({
        questions: z.array(
          z.object({
            id: z.string(),
            text: z.string().min(1).max(255),
            type: z.enum(["preset", "custom"]),
            options: z.array(z.string()).optional(),
            required: z.boolean().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(widgetConfigs)
        .set({ preChatQuestions: input.questions })
        .where(eq(widgetConfigs.orgId, ctx.user.orgId))
        .returning()

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Widget config not found.",
        })
      }

      return updated
    }),

  /**
   * togglePreChatForm:
   * Enable or disable the pre-chat form feature.
   */
  togglePreChatForm: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(widgetConfigs)
        .set({ preChatFormEnabled: input.enabled })
        .where(eq(widgetConfigs.orgId, ctx.user.orgId))
        .returning()

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Widget config not found.",
        })
      }

      return updated
    }),
})
