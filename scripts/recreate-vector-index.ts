import TableStore from "tablestore";
import { getTablestoreClient } from "../lib/alibaba/tablestore-client";
import { getEmbedding } from "../lib/alibaba/model-studio-client";

async function main() {
  console.log("=== Recreating Tablestore Vector Search Index (256 Dimensions) ===");
  const client = getTablestoreClient();

  // 1. Verify live embedding dimension
  const sampleVec = await getEmbedding("Dimension check");
  const dimension = sampleVec.length;
  console.log(`✓ Verified live embedding dimension: ${dimension}`);

  // 2. Delete existing index if present
  console.log("Deleting old search index 'knowledge_base_vector_idx'...");
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

  // 3. Create fresh search index with dimension 256
  console.log(`Creating fresh Search Index 'knowledge_base_vector_idx' (dimension: ${dimension})...`);
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
            dimension: dimension,
            metricType: TableStore.VectorMetricType.VM_COSINE,
            metric_type: TableStore.VectorMetricType.VM_COSINE,
          },
          vectorOptions: {
            dataType: TableStore.VectorDataType.VD_FLOAT_32,
            vectorDataType: TableStore.VectorDataType.VD_FLOAT_32,
            vector_data_type: TableStore.VectorDataType.VD_FLOAT_32,
            dimension: dimension,
            metricType: TableStore.VectorMetricType.VM_COSINE,
            metric_type: TableStore.VectorMetricType.VM_COSINE,
          },
        },
      ],
    },
  };

  await new Promise((resolve, reject) => {
    client.createSearchIndex(createIndexParams, (err: any) => {
      if (err) reject(err);
      else resolve(null);
    });
  });

  console.log(`\n✓ Search Index 'knowledge_base_vector_idx' successfully created with ${dimension} dimensions!`);
}

main().catch((err) => {
  console.error("❌ Recreate Index Error:", err);
  process.exit(1);
});
