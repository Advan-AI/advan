import { Worker, UnrecoverableError, type Job } from "bullmq"
import { and, asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { auditLogs, conversations, hitlQueue, messages, tickets } from "@/lib/db/schema"
import { SuggestionService } from "@/lib/copilot/suggestion-service"
import {
  DrizzleAudit,
  GovernanceGrounding,
  OpaPolicy,
  PgVectorRetrieval,
  StreamingComposer,
} from "@/lib/copilot/adapters"
import { confidenceScorer } from "@/lib/copilot/scorer"
import type { Citation, HitlPort, SuggestionContext, SuggestionEvent } from "@/lib/copilot/types"
import {
  classifyMessage,
  type ComplaintClassification,
} from "@/lib/governance/complaint-classifier"
import { insertAgentMessage } from "@/lib/conversations/insert-agent-message"
import {
  publishHitlNew,
  publishChatTriagePending,
} from "@/lib/realtime/event-bus"
import { type CopilotTriageJob } from "../queues"

// ─── Constants ────────────────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLD = 85

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
        policyPassed = event.checks.every((c) => c.passed)
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
  /**
   * Override the complaint classifier.
   * Inject a fake in tests to avoid real LLM calls.
   */
  classifier?: (content: string, history?: string[]) => Promise<ComplaintClassification>
  /**
   * Override the draft generation pipeline.
   * Inject a fake in tests to avoid real LLM/vector calls.
   */
  draftGenerator?: DraftGeneratorFn
}

// ─── Core triage logic ────────────────────────────────────────────────────────

type TriageDecision = "auto_send" | "hitl_complaint" | "hitl_low_confidence"

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

  const [classification, draft] = await Promise.all([
    classify(existing.content, history),
    generateDraft(suggestionCtx),
  ])

  const latencyMs = Date.now() - t0

  console.log(
    `[TriageWorker] Classification: isComplaint=${classification.isComplaint} severity=${classification.severity} ` +
    `confidence=${draft.confidence} policyPassed=${draft.policyPassed} latency=${latencyMs}ms`
  )

  // ── 4. Decision gate ────────────────────────────────────────────────────────
  let decision: TriageDecision

  if (classification.isComplaint) {
    // Never auto-send a complaint regardless of model confidence.
    decision = "hitl_complaint"
  } else if (draft.confidence >= CONFIDENCE_THRESHOLD && draft.policyPassed) {
    decision = "auto_send"
  } else {
    decision = "hitl_low_confidence"
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
  if (decision === "auto_send") {
    const { message: agentMsg } = await insertAgentMessage({
      orgId,
      conversationId,
      content: draft.finalText,
      metadata: {
        confidence: draft.confidence,
        citations: draft.citations.map((c) => ({
          source: c.title,
          url: c.url,
          confidence: c.confidence,
        })),
        model: "advan-copilot-v1",
        isAutoTriaged: true,
      },
    })
    console.log(`[TriageWorker] Auto-sent agent reply for message=${messageId}`)
    // Note: chat visitor notification (publishChatAgentReply) is now emitted
    // inside insertAgentMessage for all channels, same as the email path enqueues
    // to notificationQueue there. No channel-specific emit needed here.
  } else {
    const reason =
      decision === "hitl_complaint"
        ? `[COMPLAINT] ${classification.severity} — ${classification.reasoning.slice(0, 200)}`
        : `Confidence ${draft.confidence}% below threshold or policy failed`

    const priority = decision === "hitl_complaint" ? "complaint" : "low_confidence"

    const [hitlRow] = await db
      .insert(hitlQueue)
      .values({
        orgId,
        ticketId,
        conversationId,
        draftOutput: draft.finalText,
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
        },
      })
      .returning()

    // Fan out to connected reviewers (cross-process via Redis pub/sub).
    try {
      await publishHitlNew(orgId, hitlRow)
    } catch {
      // Non-fatal: reviewers will poll if pub/sub is unavailable.
    }

    // For non-email channels: signal the visitor that a human agent will
    // respond, so the widget shows the correct waiting state instead of
    // leaving the visitor in silence while the complaint is reviewed.
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
  }

  // ── 7. Stamp triage metadata on the original customer message ───────────────
  await db
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
        },
      },
    })
    .where(eq(messages.id, messageId))

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
