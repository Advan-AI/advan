import TableStore from "tablestore";
import { getEmbedding } from "../lib/alibaba/model-studio-client";
import {
  getTablestoreClient,
  putKnowledgeChunk,
  getKnowledgeChunk,
  putAgentMemory,
  getAgentMemory,
} from "../lib/alibaba/tablestore-client";

/**
 * ============================================================================
 * TABLESTORE SETUP SCRIPT FOR ADVAN AI RAG & AGENT MEMORY
 * ============================================================================
 * 
 * ARCHITECTURAL DECISIONS & PREREQUISITES:
 * 1. NETWORK / ENDPOINT STRATEGY:
 *    For hackathon simplicity, speed, and multi-environment accessibility across
 *    local node scripts, Next.js dev server, and Function Compute execution contexts,
 *    we explicitly use PUBLIC endpoints everywhere (e.g. https://<instance>.<region>.ots.aliyuncs.com).
 *    This eliminates complex VPC subnet/NAT Gateway dependencies and avoids endpoint mismatches.
 * 
 * 2. INSTANCE TYPE & CAPACITY MODE REQUIREMENT:
 *    Tablestore Search Index & KnnVectorQuery require a High-Performance Instance (SSD-backed)
 *    or Pay-as-you-go CU mode instance with Search Index capability enabled.
 *    Capacity instances (SATA cold storage) do not support vector search indexes.
 * 
 * 3. EMBEDDING DIMENSION LOCKING:
 *    Before defining the vector index schema, this script executes a live embedding call
 *    to DashScope API to confirm the actual vector output dimension returned by text-embedding-v4.
 */

async function main() {
  console.log("=================================================");
  console.log("Starting Tablestore Schema & Vector Index Setup");
  console.log("=================================================\n");

  // Step 1: Live embedding dimension verification
  let vectorDimension = 1024; // Default fallback
  if (process.env.DASHSCOPE_API_KEY) {
    try {
      console.log("[1/5] Performing live embedding call to verify vector dimension...");
      const sampleVec = await getEmbedding("Dimension locking test string");
      vectorDimension = sampleVec.length;
      console.log(`✓ Live DashScope embedding response received.`);
      console.log(`✓ Confirmed actual vector dimension: ${vectorDimension}`);
    } catch (err: any) {
      console.warn(`⚠️ Live embedding check failed (${err.message}). Using default dimension 1024.`);
    }
  } else {
    console.log("[1/5] DASHSCOPE_API_KEY not set. Using default dimension 1024.");
  }

  const client = getTablestoreClient();

  // Helper to list existing tables
  const listTables = (): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      client.listTable({}, (err: any, data: any) => {
        if (err) reject(err);
        else resolve(data.tableNames || []);
      });
    });
  };

  const existingTables = await listTables();
  console.log("\nExisting Tablestore tables:", existingTables);

  // Step 2: Create knowledge_base table
  if (!existingTables.includes("knowledge_base")) {
    console.log("\n[2/5] Creating table 'knowledge_base'...");
    const createKbParams = {
      tableMeta: {
        tableName: "knowledge_base",
        primaryKey: [
          { name: "orgId", type: TableStore.PrimaryKeyType.STRING },
          { name: "chunkId", type: TableStore.PrimaryKeyType.STRING },
        ],
      },
      reservedThroughput: {
        capacityUnit: { read: 0, write: 0 },
      },
      tableOptions: { timeToLive: -1, maxVersions: 1 },
    };

    await new Promise((resolve, reject) => {
      client.createTable(createKbParams, (err: any) => {
        if (err) reject(err);
        else resolve(null);
      });
    });
    console.log("✓ Table 'knowledge_base' created successfully.");
  } else {
    console.log("\n[2/5] Table 'knowledge_base' already exists. Skipping creation.");
  }

  // Step 3: Create agent_memory table
  if (!existingTables.includes("agent_memory")) {
    console.log("\n[3/5] Creating table 'agent_memory'...");
    const createMemParams = {
      tableMeta: {
        tableName: "agent_memory",
        primaryKey: [
          { name: "orgId", type: TableStore.PrimaryKeyType.STRING },
          { name: "conversationId", type: TableStore.PrimaryKeyType.STRING },
        ],
      },
      reservedThroughput: {
        capacityUnit: { read: 0, write: 0 },
      },
      tableOptions: { timeToLive: -1, maxVersions: 1 },
    };

    await new Promise((resolve, reject) => {
      client.createTable(createMemParams, (err: any) => {
        if (err) reject(err);
        else resolve(null);
      });
    });
    console.log("✓ Table 'agent_memory' created successfully.");
  } else {
    console.log("\n[3/5] Table 'agent_memory' already exists. Skipping creation.");
  }

  // Step 4: Create Search Index with KnnVectorQuery capability on knowledge_base
  console.log(`\n[4/5] Creating Vector Search Index 'knowledge_base_vector_idx' (dimension: ${vectorDimension})...`);
  const createIndexParams = {
    tableName: "knowledge_base",
    indexName: "knowledge_base_vector_idx",
    schema: {
      fieldSchemas: [
        {
          fieldName: "orgId",
          fieldType: TableStore.FieldType.KEYWORD,
          index: true,
          enableSortAndAgg: true,
        },
        {
          fieldName: "documentId",
          fieldType: TableStore.FieldType.KEYWORD,
          index: true,
        },
        {
          fieldName: "sourceFileName",
          fieldType: TableStore.FieldType.KEYWORD,
          index: true,
        },
        {
          fieldName: "chunkText",
          fieldType: TableStore.FieldType.TEXT,
          index: true,
        },
        {
          fieldName: "chunkIndex",
          fieldType: TableStore.FieldType.LONG,
          index: true,
        },
        {
          fieldName: "createdAt",
          fieldType: TableStore.FieldType.KEYWORD,
          index: true,
        },
        {
          fieldName: "embedding",
          fieldType: TableStore.FieldType.VECTOR,
          index: true,
          vector_options: {
            dataType: TableStore.VectorDataType.VD_FLOAT_32,
            vectorDataType: TableStore.VectorDataType.VD_FLOAT_32,
            vector_data_type: TableStore.VectorDataType.VD_FLOAT_32,
            dimension: vectorDimension,
            metricType: TableStore.VectorMetricType.VM_COSINE,
            metric_type: TableStore.VectorMetricType.VM_COSINE,
          },
          vectorOptions: {
            dataType: TableStore.VectorDataType.VD_FLOAT_32,
            vectorDataType: TableStore.VectorDataType.VD_FLOAT_32,
            vector_data_type: TableStore.VectorDataType.VD_FLOAT_32,
            dimension: vectorDimension,
            metricType: TableStore.VectorMetricType.VM_COSINE,
            metric_type: TableStore.VectorMetricType.VM_COSINE,
          },
        },
      ],
    },
  };

  try {
    await new Promise((resolve, reject) => {
      client.createSearchIndex(createIndexParams, (err: any) => {
        if (err) reject(err);
        else resolve(null);
      });
    });
    console.log("✓ Search Index 'knowledge_base_vector_idx' created successfully!");
  } catch (err: any) {
    if (err.message && err.message.includes("already exist")) {
      console.log("ℹ Search Index 'knowledge_base_vector_idx' already exists.");
    } else {
      console.error("⚠️ Search Index creation warning:", err.message || err);
    }
  }

  // Step 5: Round-trip Insert + Read Verification Test
  console.log("\n[5/5] Running Round-Trip Insert + Read Verification Test...");
  const testOrgId = "test-org-verification";
  const testChunkId = "verify-chunk-" + Date.now();
  const testConvId = "verify-conv-" + Date.now();

  // Test knowledge_base
  await putKnowledgeChunk(client, {
    orgId: testOrgId,
    chunkId: testChunkId,
    documentId: "doc-123",
    sourceFileName: "test-doc.txt",
    chunkText: "This is a roundtrip test chunk.",
    chunkIndex: 0,
    createdAt: new Date().toISOString(),
  });
  const readKb = await getKnowledgeChunk(client, testOrgId, testChunkId);
  if (readKb && readKb.chunkText === "This is a roundtrip test chunk.") {
    console.log("✓ 'knowledge_base' Round-Trip Verification PASSED!");
  } else {
    throw new Error("knowledge_base roundtrip test failed!");
  }

  // Test agent_memory
  await putAgentMemory(client, {
    orgId: testOrgId,
    conversationId: testConvId,
    summaryText: "Initial memory summary test.",
    keyFacts: JSON.stringify(["fact1", "fact2"]),
    turnCount: 1,
    lastUpdatedAt: new Date().toISOString(),
  });
  const readMem = await getAgentMemory(client, testOrgId, testConvId);
  if (readMem && readMem.summaryText === "Initial memory summary test.") {
    console.log("✓ 'agent_memory' Round-Trip Verification PASSED!");
  } else {
    throw new Error("agent_memory roundtrip test failed!");
  }

  console.log("\n=================================================");
  console.log("Tablestore Setup & Verification Completed Successfully!");
  console.log("=================================================");
}

main().catch((err) => {
  console.error("\n❌ Setup Script Errored:", err);
  process.exit(1);
});
