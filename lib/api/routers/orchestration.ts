import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { db } from '@/lib/db';
import { workflows } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Advan AI Orchestration Router (Layer 2 -> Layer 5 bridge)
 */
export const orchestrationRouter = router({
  getWorkflows: protectedProcedure.query(async ({ ctx }) => {
    return await db.query.workflows.findMany({
      where: eq(workflows.orgId, ctx.user.orgId),
    });
  }),

  saveWorkflow: protectedProcedure
    .input(z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1),
      definition: z.record(z.any()),
    }))
    .mutation(async ({ input, ctx }) => {
      if (input.id) {
        return await db
          .update(workflows)
          .set({ 
            name: input.name, 
            definition: input.definition, 
            updatedAt: new Date() 
          })
          .where(and(eq(workflows.id, input.id), eq(workflows.orgId, ctx.user.orgId)))
          .returning();
      }

      return await db
        .insert(workflows)
        .values({
          name: input.name,
          orgId: ctx.user.orgId,
          definition: input.definition,
        })
        .returning();
    }),
});
