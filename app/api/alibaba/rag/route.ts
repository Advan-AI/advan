import { NextResponse } from "next/server";
import { processRAGAgentQuery } from "@/lib/alibaba/rag-agent";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orgId, customerMessage, conversationId, conversationHistory } = body;

    if (!orgId || !customerMessage || !conversationId) {
      return NextResponse.json(
        { error: "Missing required fields: orgId, customerMessage, conversationId" },
        { status: 400 }
      );
    }

    // 1. Invoke live Alibaba Function Compute URL if configured in .env
    const fcUrl = process.env.ALIBABA_FC_URL || process.env.NEXT_PUBLIC_ALIBABA_FC_URL;
    if (fcUrl && fcUrl.startsWith("http")) {
      try {
        console.log(`📡 Forwarding query to live Alibaba Function Compute 3.0 URL: '${fcUrl}'...`);
        const fcRes = await fetch(fcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgId, customerMessage, conversationId, conversationHistory }),
        });

        if (fcRes.ok) {
          const fcData = await fcRes.json();
          return NextResponse.json({
            ...fcData,
            invokedViaFC: true,
            fcUrl,
          });
        }
        console.warn(`⚠️ FC Endpoint returned status ${fcRes.status}, using inline RAG handler.`);
      } catch (fcErr: any) {
        console.warn(`⚠️ FC Invocation Warning (${fcErr.message}), using inline RAG handler.`);
      }
    }

    // 2. Direct inline RAG execution fallback
    const response = await processRAGAgentQuery({
      orgId,
      customerMessage,
      conversationId,
      conversationHistory,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Alibaba RAG API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
