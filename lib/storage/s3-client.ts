import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

/**
 * AWS S3 client for:
 * - Knowledge Base document uploads (PDFs, DOCX, MD)
 * - Audit log exports (JSON — presigned download URL)
 *
 * Bucket structure:
 *   advan-kb-documents/{orgId}/kb/{docId}       ← KB files
 *   advan-kb-documents/{orgId}/audit/{logId}.json ← Audit exports
 */
const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.AWS_S3_BUCKET ?? "advan-kb-documents"

/**
 * Upload a Knowledge Base document to S3.
 * @returns The S3 key for the uploaded file.
 */
export async function uploadKBDocument(
  orgId: string,
  docId: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const key = `${orgId}/kb/${docId}`
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ServerSideEncryption: "AES256",
    })
  )
  return key
}

/**
 * Generate a presigned URL for downloading a KB document (1-hour expiry).
 */
export async function getKBDocumentUrl(s3Key: string): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }),
    { expiresIn: 3600 }
  )
}

/**
 * Upload an audit log export as JSON and return a presigned download URL.
 */
export async function exportAuditLog(
  orgId: string,
  logId: string,
  data: object
): Promise<string> {
  const key = `${orgId}/audit/${logId}.json`
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: "application/json",
      ServerSideEncryption: "AES256",
    })
  )
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: 3600 }
  )
}

/**
 * Delete a KB document from S3 when it's removed from the knowledge base.
 */
export async function deleteKBDocument(s3Key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: s3Key }))
}
