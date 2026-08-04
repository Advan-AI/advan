import { Worker, UnrecoverableError, type Job } from "bullmq"
import { and, asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { auditLogs, conversations, hitlQueue, messages, tickets, usageEvents, workflows } from "@/lib/db/schema"
import { SuggestionService } from "@/lib/copilot/suggestion-service"
import {
  DrizzleAudit,
  GovernanceGrounding,
  OpaPolicy,
  PgVectorRetrieval,
  StreamingComposer,
} from "@/lib/copilot/adapters"
import { confidenceScorer } from "@/lib/copilot/scorer"
import { buildConversationalReply } from "@/lib/copilot/conversational-replies"
import type { Citation, HitlPort, SuggestionContext, SuggestionEvent } from "@/lib/copilot/types"
import { PipelineCompiler } from "@/lib/pipeline/compiler"
import { type Pipeline } from "@/lib/pipeline/schema"
import { getTemporalClient } from "@/lib/temporal/clients/workflow.client"
import {
  classifyMessage,
  type ComplaintClassification,
} from "@/lib/governance/complaint-classifier"
import { insertAgentMessage } from "@/lib/conversations/insert-agent-message"
import {
  publishHitlNew,
  publishChatTriagePending,
} from "@/lib/realtime/event-bus"
import { assessConversationEscalation } from "@/lib/tickets/conversation-escalation"
import { resolveChatIntent } from "@/lib/tickets/chat-intent"
import { type CopilotTriageJob } from "../queues"

// ─── Constants ────────────────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLD = Number(process.env.TRIAGE_AUTO_SEND_THRESHOLD ?? 85)

// ─── No-op HITL port ─────────────────────────────────────────────────────────

/**
 * The SuggestionService normally enqueues to HITL when confidence is low or
 * policy fails. In the triage worker we own the HITL decision (incorporating
 * the complaint classifier result), so we give the service a no-op HITL port
 * to prevent double-enqueue. The worker handles HITL directly below.
 */
class NoOpHitl implements HitlPort {
  async enqueue(): Promise<string> {
    return "noop"
  }
}

// ─── Service factory ──────────────────────────────────────────────────────────

function buildTriageService(): SuggestionService {
  return new SuggestionService(
    new PgVectorRetrieval(),
    new StreamingComposer(),
    new GovernanceGrounding(),
    new OpaPolicy(),
    confidenceScorer,
    new DrizzleAudit(),
    new NoOpHitl()
  )
}

// ─── Draft generator type ─────────────────────────────────────────────────────

export interface DraftResult {
  finalText: string
  confidence: number
  auditLogId: string
  policyPassed: boolean
  citations: Citation[]
}

export type DraftGeneratorFn = (ctx: SuggestionContext) => Promise<DraftResult>

// ─── Consume the SuggestionService generator ─────────────────────────────────

/**
 * Run the SuggestionService to completion and collect the signals we need
 * for the triage decision. Uses the NoOpHitl service so it never double-enqueues.
 */
async function defaultDraftGenerator(ctx: SuggestionContext): Promise<DraftResult> {
  const service = buildTriageService()
  let finalText = ""
  let confidence = 0
  let auditLogId = ""
  let policyPassed = true
  const citations: Citation[] = []

  for await (const event of service.run(ctx) as AsyncGenerator<SuggestionEvent>) {
    switch (event.type) {
      case "score":
        if (event.stage === "final") confidence = event.value
        break
      case "citation":
        citations.push(event.citation)
        break
      case "policy":
        // Handoff mirrors the confidence threshold we apply below — only safety/PII
        // gates should block auto-send here.
        policyPassed = event.checks
          .filter((c) => c.rule !== "advan/handoff")
          .every((c) => c.passed)
        break
      case "done":
        finalText = event.finalText
        auditLogId = event.suggestionId
        break
      case "error":
        throw new Error(`Draft generation error: ${event.message}`)
    }
  }

  return { finalText, confidence, auditLogId, policyPassed, citations }
}

// ─── Deps (injectable for tests) ─────────────────────────────────────────────

export interface TriageDeps {
  classifier?: (content: string, history?: string[]) => Promise<ComplaintClassification>
  draftGenerator?: DraftGeneratorFn
  /** Override KB retrieval scores (tests). */
  retrieve?: (orgId: string, query: string, k: number) => Promise<Array<{ score: number }>>
}

// ─── Core triage logic ────────────────────────────────────────────────────────

type TriageDecision =
  | "auto_send"
  | "auto_clarify"
  | "auto_warn"
  | "auto_escalate"
  | "hitl_complaint"
  | "hitl_collaborative"
  | "hitl_low_confidence"

type AgentReplyPlan = {
  content: string
  triageMode: "kb_answer" | "clarify" | "warn" | "escalate_ack" | "complaint_ack"
}

function planAgentReply(args: {
  decision: TriageDecision
  userMessage: string
  draftText: string
  classification: ComplaintClassification
}): AgentReplyPlan | null {
  const { decision, userMessage, draftText, classification } = args

  const hasDraft = typeof draftText === "string" && draftText.trim().length > 0

  switch (decision) {
    case "auto_send":
      return { content: draftText, triageMode: "kb_answer" }
    case "auto_clarify":
      return {
        content: hasDraft ? draftText : buildConversationalReply("clarify", { userMessage }),
        triageMode: "clarify",
      }
    case "auto_warn":
      return {
        content: hasDraft ? draftText : buildConversationalReply("warn", { userMessage }),
        triageMode: "warn",
      }
    case "auto_escalate":
      return {
        content: hasDraft ? draftText : buildConversationalReply("escalate_ack", { userMessage }),
        triageMode: "escalate_ack",
      }
    case "hitl_collaborative":
      return {
        content: buildConversationalReply("complaint_ack", {
          userMessage,
          classificationReason: classification.reasoning,
        }),
        triageMode: "complaint_ack",
      }
    case "hitl_complaint":
    case "hitl_low_confidence":
      return null
  }
}

function needsHitlQueue(decision: TriageDecision): boolean {
  return (
    decision === "hitl_complaint" ||
    decision === "hitl_collaborative" ||
    decision === "hitl_low_confidence" ||
    decision === "auto_escalate"
  )
}

function hitlPriority(decision: TriageDecision): "complaint" | "low_confidence" {
  return decision === "hitl_low_confidence" ? "low_confidence" : "complaint"
}

/**
 * Process one CopilotTriageJob.
 *
 * Pipeline:
 *   1. Idempotency check — no-op if message already has a triage decision.
 *   2. Load message + conversation + ticket + recent history.
 *   3. Run complaint classifier AND draft generation in parallel to minimise
 *      added latency (both are independent LLM calls).
 *   4. Apply decision gate:
 *      - isComplaint=true → hitlQueue (higher-priority reason prefix)
 *      - confidence ≥ 85 and policy passes → auto-send via insertAgentMessage
 *      - otherwise → hitlQueue (normal priority)
 *   5. Update auditLogs row with source="auto_triage" and complaint
 *      classification metadata so Tap Box can filter by origin.
 *   6. Stamp messages.metadata.triage with the final decision.
 */
export async function processTriageJob(
  job: Job<CopilotTriageJob>,
  deps: TriageDeps = {}
): Promise<void> {
  const { orgId, ticketId, conversationId, messageId } = job.data
  const t0 = Date.now()
  const classify = deps.classifier ?? classifyMessage
  const generateDraft = deps.draftGenerator ?? defaultDraftGenerator
  const retrieve =
    deps.retrieve ??
    (async (orgId: string, query: string, k: number) => {
      const sources = await new PgVectorRetrieval().retrieve(orgId, query, k)
      return sources.map((s) => ({ score: s.score }))
    })

  console.log(`[TriageWorker] Processing message=${messageId} ticket=${ticketId}`)

  // ── 1. Idempotency guard ────────────────────────────────────────────────────
  const existing = await db.query.messages.findFirst({
    where: eq(messages.id, messageId),
  })

  if (!existing) {
    throw new UnrecoverableError(`Message ${messageId} not found — dropping job`)
  }

  if (existing.metadata?.triage?.decision) {
    console.log(
      `[TriageWorker] No-op — message ${messageId} already has triage decision: ${existing.metadata.triage.decision}`
    )
    return
  }

  if (existing.role !== "user") {
    throw new UnrecoverableError(
      `Message ${messageId} has role="${existing.role}"; triage only applies to user messages`
    )
  }

  // ── 2. Load context ─────────────────────────────────────────────────────────
  const conv = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, conversationId), eq(conversations.orgId, orgId)),
  })
  if (!conv) {
    throw new UnrecoverableError(`Conversation ${conversationId} not found for org ${orgId}`)
  }

  const ticket = await db.query.tickets.findFirst({
    where: and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)),
  })
  if (!ticket) {
    throw new UnrecoverableError(`Ticket ${ticketId} not found for org ${orgId}`)
  }

  // ── 2.5. Active Orchestration Workflow Check ───────────────────────────────
  // Chat keeps the default auto-triage path so visitors get real-time replies
  // via insertAgentMessage → Socket.IO. Orchestration pipelines are for email /
  // durable ops and currently do not emit chat-widget agent:message events.
  const activeWorkflow =
    conv.channel === "chat"
      ? null
      : await db.query.workflows.findFirst({
          where: and(eq(workflows.orgId, orgId), eq(workflows.isActive, true)),
        })

  if (activeWorkflow) {
    console.log(
      `[TriageWorker] Found active orchestration workflow for orgId=${orgId}: "${activeWorkflow.name}" (id=${activeWorkflow.id}). Compiling and launching durable pipeline execution.`
    )
    try {
      // Compile visual DAG definition into execution plan
      const plan = PipelineCompiler.compile(activeWorkflow.definition as Pipeline)

      // Start Temporal workflow execution
      const client = await getTemporalClient()
      const temporalWorkflowId = `pipeline-${orgId}-${Date.now()}`
      const handle = await client.workflow.start("pipelineExecutionWorkflow", {
        taskQueue: process.env.TEMPORAL_TASK_QUEUE?.trim() || "advan-agents",
        workflowId: temporalWorkflowId,
        args: [
          {
            orgId,
            workflowId: activeWorkflow.id,
            plan,
            trigger: { message: existing.content },
            ticketId,
            conversationId,
          },
        ],
      })

      console.log(
        `[TriageWorker] Successfully started orchestration pipeline run. workflowId=${temporalWorkflowId} runId=${handle.firstExecutionRunId}`
      )

      // Stamp message metadata with orchestrated triage decision
      await db
        .update(messages)
        .set({
          metadata: {
            ...(existing.metadata ?? {}),
            triage: {
              decision: "orchestrated" as any,
              confidence: 100,
              classifiedAt: new Date().toISOString(),
              activeWorkflowId: activeWorkflow.id,
              temporalWorkflowId,
              temporalRunId: handle.firstExecutionRunId,
            },
          },
        })
        .where(eq(messages.id, messageId))

      // Record metered AI usage event for this orchestration pipeline conversation run
      await db.insert(usageEvents).values({
        orgId,
        type: "ai_message",
        quantity: 1,
      })

      return
    } catch (err) {
      console.error(
        `[TriageWorker] Failed to launch orchestration pipeline. Falling back to default triage path. Error:`,
        err instanceof Error ? err.message : String(err)
      )
    }
  }

  // Full thread for escalation detection (oldest-first)
  const threadRows = await db
    .select({ content: messages.content, role: messages.role })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
    .limit(30)

  const escalation = assessConversationEscalation(
    threadRows.map((r) => ({
      role: r.role as "user" | "agent" | "assistant",
      content: r.content,
    }))
  )

  // Last N user messages for classifier context (oldest-first, excluding current)
  const historyRows = await db
    .select({ content: messages.content, role: messages.role })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.role, "user")
      )
    )
    .orderBy(asc(messages.createdAt))
    .limit(10)

  const history = historyRows
    .filter((r) => r.content !== existing.content)
    .slice(-5)
    .map((r) => r.content)

  // ── 3. Run classifier + draft generation in parallel ────────────────────────
  const suggestionCtx: SuggestionContext = {
    orgId,
    userId: "system:auto-triage",
    input: existing.content,
    ticketId,
    threshold: CONFIDENCE_THRESHOLD,
  }

  const [classification, draft, retrieved] = await Promise.all([
    classify(existing.content, history),
    generateDraft(suggestionCtx),
    retrieve(orgId, existing.content, 6),
  ])

  const topRetrievalScore =
    retrieved.length > 0 ? Math.max(...retrieved.map((s) => s.score ?? 0)) : 0

  const intent = resolveChatIntent({
    content: existing.content,
    topRetrievalScore,
    classification,
    needsHumanHandoff: escalation.shouldEscalate,
    confidence: draft.confidence,
    confidenceThreshold: CONFIDENCE_THRESHOLD,
  })

  const latencyMs = Date.now() - t0

  console.log(
    `[TriageWorker] Classification: isComplaint=${classification.isComplaint} severity=${classification.severity} ` +
    `intent=${intent.intent} topRetrieval=${topRetrievalScore.toFixed(2)} ` +
    `confidence=${draft.confidence} policyPassed=${draft.policyPassed} latency=${latencyMs}ms`
  )

  // ── 4. Decision gate ────────────────────────────────────────────────────────
  let decision: TriageDecision

  if (intent.intent === "human_handoff") {
    decision = "auto_escalate"
  } else if (intent.intent === "complaint_review") {
    decision = "hitl_collaborative"
  } else if (intent.intent === "off_topic") {
    decision = "auto_warn"
  } else if (
    intent.intent === "kb_answer" &&
    draft.confidence >= CONFIDENCE_THRESHOLD &&
    draft.policyPassed
  ) {
    decision = "auto_send"
  } else if (intent.intent === "clarify") {
    decision = "auto_clarify"
  } else if (draft.confidence >= CONFIDENCE_THRESHOLD && draft.policyPassed) {
    decision = "auto_send"
  } else {
    decision = "auto_clarify"
  }

  // ── 5. Update the audit log with triage metadata ────────────────────────────
  if (draft.auditLogId && draft.auditLogId !== "noop") {
    const auditRow = await db.query.auditLogs.findFirst({
      where: eq(auditLogs.id, draft.auditLogId),
    })
    if (auditRow) {
      await db
        .update(auditLogs)
        .set({
          metadata: {
            ...auditRow.metadata,
            source: "auto_triage",
            complaintClassification: {
              isComplaint: classification.isComplaint,
              severity: classification.severity,
              sentiment: classification.sentiment,
              reasoning: classification.reasoning,
            },
          },
        })
        .where(eq(auditLogs.id, draft.auditLogId))
    }
  }

  // ── 6. Execute decision ─────────────────────────────────────────────────────
  const replyPlan = planAgentReply({
    decision,
    userMessage: existing.content,
    draftText: draft.finalText,
    classification,
  })

  if (replyPlan) {
    await insertAgentMessage({
      orgId,
      conversationId,
      content: replyPlan.content,
      metadata: {
        confidence: draft.confidence,
        citations:
          decision === "auto_send"
            ? draft.citations.map((c) => ({
                source: c.title,
                url: c.url,
                confidence: c.confidence,
              }))
            : undefined,
        model: "advan-copilot-v1",
        isAutoTriaged: true,
        triageMode: replyPlan.triageMode,
      },
    })
    console.log(`[TriageWorker] Auto-sent ${decision} reply for message=${messageId}`)
  }

  if (needsHitlQueue(decision)) {
    const reason =
      decision === "auto_escalate"
        ? `[UNRESOLVED] ${escalation.signals.join("; ").slice(0, 200) || "Customer needs human collaboration"}`
        : decision === "hitl_collaborative"
          ? `[COMPLAINT] ${classification.severity} — ${classification.reasoning.slice(0, 200)}`
          : (decision as string) === "hitl_complaint"
            ? `[COMPLAINT] ${classification.severity} — ${classification.reasoning.slice(0, 200)}`
            : `Confidence ${draft.confidence}% below threshold or policy failed`

    const priority = hitlPriority(decision as any)

    const [hitlRow] = await db
      .insert(hitlQueue)
      .values({
        orgId,
        ticketId,
        conversationId,
        draftOutput: replyPlan?.content ?? draft.finalText,
        reason,
        status: "pending",
        priority,
        source: "auto_triage",
        classificationMetadata: {
          isComplaint: classification.isComplaint,
          severity: classification.severity,
          sentiment: classification.sentiment,
          reasoning: classification.reasoning,
          draftConfidence: draft.confidence,
          auditLogId: draft.auditLogId,
          chatIntent: intent.intent,
          collaborative: decision === "auto_escalate" || decision === "hitl_collaborative",
          escalationSignals: escalation.signals,
        },
      })
      .returning()

    try {
      await publishHitlNew(orgId, hitlRow)
    } catch {
      // Non-fatal: reviewers will poll if pub/sub is unavailable.
    }

    if (conv.channel !== "email") {
      try {
        await publishChatTriagePending(orgId, {
          conversationId,
          priority: priority as "complaint" | "low_confidence",
        })
      } catch {
        // Non-fatal: visitor UI falls back to polling state.
      }
    }

    console.log(`[TriageWorker] Enqueued HITL id=${hitlRow.id} decision=${decision}`)
  } else if (!replyPlan) {
    console.log(`[TriageWorker] No auto-reply for message=${messageId} decision=${decision}`)
  }

  // ── 7. Stamp triage metadata and write usage event atomically ───────────────
  await db.transaction(async (tx) => {
    await tx
      .update(messages)
      .set({
        metadata: {
          ...(existing.metadata ?? {}),
          triage: {
            decision,
            confidence: draft.confidence,
            isComplaint: classification.isComplaint,
            auditLogId: draft.auditLogId,
            classifiedAt: new Date().toISOString(),
            chatIntent: intent.intent,
          },
        },
      })
      .where(eq(messages.id, messageId))

    await tx
      .insert(usageEvents)
      .values({
        orgId,
        type: "ai_message",
        quantity: 1,
      })
  })

  console.log(
    `[TriageWorker] ✓ Done message=${messageId} decision=${decision} totalMs=${Date.now() - t0}`
  )
}

// ─── BullMQ worker bootstrap ──────────────────────────────────────────────────

function getConnectionConfig() {
  const url = process.env.REDIS_URL
  if (!url) throw new Error("[TriageWorker] REDIS_URL is not set")
  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    tls: url.startsWith("rediss://") ? {} : undefined,
    maxRetriesPerRequest: null as null,
    enableReadyCheck: false,
    family: 0,
  }
}

export function startTriageWorker() {
  const worker = new Worker<CopilotTriageJob>(
    "copilot-triage",
    async (job) => processTriageJob(job),
    {
      connection: getConnectionConfig(),
      concurrency: 3,
    }
  )

  worker.on("completed", (job) => {
    console.log(`[TriageWorker] Job ${job.id} completed`)
  })

  worker.on("failed", (job, err) => {
    console.error(`[TriageWorker] Job ${job?.id} failed:`, err.message)
  })

  return worker
}

const isMain =
  typeof process !== "undefined" &&
  process.argv[1]?.includes("copilot-triage-worker")

if (isMain) {
  console.log("[TriageWorker] Starting...")
  startTriageWorker()
}
