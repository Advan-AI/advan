import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, permissionedProcedure } from "../trpc"
import { db } from "@/lib/db"
import { workflows, pipelineRuns, pipelineRunSteps } from "@/lib/db/schema"
import { eq, and, desc, asc, sql } from "drizzle-orm"
import { WorkflowExecutor } from "@/lib/orchestration/executor"
import { PipelineSchema, type Pipeline } from "@/lib/pipeline/schema"
import { PipelineCompiler } from "@/lib/pipeline/compiler"
import { CyclicPipelineError } from "@/lib/pipeline/topology"
import { getTemporalClient } from "@/lib/temporal/clients/workflow.client"
import { analyzeWorkflowDefinition } from "@/lib/workflows/analyzer"
import { checkWorkflowActivation, checkWorkflowRun } from "@/lib/workflows/lifecycle"

const DEFAULT_TASK_QUEUE = "advan-agents"

/**
 * Advan AI Orchestration Router.
 * Bridges the visual pipeline (Pipeline JSON) to the durable Temporal engine.
 */
export const orchestrationRouter = router({
  getWorkflows: permissionedProcedure("workflows.manage").query(async ({ ctx }) => {
    const rows = await db.query.workflows.findMany({
      where: eq(workflows.orgId, ctx.user.orgId),
      orderBy: [desc(workflows.updatedAt)],
    })

    return rows.map((workflow) => ({
      ...workflow,
      analysis: analyzeWorkflowDefinition(workflow.definition),
    }))
  }),

  // Legacy single-prompt LangGraph execution (kept for the Copilot fallback path).
  runWorkflow: permissionedProcedure("workflows.manage")
    .input(z.object({ workflowId: z.string().uuid().optional(), input: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => WorkflowExecutor.run(ctx.user.orgId, input.input)),

  saveWorkflow: permissionedProcedure("workflows.manage")
    .input(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().min(1),
        description: z.string().optional(),
        definition: PipelineSchema,
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const analysis = analyzeWorkflowDefinition(input.definition)
      const nextIsActive = input.isActive === undefined ? undefined : input.isActive && analysis.deployable

      if (input.id) {
        const updates = {
          name: input.name,
          description: input.description,
          definition: input.definition,
          version: sql`${workflows.version} + 1`,
          updatedAt: new Date(),
          ...(nextIsActive === undefined ? {} : { isActive: nextIsActive }),
        }
        const [row] = await db
          .update(workflows)
          .set(updates)
          .where(and(eq(workflows.id, input.id), eq(workflows.orgId, ctx.user.orgId)))
          .returning()
        if (!row) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" })
        }
        return row
      }

      const [row] = await db
        .insert(workflows)
        .values({
          name: input.name,
          description: input.description,
          orgId: ctx.user.orgId,
          definition: input.definition,
          isActive: nextIsActive ?? false,
        })
        .returning()
      return row
    }),

  validateWorkflow: permissionedProcedure("workflows.manage")
    .input(z.object({ definition: PipelineSchema }))
    .query(async ({ input }) => analyzeWorkflowDefinition(input.definition)),

  setWorkflowActive: permissionedProcedure("workflows.manage")
    .input(z.object({ id: z.string().uuid(), isActive: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.workflows.findFirst({
        where: and(eq(workflows.id, input.id), eq(workflows.orgId, ctx.user.orgId)),
      })
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" })
      }

      if (input.isActive) {
        const check = checkWorkflowActivation(existing.definition as Pipeline)
        if (!check.ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: check.reason ?? "Workflow is not deployable",
          })
        }
      }

      const [row] = await db
        .update(workflows)
        .set({ isActive: input.isActive, updatedAt: new Date() })
        .where(and(eq(workflows.id, input.id), eq(workflows.orgId, ctx.user.orgId)))
        .returning()
      return row
    }),

  duplicateWorkflow: permissionedProcedure("workflows.manage")
    .input(z.object({ id: z.string().uuid(), name: z.string().min(1).optional() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.workflows.findFirst({
        where: and(eq(workflows.id, input.id), eq(workflows.orgId, ctx.user.orgId)),
      })
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" })
      }

      const [row] = await db
        .insert(workflows)
        .values({
          orgId: ctx.user.orgId,
          name: input.name ?? `${existing.name} copy`,
          description: existing.description,
          definition: existing.definition,
          isActive: false,
          version: 1,
        })
        .returning()
      return row
    }),

  deleteWorkflow: permissionedProcedure("workflows.manage")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const [row] = await db
        .delete(workflows)
        .where(and(eq(workflows.id, input.id), eq(workflows.orgId, ctx.user.orgId)))
        .returning()
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" })
      }
      return { success: true }
    }),

  // Compile the visual DAG and launch the durable execution workflow.
  runPipeline: permissionedProcedure("workflows.manage")
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

      if (input.workflowId) {
        const existing = await db.query.workflows.findFirst({
          where: and(eq(workflows.id, input.workflowId), eq(workflows.orgId, ctx.user.orgId)),
        })
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" })
        }
        const check = checkWorkflowRun(existing.definition as Pipeline, existing.isActive)
        if (!check.ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: check.reason ?? "Workflow is not runnable" })
        }
      }

      try {
        const client = await getTemporalClient()
        const temporalWorkflowId = `pipeline-${ctx.user.orgId}-${Date.now()}`
        const handle = await client.workflow.start("pipelineExecutionWorkflow", {
          taskQueue: process.env.TEMPORAL_TASK_QUEUE?.trim() || DEFAULT_TASK_QUEUE,
          workflowId: temporalWorkflowId,
          args: [{ orgId: ctx.user.orgId, workflowId: input.workflowId, plan, trigger: { message: input.input } }],
        })

        return { workflowId: handle.workflowId, runId: handle.firstExecutionRunId }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Temporal is unavailable"
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE",
          message: `Durable workflow runner is unavailable. Start Temporal with npm run dev:all or run the workflow preflight instead. (${message})`,
        })
      }
    }),

  preflightPipeline: permissionedProcedure("workflows.manage")
    .input(
      z.object({
        workflowId: z.string().uuid().optional(),
        definition: PipelineSchema,
        input: z.string().optional().default("Test preflight run"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let isActive = false
      if (input.workflowId) {
        const existing = await db.query.workflows.findFirst({
          where: and(eq(workflows.id, input.workflowId), eq(workflows.orgId, ctx.user.orgId)),
        })
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" })
        }
        isActive = existing.isActive
      }

      const analysis = analyzeWorkflowDefinition(input.definition)
      if (analysis.errors > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: analysis.issues.find((issue) => issue.severity === "error")?.message ?? "Workflow is not valid",
        })
      }

      const plan = PipelineCompiler.compile(input.definition)
      return {
        ok: true,
        mode: "preflight" as const,
        isActive,
        input: input.input,
        analysis,
        planSummary: {
          waveCount: plan.waves.length,
          maxParallelism: plan.waves.length ? Math.max(...plan.waves.map((wave) => wave.length)) : 0,
          nodeCount: Object.keys(plan.nodes).length,
          edgeCount: Object.values(plan.incoming).reduce((sum, edges) => sum + edges.length, 0),
        },
      }
    }),

  getPipelineRuns: permissionedProcedure("workflows.manage")
    .input(
      z.object({
        workflowId: z.string().uuid().optional(),
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      const conditions = [eq(pipelineRuns.orgId, ctx.user.orgId)]
      if (input?.workflowId) {
        conditions.push(eq(pipelineRuns.workflowId, input.workflowId))
      }

      const runs = await db
        .select({
          id: pipelineRuns.id,
          workflowId: pipelineRuns.workflowId,
          temporalWorkflowId: pipelineRuns.temporalWorkflowId,
          temporalRunId: pipelineRuns.temporalRunId,
          status: pipelineRuns.status,
          startedAt: pipelineRuns.startedAt,
          finishedAt: pipelineRuns.finishedAt,
          workflowName: workflows.name,
        })
        .from(pipelineRuns)
        .leftJoin(workflows, eq(pipelineRuns.workflowId, workflows.id))
        .where(and(...conditions))
        .orderBy(desc(pipelineRuns.startedAt))
        .limit(20)

      return runs
    }),

  getPipelineRunDetails: permissionedProcedure("workflows.manage")
    .input(z.object({ runId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const run = await db.query.pipelineRuns.findFirst({
        where: and(eq(pipelineRuns.id, input.runId), eq(pipelineRuns.orgId, ctx.user.orgId)),
      })

      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline run not found" })
      }

      const steps = await db.query.pipelineRunSteps.findMany({
        where: eq(pipelineRunSteps.runId, run.id),
        orderBy: [asc(pipelineRunSteps.createdAt)],
      })

      const workflow = run.workflowId
        ? await db.query.workflows.findFirst({
            where: and(eq(workflows.id, run.workflowId), eq(workflows.orgId, ctx.user.orgId)),
          })
        : null

      return {
        run,
        steps,
        workflow,
      }
    }),
})
