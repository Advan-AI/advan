import { z } from "zod"
import { eq, and, desc } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { protectedProcedure, router } from "../trpc"
import { knowledgeSources } from "@/lib/db/schema"
import { db } from "@/lib/db"
import { embeddingQueue } from "@/lib/queue/queues"
import { deleteKBDocument } from "@/lib/storage/s3-client"

export const knowledgeRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        sourceType: z.enum(["document", "website", "ticket"]).optional(),
        embeddingStatus: z
          .enum(["pending", "processing", "completed", "failed"])
          .optional(),
        limit: z.number().min(1).max(100).default(25),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(knowledgeSources.orgId, ctx.user.orgId)]
      if (input.sourceType) conditions.push(eq(knowledgeSources.sourceType, input.sourceType))
      if (input.embeddingStatus)
        conditions.push(eq(knowledgeSources.embeddingStatus, input.embeddingStatus))

      const rows = await db
        .select({
          id: knowledgeSources.id,
          title: knowledgeSources.title,
          url: knowledgeSources.url,
          s3Key: knowledgeSources.s3Key,
          sourceType: knowledgeSources.sourceType,
          embeddingStatus: knowledgeSources.embeddingStatus,
          createdAt: knowledgeSources.createdAt,
        })
        .from(knowledgeSources)
        .where(and(...conditions))
        .orderBy(desc(knowledgeSources.createdAt))
        .limit(input.limit)
        .offset(input.offset)

      return rows
    }),

  add: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        content: z.string().min(1),
        url: z.string().url().optional(),
        sourceType: z.enum(["document", "website", "ticket"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [source] = await db
        .insert(knowledgeSources)
        .values({ ...input, orgId: ctx.user.orgId })
        .returning()

      // Queue embedding job — processed by embedding-worker with exponential backoff
      await embeddingQueue.add("embed" as any, {
        knowledgeSourceId: source.id,
        orgId: ctx.user.orgId,
      })

      return source
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const source = await db.query.knowledgeSources.findFirst({
        where: and(
          eq(knowledgeSources.id, input.id),
          eq(knowledgeSources.orgId, ctx.user.orgId)
        ),
      })

      if (!source) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Knowledge source not found" })
      }

      // Clean up S3 document
      if (source.s3Key) {
        await deleteKBDocument(source.s3Key).catch(() => {})
      }

      await db
        .delete(knowledgeSources)
        .where(eq(knowledgeSources.id, input.id))

      return { success: true }
    }),
})
