import { NextResponse } from "next/server";
import { processDocumentObject } from "@/lib/alibaba/ingestion";
import { getOSSClient, buildOSSKey } from "@/lib/alibaba/oss-client";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const orgId = (formData.get("orgId") as string) || "org-alpha-demo";
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided in form-data ('file' field required)" },
        { status: 400 }
      );
    }

    const filename = file.name;
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Generate ETag hash from content
    const eTag = crypto.createHash("md5").update(fileBuffer).digest("hex");

    // 1. Upload to Alibaba OSS
    const ossKey = buildOSSKey(orgId, filename);
    let uploadedToOSS = false;
    try {
      const ossClient = getOSSClient();
      await ossClient.put(ossKey, fileBuffer);
      uploadedToOSS = true;
      console.log(`✓ Uploaded file '${filename}' to Alibaba OSS bucket key '${ossKey}'`);
    } catch (ossErr: any) {
      console.warn(`⚠️ OSS Upload Warning (bypassing if unbilled): ${ossErr.message}`);
    }

    // 2. Chunk, Embed with Model Studio text-embedding-v4 (1024D), and index in Tablestore Vector Search
    const result = await processDocumentObject({
      ossKey,
      eTag,
      fileBuffer,
    });

    return NextResponse.json({
      success: true,
      orgId,
      filename,
      ossKey,
      uploadedToOSS,
      documentId: result.documentId,
      chunksCreated: result.chunksCreated,
      skippedDuplicate: result.skippedDuplicate,
      message: result.skippedDuplicate
        ? `Document '${filename}' already processed (Idempotent skip).`
        : `Successfully ingested '${filename}' into Alibaba Tablestore Vector Search!`,
    });
  } catch (err: any) {
    console.error("Alibaba Knowledge Base Ingestion Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process Knowledge Base upload" },
      { status: 500 }
    );
  }
}
