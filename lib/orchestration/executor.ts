import { orchestrationEngine } from './engine';
import { db } from '@/lib/db';
import { auditLogs } from '@/lib/db/schema';
import { CitationEngine } from '@/lib/governance/citation-engine';
import { HumanMessage } from '@langchain/core/messages';

/**
 * Advan AI Workflow Executor (Layer 4)
 * Manages the execution lifecycle of a LangGraph orchestration.
 */

export class WorkflowExecutor {
  /**
   * Executes a specific workflow context.
   * @param orgId The organization tenant ID
   * @param input The user prompt or trigger
   */
  static async run(orgId: string, input: string) {
    console.log(`[Executor] Starting workflow for org: ${orgId}`);

    // 1. Execute the Graph
    const initialState = {
      messages: [new HumanMessage(input)],
    };

    const result = await orchestrationEngine.invoke(initialState);
    const lastMessage = result.messages[result.messages.length - 1];

    // 2. Self-Correction & Citation (The Glass Box logic)
    const grounded = await CitationEngine.verify(
      lastMessage.content?.toString() || '',
      [] 
    );

    // 3. Persist Audit Log for Governance Layer
    await db.insert(auditLogs).values({
      orgId,
      input,
      output: grounded.answer,
      metadata: {
        confidence: grounded.overallConfidence,
        citations: grounded.citations.map(c => ({
          source: c.title,
          content: c.snippet,
          score: c.confidence,
        })),
        policyChecks: [], 
        latencyMs: 1200, 
      },
    });

    return grounded;
  }

  /**
   * Streams the graph execution steps (for real-time UI updates).
   */
  static async *stream(orgId: string, input: string) {
    const initialState = {
      messages: [new HumanMessage(input)],
    };

    const stream = await orchestrationEngine.stream(initialState);
    
    for await (const step of stream) {
      yield step;
    }
  }
}
