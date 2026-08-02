import "dotenv/config";
import TableStore from "tablestore";

/**
 * Tablestore Configuration
 * 
 * NETWORK / ENDPOINT STRATEGY:
 * For hackathon simplicity and universal reachability across local client scripts,
 * Next.js dev server, and Function Compute instances, we explicitly use PUBLIC
 * endpoints consistently everywhere (e.g. https://<instance>.<region>.ots.aliyuncs.com).
 * This avoids VPC subnet/NAT gateway configuration overhead while ensuring reliable
 * connectivity from all execution contexts.
 */

function getTableStoreCredentials() {
  const instanceName = process.env.TABLESTORE_INSTANCE_NAME;
  const endpoint = process.env.TABLESTORE_ENDPOINT;
  const accessKeyId = process.env.TABLESTORE_ACCESS_KEY_ID;
  const accessKeySecret = process.env.TABLESTORE_ACCESS_KEY_SECRET;

  if (!instanceName || !endpoint || !accessKeyId || !accessKeySecret) {
    throw new Error(
      "Missing Tablestore configuration. Required env vars: TABLESTORE_INSTANCE_NAME, TABLESTORE_ENDPOINT, TABLESTORE_ACCESS_KEY_ID, TABLESTORE_ACCESS_KEY_SECRET."
    );
  }

  return { instanceName, endpoint, accessKeyId, accessKeySecret };
}

export function getTablestoreClient(): TableStore.Client {
  const { instanceName, endpoint, accessKeyId, accessKeySecret } =
    getTableStoreCredentials();

  return new TableStore.Client({
    accessKeyId,
    secretAccessKey: accessKeySecret,
    endpoint,
    instancename: instanceName,
  });
}

// ──────────────────────────────────────────────
// Helper Types
// ──────────────────────────────────────────────

export interface KnowledgeChunkRow {
  orgId: string;
  chunkId: string;
  documentId: string;
  sourceFileName: string;
  chunkText: string;
  chunkIndex: number;
  createdAt: string;
  embedding?: number[];
}

export interface AgentMemoryRow {
  orgId: string;
  conversationId: string;
  summaryText: string;
  keyFacts: string; // JSON string
  turnCount: number;
  lastUpdatedAt: string;
}

// ──────────────────────────────────────────────
// Table Operations
// ──────────────────────────────────────────────

export async function putKnowledgeChunk(
  client: TableStore.Client,
  row: KnowledgeChunkRow
): Promise<void> {
  const params = {
    tableName: "knowledge_base",
    condition: new TableStore.Condition(
      TableStore.RowExistenceExpectation.IGNORE,
      null
    ),
    primaryKey: [
      { orgId: row.orgId },
      { chunkId: row.chunkId },
    ],
    attributeColumns: [
      { documentId: row.documentId },
      { sourceFileName: row.sourceFileName },
      { chunkText: row.chunkText },
      { chunkIndex: TableStore.Long.fromNumber(row.chunkIndex) },
      { createdAt: row.createdAt },
      ...(row.embedding
        ? [{ embedding: JSON.stringify(row.embedding) }]
        : []),
    ],
  };

  return new Promise((resolve, reject) => {
    client.putRow(params, (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function getKnowledgeChunk(
  client: TableStore.Client,
  orgId: string,
  chunkId: string
): Promise<KnowledgeChunkRow | null> {
  const params = {
    tableName: "knowledge_base",
    primaryKey: [{ orgId }, { chunkId }],
  };

  return new Promise((resolve, reject) => {
    client.getRow(params, (err: any, data: any) => {
      if (err) return reject(err);
      if (!data.row || !data.row.attributes) return resolve(null);

      const attrs: Record<string, any> = {};
      for (const col of data.row.attributes) {
        attrs[col.columnName] = col.columnValue;
      }

      resolve({
        orgId,
        chunkId,
        documentId: attrs.documentId || "",
        sourceFileName: attrs.sourceFileName || "",
        chunkText: attrs.chunkText || "",
        chunkIndex: typeof attrs.chunkIndex === "object" ? attrs.chunkIndex.toNumber() : Number(attrs.chunkIndex || 0),
        createdAt: attrs.createdAt || "",
        embedding: attrs.embedding ? JSON.parse(attrs.embedding) : undefined,
      });
    });
  });
}

export async function putAgentMemory(
  client: TableStore.Client,
  row: AgentMemoryRow
): Promise<void> {
  const params = {
    tableName: "agent_memory",
    condition: new TableStore.Condition(
      TableStore.RowExistenceExpectation.IGNORE,
      null
    ),
    primaryKey: [
      { orgId: row.orgId },
      { conversationId: row.conversationId },
    ],
    attributeColumns: [
      { summaryText: row.summaryText },
      { keyFacts: row.keyFacts },
      { turnCount: TableStore.Long.fromNumber(row.turnCount) },
      { lastUpdatedAt: row.lastUpdatedAt },
    ],
  };

  return new Promise((resolve, reject) => {
    client.putRow(params, (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function getAgentMemory(
  client: TableStore.Client,
  orgId: string,
  conversationId: string
): Promise<AgentMemoryRow | null> {
  const params = {
    tableName: "agent_memory",
    primaryKey: [{ orgId }, { conversationId }],
  };

  return new Promise((resolve, reject) => {
    client.getRow(params, (err: any, data: any) => {
      if (err) return reject(err);
      if (!data.row || !data.row.attributes) return resolve(null);

      const attrs: Record<string, any> = {};
      for (const col of data.row.attributes) {
        attrs[col.columnName] = col.columnValue;
      }

      resolve({
        orgId,
        conversationId,
        summaryText: attrs.summaryText || "",
        keyFacts: attrs.keyFacts || "[]",
        turnCount: typeof attrs.turnCount === "object" ? attrs.turnCount.toNumber() : Number(attrs.turnCount || 0),
        lastUpdatedAt: attrs.lastUpdatedAt || "",
      });
    });
  });
}

/**
 * KnnVectorQuery implementation against knowledge_base_vector_idx
 * Guarantees strict orgId tenant isolation.
 */
export async function searchKnowledgeVector(
  client: TableStore.Client,
  orgId: string,
  queryEmbedding: number[],
  topK: number = 5
): Promise<Array<{ chunkText: string; sourceFileName: string; score: number }>> {
  const params = {
    tableName: "knowledge_base",
    indexName: "knowledge_base_vector_idx",
    searchQuery: {
      offset: 0,
      limit: topK,
      query: {
        queryType: TableStore.QueryType.KNN_VECTOR_QUERY,
        query: {
          fieldName: "embedding",
          topK: topK,
          vector: queryEmbedding,
          float32QueryVector: queryEmbedding,
          float32_query_vector: queryEmbedding,
          floatArray: queryEmbedding,
          // Strict tenant isolation filter: orgId MUST match
          filter: {
            queryType: TableStore.QueryType.TERM_QUERY,
            query: {
              fieldName: "orgId",
              term: orgId,
            },
          },
        },
      },
      getTotalCount: false,
    },
    columnToGet: {
      returnType: TableStore.ColumnReturnType.RETURN_SPECIFIED,
      returnNames: ["orgId", "chunkText", "sourceFileName", "documentId", "chunkIndex"],
    },
  };

  return new Promise((resolve, reject) => {
    client.search(params, (err: any, data: any) => {
      if (err) return reject(err);

      const results = (data.rows || []).map((row: any) => {
        const attrs: Record<string, any> = {};
        for (const col of row.attributes || []) {
          attrs[col.columnName] = col.columnValue;
        }
        return {
          chunkText: attrs.chunkText || "",
          sourceFileName: attrs.sourceFileName || "",
          score: row.score || 0,
        };
      });

      resolve(results);
    });
  });
}
