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

export const integrationsRouter = router({
  /**
   * getWidgetConfig:
   * Returns the single widget config for the caller's organization, or null if it doesn't exist.
   */
  getWidgetConfig: protectedProcedure.query(async ({ ctx }) => {
    const config = await db.query.widgetConfigs.findFirst({
      where: eq(widgetConfigs.orgId, ctx.user.orgId),
    })
    return config ?? null
  }),

  /**
   * createWidgetConfig:
   * Provisions a new widget configuration for the org with a securely generated key.
   * Enforces 1:1 relation—if an org already has a config, it throws an error.
   */
  createWidgetConfig: protectedProcedure.mutation(async ({ ctx }) => {
    // Determine if one already exists
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
   * updateWidgetOrigins:
   * Updates the `allowedOrigins` array for the caller's widget config.
   */
  updateWidgetOrigins: protectedProcedure
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
   * rotateWidgetKey:
   * Generates a new widget key, invalidating the old one immediately.
   */
  rotateWidgetKey: protectedProcedure.mutation(async ({ ctx }) => {
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
   * deleteWidgetConfig:
   * Disables the widget entirely by deleting the config row.
   */
  deleteWidgetConfig: protectedProcedure.mutation(async ({ ctx }) => {
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
})
