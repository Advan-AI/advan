import fs from "fs";
import path from "path";
import crypto from "crypto";
import { processDocumentObject } from "../lib/alibaba/ingestion";

/**
 * Local Document Ingestion Script
 * Processes documents directly into Tablestore Knowledge Base & Vector Index
 * without requiring active Alibaba Cloud OSS billing subscriptions.
 */

async function main() {
  const args = process.argv.slice(2);
  const filePath = args[0] || "scratch/sample-doc.txt";
  const orgId = args[1] || "org-alpha-demo";

  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    console.log(`Creating sample document at '${filePath}'...`);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    const sampleContent = `Advan AI Customer Support Policy & FAQ:
1. Standard Support Uptime SLA is 99.9% with 15-minute critical incident response time.
2. Enterprise customers receive dedicated technical account managers and 24/7 phone support.
3. Data retention policy is 7 years for compliance, encrypted at rest using AES-256.
4. Returns and refund requests are processed within 5-7 business days upon receipt.`;
    fs.writeFileSync(absolutePath, sampleContent, "utf8");
  }

  console.log(`=================================================`);
  console.log(`Ingesting Local Document into Tablestore`);
  console.log(`Document Path: ${absolutePath}`);
  console.log(`Organization ID: ${orgId}`);
  console.log(`=================================================\n`);

  const fileBuffer = fs.readFileSync(absolutePath);
  const filename = path.basename(absolutePath);
  const ossKey = `${orgId}/knowledge-docs/${filename}`;
  const eTag = crypto.createHash("md5").update(fileBuffer).digest("hex");

  const result = await processDocumentObject({
    ossKey,
    eTag,
    fileBuffer,
  });

  console.log("\n✓ Ingestion Completed!");
  console.log(`- Document ID: ${result.documentId}`);
  console.log(`- Chunks Created: ${result.chunksCreated}`);
  console.log(`- Skipped Duplicate: ${result.skippedDuplicate}`);
}

main().catch((err) => {
  console.error("❌ Local Ingestion Errored:", err);
  process.exit(1);
});
