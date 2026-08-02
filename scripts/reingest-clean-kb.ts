import TableStore from "tablestore";
import { getTablestoreClient } from "../lib/alibaba/tablestore-client";
import { processDocumentObject } from "../lib/alibaba/ingestion";

async function main() {
  console.log("=== Re-ingesting Clean Knowledge Base with Real 256-Dim Embeddings ===");
  const client = getTablestoreClient();

  // 1. Delete search index first
  console.log("Deleting search index 'knowledge_base_vector_idx'...");
  await new Promise((resolve) => {
    client.deleteSearchIndex(
      { tableName: "knowledge_base", indexName: "knowledge_base_vector_idx" },
      (err: any) => {
        if (err) console.log("Note:", err.message || err);
        else console.log("✓ Deleted old search index.");
        resolve(null);
      }
    );
  });

  // 2. Delete knowledge_base table
  console.log("Deleting old knowledge_base table...");
  await new Promise((resolve) => {
    client.deleteTable({ tableName: "knowledge_base" }, (err: any) => {
      if (err) console.log("Note:", err.message || err);
      else console.log("✓ Deleted knowledge_base table.");
      resolve(null);
    });
  });

  // 3. Re-create knowledge_base table
  console.log("Re-creating knowledge_base table...");
  await new Promise((resolve, reject) => {
    client.createTable(
      {
        tableMeta: {
          tableName: "knowledge_base",
          primaryKey: [
            { name: "orgId", type: TableStore.PrimaryKeyType.STRING },
            { name: "chunkId", type: TableStore.PrimaryKeyType.STRING },
          ],
        },
        reservedThroughput: { capacityUnit: { read: 0, write: 0 } },
        tableOptions: { timeToLive: -1, maxVersions: 1 },
      },
      (err: any) => {
        if (err) reject(err);
        else resolve(null);
      }
    );
  });
  console.log("✓ Re-created knowledge_base table.");

  // 4. Re-create vector search index with 256 dimensions
  console.log("Creating fresh Vector Search Index 'knowledge_base_vector_idx' (dimension: 256)...");
  await new Promise((resolve, reject) => {
    client.createSearchIndex(
      {
        tableName: "knowledge_base",
        indexName: "knowledge_base_vector_idx",
        schema: {
          fieldSchemas: [
            { fieldName: "orgId", fieldType: TableStore.FieldType.KEYWORD, index: true, enableSortAndAgg: true },
            { fieldName: "documentId", fieldType: TableStore.FieldType.KEYWORD, index: true },
            { fieldName: "sourceFileName", fieldType: TableStore.FieldType.KEYWORD, index: true },
            { fieldName: "chunkText", fieldType: TableStore.FieldType.TEXT, index: true },
            { fieldName: "chunkIndex", fieldType: TableStore.FieldType.LONG, index: true },
            { fieldName: "createdAt", fieldType: TableStore.FieldType.KEYWORD, index: true },
            {
              fieldName: "embedding",
              fieldType: TableStore.FieldType.VECTOR,
              index: true,
              vector_options: {
                dataType: TableStore.VectorDataType.VD_FLOAT_32,
                dimension: 1024,
                metricType: TableStore.VectorMetricType.VM_COSINE,
              },
              vectorOptions: {
                dataType: TableStore.VectorDataType.VD_FLOAT_32,
                dimension: 1024,
                metricType: TableStore.VectorMetricType.VM_COSINE,
              },
            },
          ],
        },
      },
      (err: any) => {
        if (err) reject(err);
        else resolve(null);
      }
    );
  });
  console.log("✓ Vector Search Index 'knowledge_base_vector_idx' created.");

  // Wait 3 seconds for search index initialization
  console.log("Waiting 3s for search index initialization...");
  await new Promise((r) => setTimeout(r, 3000));

  // 5. Ingest fresh document for Org Alpha
  const orgAlpha = "org-alpha-demo";
  const docAlphaText = `Advan Enterprise SLA and Support Policy:
1. Standard Support SLA is 99.9% uptime with 15-minute critical incident response time.
2. Premium Enterprise customers receive dedicated technical account managers and 24/7 hotline.
3. Data retention policy is 7 years for audit compliance, stored securely with client-side encryption.`;

  console.log(`Ingesting fresh document with real 256-dim Model Studio vectors for '${orgAlpha}'...`);
  const resAlpha = await processDocumentObject({
    ossKey: `${orgAlpha}/knowledge-docs/sla-policy.txt`,
    eTag: "etag-alpha-v3",
    fileBuffer: Buffer.from(docAlphaText),
  });
  console.log(`✓ Org Alpha Ingestion: ${resAlpha.chunksCreated} chunk created with live embedding!`);

  // 6. Ingest fresh document for Org Beta
  const orgBeta = "org-beta-demo";
  const docBetaText = `Beta Corp Secret Internal Project:
Project Orion is a quantum computing research project focused on 1024-qubit error mitigation algorithms.`;

  console.log(`Ingesting fresh document with real 256-dim Model Studio vectors for '${orgBeta}'...`);
  const resBeta = await processDocumentObject({
    ossKey: `${orgBeta}/knowledge-docs/secret-project.txt`,
    eTag: "etag-beta-v3",
    fileBuffer: Buffer.from(docBetaText),
  });
  console.log(`✓ Org Beta Ingestion: ${resBeta.chunksCreated} chunk created with live embedding!`);

  console.log("\n=== Clean Re-Ingestion Complete! ===");
}

main().catch((err) => {
  console.error("❌ Re-ingestion Error:", err);
  process.exit(1);
});
