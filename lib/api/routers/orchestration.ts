import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure } from "../trpc"
import { db } from "@/lib/db"
import { workflows } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { WorkflowExecutor } from "@/lib/orchestration/executor"
import { PipelineSchema } from "@/lib/pipeline/schema"
import { PipelineCompiler } from "@/lib/pipeline/compiler"
import { CyclicPipelineError } from "@/lib/pipeline/topology"
import { getTemporalClient } from "@/lib/temporal/clients/workflow.client"

const DEFAULT_TASK_QUEUE = "advan-agents"

/**
 * Advan AI Orchestration Router.
 * Bridges the visual pipeline (Pipeline JSON) to the durable Temporal engine.
 */
export const orchestrationRouter = router({
  getWorkflows: protectedProcedure.query(async ({ ctx }) => {
    return db.query.workflows.findMany({ where: eq(workflows.orgId, ctx.user.orgId) })
  }),

  // Legacy single-prompt LangGraph execution (kept for the Copilot fallback path).
  runWorkflow: protectedProcedure
    .input(z.object({ workflowId: z.string().uuid().optional(), input: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => WorkflowExecutor.run(ctx.user.orgId, input.input)),

  saveWorkflow: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().min(1),
        definition: PipelineSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Save-time authoritative cycle guard.
      try {
        PipelineCompiler.compile(input.definition)
      } catch (err) {
        if (err instanceof CyclicPipelineError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message })
        }
        throw err
      }

      if (input.id) {
        const [row] = await db
          .update(workflows)
          .set({ name: input.name, definition: input.definition, updatedAt: new Date() })
          .where(and(eq(workflows.id, input.id), eq(workflows.orgId, ctx.user.orgId)))
          .returning()
        return row
      }

      const [row] = await db
        .insert(workflows)
        .values({ name: input.name, orgId: ctx.user.orgId, definition: input.definition })
        .returning()
      return row
    }),

  // Compile the visual DAG and launch the durable execution workflow.
  runPipeline: protectedProcedure
    .input(
      z.object({
        workflowId: z.string().uuid().optional(),
        definition: PipelineSchema,
        input: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let plan
      try {
        plan = PipelineCompiler.compile(input.definition)
      } catch (err) {
        const msg = err instanceof CyclicPipelineError ? err.message : "Invalid pipeline definition"
        throw new TRPCError({ code: "BAD_REQUEST", message: msg })
      }

      const client = await getTemporalClient()
      const temporalWorkflowId = `pipeline-${ctx.user.orgId}-${Date.now()}`
      const handle = await client.workflow.start("pipelineExecutionWorkflow", {
        taskQueue: process.env.TEMPORAL_TASK_QUEUE?.trim() || DEFAULT_TASK_QUEUE,
        workflowId: temporalWorkflowId,
        args: [{ orgId: ctx.user.orgId, workflowId: input.workflowId, plan, trigger: { message: input.input } }],
      })

      return { workflowId: handle.workflowId, runId: handle.firstExecutionRunId }
    }),
})
