/**
 * Alibaba Cloud Function Compute (FC 3.0) Entry Handlers
 */

const { processDocumentObject } = require("./lib/alibaba/ingestion");
const { processRAGAgentQuery } = require("./lib/alibaba/rag-agent");
const { getOSSClient } = require("./lib/alibaba/oss-client");

/**
 * 1. Event-Triggered Document Ingestion Handler (oss:ObjectCreated:*)
 */
exports.ossEventHandler = async (event, context) => {
  console.log("Received OSS Event:", JSON.stringify(event));

  try {
    const eventObj = typeof event === "string" ? JSON.parse(event) : event;
    const ossRecord = eventObj.events?.[0]?.oss || eventObj.records?.[0]?.oss;

    if (!ossRecord) {
      console.warn("No valid OSS record found in trigger event payload.");
      return { status: "ignored", reason: "no oss record" };
    }

    const ossKey = decodeURIComponent(ossRecord.object.key);
    const eTag = ossRecord.object.eTag || ossRecord.object.etag || "no-etag";

    console.log(`Processing OSS object: '${ossKey}', ETag: '${eTag}'`);

    const ossClient = getOSSClient();
    const result = await ossClient.get(ossKey);

    const processRes = await processDocumentObject({
      ossKey,
      eTag,
      fileBuffer: result.content,
    });

    console.log("Document processing result:", processRes);
    return { status: "success", result: processRes };
  } catch (error) {
    console.error("OSS Event Ingestion Handler Error:", error);
    throw error;
  }
};

/**
 * 2. Daily Cron Reconciliation Handler
 */
exports.reconciliationHandler = async (event, context) => {
  console.log("Starting Daily Document Reconciliation Scan...");

  try {
    const ossClient = getOSSClient();
    const listRes = await ossClient.list({ "max-keys": 1000 });

    let processedCount = 0;
    let skippedCount = 0;

    for (const obj of listRes.objects || []) {
      if (obj.name.includes("/knowledge-docs/")) {
        const getRes = await ossClient.get(obj.name);
        const res = await processDocumentObject({
          ossKey: obj.name,
          eTag: obj.etag || obj.eTag || "cron-etag",
          fileBuffer: getRes.content,
        });

        if (res.skippedDuplicate) {
          skippedCount++;
        } else {
          processedCount++;
        }
      }
    }

    console.log(`Reconciliation Complete: ${processedCount} re-processed, ${skippedCount} skipped.`);
    return { status: "success", processedCount, skippedCount };
  } catch (error) {
    console.error("Reconciliation Handler Error:", error);
    throw error;
  }
};

/**
 * 3. Customer-Facing RAG Agent HTTP Handler
 */
exports.httpAgentHandler = async (req, resp, context) => {
  // CORS Headers
  resp.setHeader("Access-Control-Allow-Origin", "*");
  resp.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  resp.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    resp.setStatusCode(204);
    resp.send("");
    return;
  }

  try {
    let body = req.body;
    if (Buffer.isBuffer(body)) {
      body = JSON.parse(body.toString("utf8"));
    } else if (typeof body === "string") {
      body = JSON.parse(body);
    }

    const { orgId, customerMessage, conversationId, conversationHistory } = body;

    if (!orgId || !customerMessage || !conversationId) {
      resp.setStatusCode(400);
      resp.send(
        JSON.stringify({
          error: "Missing required parameters: orgId, customerMessage, conversationId",
        })
      );
      return;
    }

    const agentRes = await processRAGAgentQuery({
      orgId,
      customerMessage,
      conversationId,
      conversationHistory,
    });

    resp.setStatusCode(200);
    resp.setHeader("Content-Type", "application/json");
    resp.send(JSON.stringify(agentRes));
  } catch (error) {
    console.error("HTTP Agent Handler Error:", error);
    resp.setStatusCode(500);
    resp.send(JSON.stringify({ error: error.message || "Internal server error" }));
  }
};
