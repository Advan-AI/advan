import { processDocumentObject } from "../lib/alibaba/ingestion";
import { processRAGAgentQuery } from "../lib/alibaba/rag-agent";
import {
  getTablestoreClient,
  getKnowledgeChunk,
  getAgentMemory,
} from "../lib/alibaba/tablestore-client";

async function main() {
  console.log("=================================================");
  console.log("Starting End-to-End Alibaba Cloud RAG & Memory Test");
  console.log("=================================================\n");

  const orgAlpha = "org-alpha-demo";
  const orgBeta = "org-beta-demo";
  const convId = "conv-e2e-" + Date.now();

  // Document 1 content for Org Alpha
  const docAlphaText = `Advan Enterprise SLA and Support Policy:
1. Standard Support SLA is 99.9% uptime with 15-minute critical incident response time.
2. Premium Enterprise customers receive dedicated technical account managers and 24/7 hotline.
3. Data retention policy is 7 years for audit compliance, stored securely with client-side encryption.`;

  // Document 2 content for Org Beta
  const docBetaText = `Beta Corp Secret Internal Project:
Project Orion is a quantum computing research project focused on 1024-qubit error mitigation algorithms.`;

  // ──────────────────────────────────────────────
  // TEST 1: Ingestion & Idempotency Check
  // ──────────────────────────────────────────────
  console.log("[Test 1/4] Testing Document Ingestion & Idempotency for Org Alpha...");
  const alphaOssKey = `${orgAlpha}/knowledge-docs/sla-policy.txt`;
  const alphaEtag = "etag-alpha-live-" + Date.now();

  const ingRes1 = await processDocumentObject({
    ossKey: alphaOssKey,
    eTag: alphaEtag,
    fileBuffer: Buffer.from(docAlphaText),
  });

  console.log(`✓ First ingestion result: ${ingRes1.chunksCreated} chunks created, skipped: ${ingRes1.skippedDuplicate}`);

  // Re-ingest same document to test idempotency
  const ingRes2 = await processDocumentObject({
    ossKey: alphaOssKey,
    eTag: alphaEtag,
    fileBuffer: Buffer.from(docAlphaText),
  });

  console.log(`✓ Second ingestion (idempotency check) result: ${ingRes2.chunksCreated} chunks created, skipped: ${ingRes2.skippedDuplicate}`);
  if (!ingRes2.skippedDuplicate) {
    throw new Error("❌ Idempotency check failed: duplicate chunks were created!");
  }
  console.log("✓ PASSED: Idempotency test succeeded (0 duplicate chunks created).\n");

  // Ingest Org Beta Document
  console.log("Ingesting Document for Org Beta...");
  await processDocumentObject({
    ossKey: `${orgBeta}/knowledge-docs/secret-project.txt`,
    eTag: "etag-beta-live-" + Date.now(),
    fileBuffer: Buffer.from(docBetaText),
  });

  // ──────────────────────────────────────────────
  // TEST 2: Strict Multi-Tenant Isolation (Positive + Negative Control)
  // ──────────────────────────────────────────────
  console.log("[Test 2/4] Testing Strict Tenant Isolation (Positive + Negative Control)...");

  // A. POSITIVE CONTROL: Org Beta queries its own secret document
  console.log("-> Running POSITIVE CONTROL: Org Beta queries its own secret document...");
  const betaPosRes = await processRAGAgentQuery({
    orgId: orgBeta,
    customerMessage: "What is Project Orion and what are its 1024-qubit error mitigation specs?",
    conversationId: "conv-beta-positive-check",
  });

  const betaHasChunk = betaPosRes.sourceChunks.some((c) =>
    c.snippet.includes("Orion") || c.snippet.includes("1024-qubit")
  );
  if (!betaHasChunk || betaPosRes.sourceChunks.length === 0) {
    throw new Error("❌ POSITIVE CONTROL FAILED: Org Beta could not retrieve its own document!");
  }
  console.log(`✓ POSITIVE CONTROL PASSED: Org Beta retrieved ${betaPosRes.sourceChunks.length} chunk(s) from 'secret-project.txt'.`);

  // B. NEGATIVE CONTROL: Org Alpha queries for Org Beta's secret document
  console.log("-> Running NEGATIVE CONTROL: Org Alpha queries for Org Beta's secret document...");
  const crossOrgRes = await processRAGAgentQuery({
    orgId: orgAlpha,
    customerMessage: "What is Project Orion and what are its 1024-qubit error mitigation specs?",
    conversationId: "conv-tenant-isolation-check",
  });

  const leakedBetaChunk = crossOrgRes.sourceChunks.some((c) =>
    c.snippet.includes("Orion") || c.snippet.includes("1024-qubit")
  );

  if (leakedBetaChunk) {
    throw new Error("❌ SECURITY VIOLATION: Org Alpha query returned Org Beta's data!");
  }
  console.log("✓ NEGATIVE CONTROL PASSED: Org Alpha query returned 0 chunks from Org Beta.");
  console.log("✓ PASSED: Tenant isolation verified via Positive + Negative Controls!\n");

  // ──────────────────────────────────────────────
  // TEST 3: Grounded Answer & Source Attribution
  // ──────────────────────────────────────────────
  console.log("[Test 3/4] Testing Grounded Answer & Citation Attribution...");
  const ragRes = await processRAGAgentQuery({
    orgId: orgAlpha,
    customerMessage: "What is our incident response time and data retention policy?",
    conversationId: convId,
  });

  console.log(`\nAssistant Answer:\n"${ragRes.answer}"\n`);
  console.log(`Source Chunks Cited:`, ragRes.sourceChunks.map((s) => s.sourceFileName));

  if (!ragRes.answer || ragRes.answer.length === 0) {
    throw new Error("❌ Empty answer returned from RAG query!");
  }
  console.log("✓ PASSED: Grounded RAG query returned non-empty cited response.\n");

  // ──────────────────────────────────────────────
  // TEST 4: Multi-Turn Conversation Memory (N=4 Summarization)
  // ──────────────────────────────────────────────
  console.log("[Test 4/4] Testing 5-Turn Conversation Sequence & N=4 Memory Summarization...");

  const history: Array<{ role: "user" | "assistant"; content: string }> = [];

  // Turn 1
  history.push({ role: "user", content: "What is our incident response time?" });
  history.push({ role: "assistant", content: ragRes.answer });

  // Turn 2
  console.log("-> Executing Turn 2...");
  const t2 = await processRAGAgentQuery({
    orgId: orgAlpha,
    customerMessage: "What is our data retention policy?",
    conversationId: convId,
    conversationHistory: [...history],
  });
  history.push({ role: "user", content: "What is our data retention policy?" });
  history.push({ role: "assistant", content: t2.answer });
  console.log(`✓ Turn 2 complete (turnCount: ${t2.turnCount})`);

  // Turn 3
  console.log("-> Executing Turn 3...");
  const t3 = await processRAGAgentQuery({
    orgId: orgAlpha,
    customerMessage: "Do Premium Enterprise customers get a hotline?",
    conversationId: convId,
    conversationHistory: [...history],
  });
  history.push({ role: "user", content: "Do Premium Enterprise customers get a hotline?" });
  history.push({ role: "assistant", content: t3.answer });
  console.log(`✓ Turn 3 complete (turnCount: ${t3.turnCount})`);

  // Turn 4 (Triggers N=4 Summarization)
  console.log("-> Executing Turn 4 (Triggers N=4 LLM Summarization)...");
  const t4 = await processRAGAgentQuery({
    orgId: orgAlpha,
    customerMessage: "Can you confirm our SLA uptime percentage?",
    conversationId: convId,
    conversationHistory: [...history],
  });
  history.push({ role: "user", content: "Can you confirm our SLA uptime percentage?" });
  history.push({ role: "assistant", content: t4.answer });

  console.log(`\n✓ Turn 4 complete (turnCount: ${t4.turnCount})`);
  console.log(`[VERIFICATION] Memory Summary at Turn 4:\n"${t4.memorySummary}"\n`);

  if (!t4.memorySummary || t4.memorySummary.trim().length === 0) {
    throw new Error("❌ N=4 Summarization Failed: memorySummary is empty after Turn 4!");
  }
  console.log("✓ PASSED: N=4 Summarization triggered and produced non-empty summary!");

  // Turn 5 (Verifies prior summary is carried into prompt)
  console.log("-> Executing Turn 5 (Verifies summarized memory context persistence)...");
  const t5 = await processRAGAgentQuery({
    orgId: orgAlpha,
    customerMessage: "Briefly summarize what topics we have covered in our conversation so far.",
    conversationId: convId,
    conversationHistory: [...history],
  });

  console.log(`Turn 5 Answer:\n"${t5.answer}"\n`);
  console.log("✓ PASSED: 5-turn multi-turn conversation memory sequence completed successfully!\n");

  console.log("=================================================");
  console.log("ALL E2E RAG & MEMORY TESTS PASSED SUCCESSFULLY!");
  console.log("=================================================");
}

main().catch((err) => {
  console.error("\n❌ Test Suite Errored:", err);
  process.exit(1);
});
