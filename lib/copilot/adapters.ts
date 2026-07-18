import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { and, desc, eq } from "drizzle-orm"
import { getLlmRuntimeConfig, createAnthropicModel } from "@/lib/llm/config"
import { createOllamaChatOpenAI } from "@/lib/llm/ollama-openai"
import { getGroqOpenAIClient, getGroqChatModel } from "@/lib/llm/groq-client"
import { embedWithOllama } from "@/lib/vector/ollama-embeddings"
import { queryEmbeddings } from "@/lib/vector/store"
import { CitationEngine } from "@/lib/governance/citation-engine"
import { HallucinationDetector } from "@/lib/governance/hallucination-detector"
import { PolicyClient } from "@/lib/governance/policy-client"
import { PIIMasker } from "@/lib/governance/pii-masker"
import { db } from "@/lib/db"
import { auditLogs, hitlQueue, knowledgeSources, usageEvents } from "@/lib/db/schema"
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
      if (matches.length === 0) {
        return keywordKnowledgeFallback(orgId, query, k)
      }
      return matches.map((m) => ({
        id: m.id,
        title: (m.metadata?.title as string) ?? "Untitled",
        url: (m.metadata?.url as string) ?? undefined,
        snippet:
          (m.metadata?.snippet as string) ??
          (m.metadata?.content as string) ??
          "Referenced context chunk",
        score: m.score ?? 0,
      }))
    } catch {
      return keywordKnowledgeFallback(orgId, query, k)
    }
  }
}

async function keywordKnowledgeFallback(orgId: string, query: string, k: number): Promise<Source[]> {
  const terms = meaningfulTerms(query)
  if (terms.length === 0) return []

  const rows = await db
    .select({
      id: knowledgeSources.id,
      title: knowledgeSources.title,
      content: knowledgeSources.content,
      url: knowledgeSources.url,
    })
    .from(knowledgeSources)
    .where(and(eq(knowledgeSources.orgId, orgId), eq(knowledgeSources.sourceType, "document")))
    .orderBy(desc(knowledgeSources.createdAt))
    .limit(50)

  return rows
    .map((row) => {
      const haystack = `${row.title} ${row.content}`.toLowerCase()
      const hits = terms.filter((term) => haystack.includes(term)).length
      return { row, hits }
    })
    .filter(({ hits }) => hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, Math.max(1, k))
    .map(({ row, hits }) => ({
      id: row.id,
      title: row.title,
      url: row.url ?? undefined,
      snippet: bestSnippet(row.content, terms),
      score: Math.min(0.9, 0.55 + hits * 0.08),
    }))
}

function meaningfulTerms(query: string): string[] {
  const stop = new Set(["about", "after", "again", "customer", "message", "please", "policy", "support", "their", "there", "these", "those", "what", "when", "where", "with", "your"])
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/\W+/)
        .filter((term) => term.length > 3 && !stop.has(term))
        .slice(0, 20)
    )
  )
}

function bestSnippet(content: string, terms: string[], maxLen = 1200): string {
  const lower = content.toLowerCase()
  const firstHit = terms
    .map((term) => lower.indexOf(term))
    .filter((idx) => idx >= 0)
    .sort((a, b) => a - b)[0] ?? 0
  const start = Math.max(0, firstHit - 180)
  const snippet = content.slice(start, start + maxLen).trim()
  return start > 0 ? `...${snippet}` : snippet
}

// ─── Composer (single-pass streaming) ───────────────────────────────────────────

const SYSTEM_PREAMBLE = `You are a human customer support agent at Advan.
Respond directly, professionally, and empathetically like a real human.
Follow these strict support rules:
1. HUMAN TONE: Keep replies concise (1-3 short sentences). Never use robotic preambles (do NOT say "As an AI...", "As a bot...", or "As a language model"). Speak as a real human support team member.
2. STRICT COMPLIANCE: Strictly adhere to company policies (e.g., standard 30-day refund window; never offer exceptions or authorize actions outside rules without verifying details or escalating). Never fabricate or make up facts.
3. DEEP TECHNICAL SUPPORT: When a technical issue arises (e.g., API keys, HMAC webhook signature verification, network timeouts, or code integrations), provide precise, expert-level debugging and configuration support based exclusively on the provided sources. Do not speculate.
4. SOLUTION-ORIENTED: Always prioritize delivering an immediate, direct solution or actionable troubleshooting steps. Never loop on questions or ask a user for information you can infer or that they already provided.
5. NO REPETITIVE QUESTIONS: Do not ask clarifying questions repeatedly. If a source or detail is missing, provide the best possible general solution or instructions based on what you know first, and only ask a single optional follow-up question if absolutely critical. Never ask the same question twice.`

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

    const model =
      cfg.chatProvider === "anthropic" || cfg.chatProvider === "vertex-anthropic"
        ? createAnthropicModel(cfg, "claude-3-5-sonnet-20240620", 0, true)
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
    return await db.transaction(async (tx) => {
      const [row] = await tx
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

      // Do not double-count usage when generated inside the automated triage worker.
      // The triage worker records its own usage event atomically after stamping triage metadata.
      if (args.ctx.userId !== "system:auto-triage") {
        await tx.insert(usageEvents).values({
          orgId: args.ctx.orgId,
          type: "ai_message",
          quantity: 1,
        })
      }

      return row.id
    })
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
