import {
  getChatCompletion,
  getEmbedding,
  CHAT_MODEL,
  EMBEDDING_MODEL,
} from "../lib/alibaba/model-studio-client";

async function main() {
  console.log("=== Model Studio Client Smoke Test ===");
  console.log(`Chat Model: ${CHAT_MODEL}`);
  console.log(`Embedding Model: ${EMBEDDING_MODEL}`);

  try {
    // 1. Test getChatCompletion
    console.log("\n[1/2] Testing getChatCompletion()...");
    const chatRes = await getChatCompletion([
      { role: "user", content: "Reply with the single word 'READY'." },
    ]);
    console.log(`✓ Chat Completion successful!`);
    console.log(`✓ Response text: "${chatRes.text.trim()}"`);
    console.log(`✓ Token usage:`, chatRes.usage);

    if (!chatRes.text || chatRes.text.length === 0) {
      throw new Error("Chat response text is empty!");
    }

    // 2. Test getEmbedding
    console.log("\n[2/2] Testing getEmbedding()...");
    const testText = "Hello Advan AI RAG test";
    const embedding = await getEmbedding(testText);
    console.log(`✓ Embedding successfully generated!`);
    console.log(`✓ Actual returned vector dimension: ${embedding.length}`);
    console.log(`✓ First 5 vector components: [${embedding.slice(0, 5).join(", ")}...]`);

    console.log("\n=== Smoke Test Passed End-to-End! ===");
    console.log(`VERIFIED_EMBEDDING_DIMENSION=${embedding.length}`);
  } catch (error: any) {
    console.error("\n❌ Smoke Test Failed:", error.message || error);
    process.exit(1);
  }
}

main();
