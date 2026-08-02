import crypto from "crypto";
import { getEmbedding } from "./model-studio-client";
import {
  getTablestoreClient,
  putKnowledgeChunk,
  getKnowledgeChunk,
  KnowledgeChunkRow,
} from "./tablestore-client";
import { parseOSSKey } from "./oss-client";

/**
 * Clean PDF Text Extractor
 * Extracts readable text from PDF buffers by filtering string literal objects and stripping stream tags.
 */
export function extractCleanPDFText(pdfBuffer: Buffer): string {
  const rawStr = pdfBuffer.toString("latin1");
  const textMatches: string[] = [];
  const regex = /\(([^()]{2,})\)/g;
  let match;
  while ((match = regex.exec(rawStr)) !== null) {
    const str = match[1].replace(/[^\x20-\x7E\n]/g, " ").trim();
    if (
      str.length > 2 &&
      !/^\/[A-Za-z0-9]+$/.test(str) &&
      !/^(FlateDecode|Font|Page|Type|Catalog|Parent|MediaBox|Contents|Resources|Length)$/i.test(str)
    ) {
      textMatches.push(str);
    }
  }

  const extracted = textMatches.join(" ").replace(/\s+/g, " ").trim();
  if (extracted.length > 30) {
    return extracted;
  }

  // Fallback: strip binary non-ASCII characters and remove PDF markup tags
  return rawStr
    .replace(/<[^>]+>/g, " ")
    .replace(/endstream|stream|endobj|obj|xref|trailer|startxref/gi, " ")
    .replace(/[^\x20-\x7E\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Text Chunking Utility
 * Configured to ~600 tokens (~2400 chars) with 200 char overlap
 */
export function chunkText(
  text: string,
  chunkSize: number = 2400,
  overlap: number = 200
): string[] {
  const chunks: string[] = [];
  let start = 0;
  const cleanText = text.replace(/\r\n/g, "\n").trim();

  if (cleanText.length <= chunkSize) {
    return [cleanText];
  }

  while (start < cleanText.length) {
    let end = start + chunkSize;
    if (end >= cleanText.length) {
      chunks.push(cleanText.slice(start).trim());
      break;
    }

    // Attempt to break at paragraph or newline boundary if possible
    const lastNewline = cleanText.lastIndexOf("\n", end);
    if (lastNewline > start + chunkSize / 2) {
      end = lastNewline + 1;
    } else {
      const lastSpace = cleanText.lastIndexOf(" ", end);
      if (lastSpace > start + chunkSize / 2) {
        end = lastSpace + 1;
      }
    }

    const chunk = cleanText.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    start = end - overlap;
  }

  return chunks;
}

/**
 * Process document object from OSS into Tablestore knowledge_base table
 */
export interface ProcessDocInput {
  ossKey: string;
  eTag: string;
  fileBuffer: Buffer;
}

export interface ProcessDocResult {
  orgId: string;
  documentId: string;
  chunksCreated: number;
  skippedDuplicate: boolean;
}

export async function processDocumentObject(
  input: ProcessDocInput
): Promise<ProcessDocResult> {
  const parsed = parseOSSKey(input.ossKey);
  if (!parsed) {
    throw new Error(
      `Invalid OSS key format: '${input.ossKey}'. Expected key format '{orgId}/knowledge-docs/{filename}'`
    );
  }

  const { orgId, filename } = parsed;
  const documentId = crypto
    .createHash("sha256")
    .update(`${input.ossKey}:${input.eTag}`)
    .digest("hex")
    .substring(0, 16);

  const client = getTablestoreClient();

  // 1. Idempotency check: verify if marker chunk already exists for this documentId
  const markerChunkId = `marker-${documentId}`;
  const existingMarker = await getKnowledgeChunk(client, orgId, markerChunkId);
  if (existingMarker) {
    console.log(
      `[Idempotency] Document '${filename}' with ETag '${input.eTag}' has already been processed for org '${orgId}'. Skipping.`
    );
    return {
      orgId,
      documentId,
      chunksCreated: 0,
      skippedDuplicate: true,
    };
  }

  // 2. Extract text from buffer (.txt or clean PDF text extractor)
  let rawText = "";
  if (filename.toLowerCase().endsWith(".pdf")) {
    rawText = extractCleanPDFText(input.fileBuffer);
  } else {
    rawText = input.fileBuffer.toString("utf8");
  }

  if (!rawText || rawText.trim().length === 0) {
    console.warn(`[Ingestion] File '${filename}' contains no readable text.`);
    return { orgId, documentId, chunksCreated: 0, skippedDuplicate: false };
  }

  // 3. Chunk text
  const textChunks = chunkText(rawText);
  console.log(
    `[Ingestion] Document '${filename}' chunked into ${textChunks.length} chunks.`
  );

  // 4. Generate embeddings and save chunks into Tablestore
  let chunksCreated = 0;
  for (let i = 0; i < textChunks.length; i++) {
    const chunkContent = textChunks[i];
    const chunkId = `chunk-${documentId}-${i}`;

    let embedding: number[] | undefined;
    try {
      embedding = await getEmbedding(chunkContent);
    } catch (err: any) {
      console.warn(
        `⚠️ Failed to generate embedding for chunk ${i} of ${filename}: ${err.message}`
      );
    }

    const row: KnowledgeChunkRow = {
      orgId,
      chunkId,
      documentId,
      sourceFileName: filename,
      chunkText: chunkContent,
      chunkIndex: i,
      createdAt: new Date().toISOString(),
      embedding,
    };

    await putKnowledgeChunk(client, row);
    chunksCreated++;
  }

  // 5. Store idempotency marker chunk
  await putKnowledgeChunk(client, {
    orgId,
    chunkId: markerChunkId,
    documentId,
    sourceFileName: filename,
    chunkText: `PROCESSED_MARKER:${input.eTag}`,
    chunkIndex: -1,
    createdAt: new Date().toISOString(),
  });

  return {
    orgId,
    documentId,
    chunksCreated,
    skippedDuplicate: false,
  };
}
