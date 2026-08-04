import { getTablestoreClient } from "../lib/alibaba/tablestore-client";
import TableStore from "tablestore";

async function verifyAlibabaVectorDB() {
  console.log("=================================================");
  console.log("🔍 ALIBABA TABLESTORE VECTOR DB VERIFICATION TOOL");
  console.log("=================================================");

  const client = getTablestoreClient();
  const orgId = "org-alpha-demo";

  try {
    // Execute search query on search index 'knowledge_base_vector_idx'
    const searchParams = {
      tableName: "knowledge_base",
      indexName: "knowledge_base_vector_idx",
      searchQuery: {
        offset: 0,
        limit: 20,
        query: {
          queryType: TableStore.QueryType.TERM_QUERY,
          query: {
            fieldName: "orgId",
            term: orgId,
          },
        },
        getTotalCount: true,
      },
      columnToGet: {
        returnType: TableStore.ColumnReturnType.RETURN_SPECIFIED,
        returnNames: ["orgId", "chunkId", "documentId", "sourceFileName", "chunkText", "createdAt"],
      },
    };

    console.log(`📡 Querying Tablestore Index 'knowledge_base_vector_idx' for org '${orgId}'...`);
    
    client.search(searchParams, (err: any, data: any) => {
      if (err) {
        console.error("❌ Error querying Tablestore search index:", err.message);
        process.exit(1);
      }

      console.log(`\n✅ FOUND ${data.totalCount || data.rows.length} RECORD(S) IN ALIBABA VECTOR DB:\n`);

      const rows = data.rows || [];
      const documentsMap = new Map<string, number>();

      rows.forEach((row: any, idx: number) => {
        const rowObj: Record<string, any> = {};
        row.attributes.forEach((col: any) => {
          rowObj[col.columnName] = col.columnValue;
        });

        const sourceFile = rowObj.sourceFileName || "Unknown";
        const chunkId = rowObj.chunkId || "N/A";
        const chunkTextSnippet = (rowObj.chunkText || "").substring(0, 80).replace(/\n/g, " ");

        documentsMap.set(sourceFile, (documentsMap.get(sourceFile) || 0) + 1);

        console.log(` [Chunk #${idx + 1}] File: '${sourceFile}'`);
        console.log(`   └─ Chunk ID: ${chunkId}`);
        console.log(`   └─ Snippet : "${chunkTextSnippet}..."`);
        console.log("");
      });

      console.log("-------------------------------------------------");
      console.log("📊 SUMMARY OF INDEXED FILES IN ALIBABA VECTOR DB:");
      documentsMap.forEach((count, fileName) => {
        console.log(` • File: '${fileName}' -> ${count} vector chunk(s) stored`);
      });
      console.log("-------------------------------------------------\n");
    });
  } catch (err: any) {
    console.error("❌ Failed to connect to Alibaba Tablestore:", err.message);
  }
}

verifyAlibabaVectorDB();
