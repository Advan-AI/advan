import { ChatAnthropic } from "@langchain/anthropic"
import { ChatOpenAI } from "@langchain/openai"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { getLlmRuntimeConfig } from "@/lib/llm/config"
import { createOllamaChatOpenAI } from "@/lib/llm/ollama-openai"
import { getGroqOpenAIClient, getGroqChatModel } from "@/lib/llm/groq-client"
import { embedWithOllama } from "@/lib/vector/ollama-embeddings"
import { queryEmbeddings } from "@/lib/vector/store"
import { CitationEngine } from "@/lib/governance/citation-engine"
import { HallucinationDetector } from "@/lib/governance/hallucination-detector"
import { PolicyClient } from "@/lib/governance/policy-client"
import { PIIMasker } from "@/lib/governance/pii-masker"
import { db } from "@/lib/db"
import { auditLogs, hitlQueue } from "@/lib/db/schema"
import { publishHitlNew } from "@/lib/realtime/event-bus"
import type {
  AuditPort,
  ComposerPort,
  GroundingPort,
  GroundingResult,
  HitlPort,
  PolicyCheck,
  PolicyPort,
  RetrievalPort,
  Source,
} from "./types"

// ─── Retrieval ────────────────────────────────────────────────────────────────

/** pgvector + Ollama embeddings retrieval. Degrades to empty set on failure. */
export class PgVectorRetrieval implements RetrievalPort {
  async retrieve(orgId: string, query: string, k: number): Promise<Source[]> {
    try {
      const vec = await embedWithOllama(query.slice(0, 8000))
      const matches = await queryEmbeddings(orgId, vec, k)
      return matches.map((m) => ({
        id: m.id,
        title: (m.metadata?.title as string) ?? "Untitled",
        url: (m.metadata?.url as string) ?? undefined,
        snippet: (m.metadata?.snippet as string) ?? "Referenced context chunk",
        score: m.score ?? 0,
      }))
    } catch {
      return []
    }
  }
}

// ─── Composer (single-pass streaming) ───────────────────────────────────────────

const SYSTEM_PREAMBLE = `You are Advan AI, a transparent customer support specialist.
Base every answer on the provided knowledge sources. Never fabricate facts.
If the sources don't cover the question, say so explicitly.`

function buildSystemPrompt(sources: Source[], intent?: string): string {
  const ctx = sources.length
    ? sources.map((s, i) => `[${i + 1}] ${s.title}: ${s.snippet}`).join("\n")
    : "No sources retrieved — answer from general knowledge only if safe."
  return `${SYSTEM_PREAMBLE}\n\nKnowledge sources:\n${ctx}${intent ? `\n\nIntent: ${intent}` : ""}`
}

/**
 * Streams answer tokens in a SINGLE pass (fixes the old double-execution bug
 * where the graph ran once to stream and once to score).
 *
 * Primary: Anthropic Sonnet or local Ollama. Streaming fallback: Groq.
 */
export class StreamingComposer implements ComposerPort {
  async *compose(args: { input: string; intent?: string; sources: Source[] }): AsyncIterable<string> {
    const masked = PIIMasker.mask(args.input)
    const system = buildSystemPrompt(args.sources, args.intent)
    const cfg = getLlmRuntimeConfig()

    const model: ChatAnthropic | ChatOpenAI | null =
      cfg.chatProvider === "anthropic" && cfg.anthropicApiKey
        ? new ChatAnthropic({ modelName: "claude-3-5-sonnet-20240620", temperature: 0, apiKey: cfg.anthropicApiKey, streaming: true })
        : createOllamaChatOpenAI(cfg, cfg.ollamaChatModel)

    try {
      const stream = await model.stream([new SystemMessage(system), new HumanMessage(masked)])
      for await (const chunk of stream) {
        const text = chunk?.content?.toString() ?? ""
        if (text) yield text
      }
      return
    } catch {
      // Streaming fallback: Groq (OpenAI-compatible)
      const groq = getGroqOpenAIClient()
      if (!groq) throw new Error("All chat providers unavailable")
      const completion = await groq.chat.completions.create({
        model: getGroqChatModel(),
        messages: [
          { role: "system", content: system },
          { role: "user", content: masked },
        ],
        temperature: 0,
        stream: true,
      })
      for await (const part of completion) {
        const text = part.choices[0]?.delta?.content ?? ""
        if (text) yield text
      }
    }
  }
}

// ─── Grounding (citations + hallucination) ──────────────────────────────────────

/**
 * Verifies the accumulated answer against the SAME sources used to compose it
 * (fixes the old bug where CitationEngine was called with an empty array, pinning
 * confidence to a constant 70).
 */
export class GovernanceGrounding implements GroundingPort {
  async ground(answer: string, sources: Source[], orgId: string): Promise<GroundingResult> {
    const grounded = await CitationEngine.verify(
      answer,
      sources.map((s) => ({ id: s.id, title: s.title, url: s.url, snippet: s.snippet, score: s.score })),
      orgId
    )
    const hallucination = await HallucinationDetector.detect(
      grounded.answer,
      sources.map((s) => ({ id: s.id, title: s.title, snippet: s.snippet, score: s.score })),
      orgId
    )
    return {
      answer: grounded.answer,
      citations: grounded.citations,
      groundingScore: grounded.overallConfidence / 100,
      hallucination: { isHallucination: hallucination.isHallucination, score: hallucination.score, flags: hallucination.flags },
    }
  }
}

// ─── Policy (OPA pre/post checks) ───────────────────────────────────────────────

export class OpaPolicy implements PolicyPort {
  async preCheck(input: string): Promise<{ allow: boolean; reason?: string }> {
    const d = await PolicyClient.evaluate("advan/safety/intent", {
      intent: PIIMasker.mask(input).slice(0, 200),
      emergency_lock: false,
      toxic: false,
    })
    return { allow: d.allow, reason: d.reason }
  }

  async postCheck(args: { answer: string; confidence: number }): Promise<PolicyCheck[]> {
    const handoff = await PolicyClient.evaluate("advan/handoff", { confidence: args.confidence })
    const pii = await PolicyClient.evaluate("advan/privacy/pii", {
      has_pii: PIIMasker.hasPII(args.answer),
      masked: false,
    })
    return [
      { rule: "advan/safety/intent", passed: true },
      { rule: "advan/handoff", passed: handoff.allow, reason: handoff.reason },
      { rule: "advan/privacy/pii", passed: pii.allow, reason: pii.reason },
    ]
  }
}

// ─── Audit persistence ──────────────────────────────────────────────────────────

export class DrizzleAudit implements AuditPort {
  async persist(args: Parameters<AuditPort["persist"]>[0]): Promise<string> {
    const [row] = await db
      .insert(auditLogs)
      .values({
        orgId: args.ctx.orgId,
        ticketId: args.ctx.ticketId ?? null,
        input: PIIMasker.mask(args.ctx.input),
        output: args.answer,
        metadata: {
          confidence: args.confidence,
          citations: args.citations.map((c) => ({ source: c.title, content: c.snippet, score: c.confidence, url: c.url })),
          policyChecks: args.checks,
          latencyMs: args.latencyMs,
          hallucinationFlags: args.hallucinationFlags,
          model: "advan-copilot-v1",
        },
      })
      .returning({ id: auditLogs.id })
    return row.id
  }
}

// ─── HITL enqueue ─────────────────────────────────────────────────────────────

export class DrizzleHitl implements HitlPort {
  async enqueue(args: Parameters<HitlPort["enqueue"]>[0]): Promise<string> {
    const [row] = await db
      .insert(hitlQueue)
      .values({
        orgId: args.orgId,
        ticketId: args.ticketId ?? null,
        draftOutput: args.draftOutput,
        reason: args.reason,
        status: "pending",
      })
      .returning()
    // Fan out to any connected reviewers (cross-process via Redis pub/sub).
    await publishHitlNew(args.orgId, row)
    return row.id
  }
}
