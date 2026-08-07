import OSS from "ali-oss";
import { requireOneOfEnv } from "../../../lib/env/required";

/**
 * OSS Client configuration
 */
export function getOSSClient(): OSS {
  const region = requireOneOfEnv(["ALIBABA_OSS_REGION", "AWS_REGION"]);
  const accessKeyId = requireOneOfEnv(["TABLESTORE_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID"]);
  const accessKeySecret = requireOneOfEnv(["TABLESTORE_ACCESS_KEY_SECRET", "AWS_SECRET_ACCESS_KEY"]);
  const bucket = requireOneOfEnv(["ALIBABA_OSS_BUCKET", "AWS_S3_BUCKET"]);

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
