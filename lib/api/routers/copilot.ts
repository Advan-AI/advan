import { z } from "zod"
import { router, protectedProcedure } from "../trpc"
import { CopilotDecisionService } from "@/lib/copilot/decision-service"

/**
 * Co-Pilot router — agent decisions on AI suggestions.
 * Streaming generation lives at POST /api/copilot/stream (SSE); this router
 * handles the durable accept/reject/modify mutation.
 */
export const copilotRouter = router({
  decide: protectedProcedure
    .input(
      z.object({
        suggestionId: z.string().uuid(),
        action: z.enum(["accept", "reject", "modify"]),
        finalText: z.string().max(20000).optional(),
        hitlId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return CopilotDecisionService.apply({
        orgId: ctx.user.orgId,
        userId: ctx.user.id,
        suggestionId: input.suggestionId,
        action: input.action,
        finalText: input.finalText,
        hitlId: input.hitlId,
      })
    }),
})
