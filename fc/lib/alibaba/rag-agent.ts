import { getEmbedding, getChatCompletion } from "./model-studio-client";
import {
  getTablestoreClient,
  searchKnowledgeVector,
  getAgentMemory,
  putAgentMemory,
  AgentMemoryRow,
} from "./tablestore-client";

export interface AgentRequest {
  orgId: string;
  customerMessage: string;
  conversationId: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface AgentResponse {
  answer: string;
  sourceChunks: Array<{ sourceFileName: string; snippet: string; score: number }>;
  conversationId: string;
  turnCount: number;
  memorySummary?: string;
}

const SUMMARIZE_TURN_THRESHOLD = 4;

const SYSTEM_PROMPT = `You are Advan AI Enterprise Support Copilot hosted on Alibaba Cloud Function Compute.
Your task is to answer customer questions accurately based ONLY on the provided knowledge base context and conversation memory.

RULES FOR GROUNDED CITATIONS:
1. Cite your sources clearly using [Source: filename] format.
2. Rely strictly on the retrieved knowledge chunks provided. Do NOT hallucinate information not present in the context.
3. If the retrieved context does not contain enough information to answer the user's question, politely state that you do not have sufficient documentation to answer and suggest contacting human support.
`;

export async function processRAGAgentQuery(
  req: AgentRequest
): Promise<AgentResponse> {
  const { orgId, customerMessage, conversationId, conversationHistory = [] } = req;
  const client = getTablestoreClient();

  // 1. Generate embedding for customer message
  let queryEmbedding: number[] = [];
  try {
    queryEmbedding = await getEmbedding(customerMessage);
  } catch (err: any) {
    console.warn(`⚠️ Failed to generate embedding for query: ${err.message}`);
  }

  // 2. Perform KnnVectorQuery in Tablestore strictly filtered by orgId
  let sourceChunks: Array<{ sourceFileName: string; snippet: string; score: number }> = [];
  if (queryEmbedding.length > 0) {
    try {
      const searchResults = await searchKnowledgeVector(
        client,
        orgId,
        queryEmbedding,
        4
      );
      sourceChunks = searchResults.map((res) => ({
        sourceFileName: res.sourceFileName,
        snippet: res.chunkText,
        score: res.score,
      }));
    } catch (err: any) {
      console.warn(`⚠️ Tablestore vector search error: ${err.message}`);
    }
  }

  // 3. Fetch prior conversation row from agent_memory
  let existingMemory: AgentMemoryRow | null = null;
  try {
    existingMemory = await getAgentMemory(client, orgId, conversationId);
  } catch (err: any) {
    console.warn(`⚠️ Failed to fetch agent memory: ${err.message}`);
  }

  // 4. Construct grounded prompt
  const contextFormatted =
    sourceChunks.length > 0
      ? sourceChunks
          .map(
            (c, idx) =>
              `[Chunk ${idx + 1} | Source: ${c.sourceFileName}]\n${c.snippet}`
          )
          .join("\n\n")
      : "No relevant knowledge base chunks found for this organization.";

  const memorySummaryFormatted = existingMemory?.summaryText
    ? `PREVIOUS CONVERSATION SUMMARY:\n${existingMemory.summaryText}`
    : "No prior memory summary.";

  const fullSystemMessage = `${SYSTEM_PROMPT}

=== RETRIEVED KNOWLEDGE BASE CONTEXT (Org: ${orgId}) ===
${contextFormatted}

=== AGENT MEMORY SUMMARY ===
${memorySummaryFormatted}`;

  // Assemble messages array
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: fullSystemMessage },
  ];

  // Append recent history
  for (const turn of conversationHistory) {
    messages.push({ role: turn.role, content: turn.content });
  }

  // Append latest user message
  messages.push({ role: "user", content: customerMessage });

  // 5. Call Chat Completion
  const chatRes = await getChatCompletion(messages);
  const answer = chatRes.text;

  // 6. Update agent memory
  const currentTurnCount = (existingMemory?.turnCount || 0) + 1;
  let updatedSummary = existingMemory?.summaryText || "";

  // Trigger summarization every SUMMARIZE_TURN_THRESHOLD turns
  if (currentTurnCount % SUMMARIZE_TURN_THRESHOLD === 0) {
    try {
      const summaryPrompt = `Summarize the key facts and user context from this conversation exchange in 2-3 concise sentences:
Existing Summary: ${updatedSummary}
Latest User Question: ${customerMessage}
Latest Assistant Answer: ${answer}`;

      const summaryRes = await getChatCompletion([
        { role: "user", content: summaryPrompt },
      ]);
      updatedSummary = summaryRes.text.trim();
      console.log(`[Memory] Updated conversation summary at turn ${currentTurnCount}: "${updatedSummary}"`);
    } catch (err: any) {
      console.warn(`⚠️ Summarization error: ${err.message}`);
    }
  }

  const updatedMemoryRow: AgentMemoryRow = {
    orgId,
    conversationId,
    summaryText: updatedSummary,
    keyFacts: existingMemory?.keyFacts || JSON.stringify([]),
    turnCount: currentTurnCount,
    lastUpdatedAt: new Date().toISOString(),
  };

  try {
    await putAgentMemory(client, updatedMemoryRow);
  } catch (err: any) {
    console.warn(`⚠️ Failed to update agent memory in Tablestore: ${err.message}`);
  }

  return {
    answer,
    sourceChunks,
    conversationId,
    turnCount: currentTurnCount,
    memorySummary: updatedSummary,
  };
}
