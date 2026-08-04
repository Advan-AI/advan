import OSS from "ali-oss";

/**
 * OSS Client configuration
 */
export function getOSSClient(): OSS {
  const region = process.env.ALIBABA_OSS_REGION || process.env.AWS_REGION || "oss-ap-southeast-1";
  const accessKeyId = process.env.TABLESTORE_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "";
  const accessKeySecret = process.env.TABLESTORE_ACCESS_KEY_SECRET || process.env.AWS_SECRET_ACCESS_KEY || "";
  const bucket = process.env.ALIBABA_OSS_BUCKET || "advan-kb-documents";

  if (!accessKeyId || !accessKeySecret) {
    throw new Error("Missing Alibaba Cloud credentials for OSS Client.");
  }

  return new OSS({
    region,
    accessKeyId,
    accessKeySecret,
    bucket,
    secure: true,
  });
}

/**
 * Helper to build org-scoped OSS key: {orgId}/knowledge-docs/{filename}
 */
export function buildOSSKey(orgId: string, filename: string): string {
  const cleanFilename = filename.replace(/^\/+/, "");
  return `${orgId}/knowledge-docs/${cleanFilename}`;
}

/**
 * Helper to parse orgId and filename from OSS key: {orgId}/knowledge-docs/{filename}
 */
export function parseOSSKey(key: string): { orgId: string; filename: string } | null {
  const parts = key.split("/");
  if (parts.length >= 3 && parts[1] === "knowledge-docs") {
    return {
      orgId: parts[0],
      filename: parts.slice(2).join("/"),
    };
  }
  return null;
}
