import { NextRequest } from "next/server"
import { getEffectiveSession } from "@/lib/auth/effective-session"
import { WorkflowExecutor } from "@/lib/orchestration/executor"
import { PIIMasker } from "@/lib/governance/pii-masker"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * SSE Streaming endpoint for the AI Copilot.
 *
 * GET /api/sse?input=<user+message>&ticketId=<uuid>
 *
 * Streams Server-Sent Events back to the browser:
 *   event: token       — a partial text chunk
 *   event: citation    — a knowledge source citation JSON
 *   event: done        — final payload with confidence + policy results
 *   event: error       — error message
 *
 * The browser connects with EventSource; see app/dashboard/copilot for usage.
 */
export async function GET(req: NextRequest) {
  const session = await getEffectiveSession()
  if (!session?.user?.orgId) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const rawInput = searchParams.get("input")
  const ticketId = searchParams.get("ticketId") ?? undefined

  if (!rawInput) {
    return new Response("Missing input parameter", { status: 400 })
  }

  const input = PIIMasker.mask(decodeURIComponent(rawInput))
  const orgId = session.user.orgId

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(payload))
      }

      try {
        // Stream LangGraph execution steps
        send("token", { text: "" }) // open signal so EventSource fires immediately

        let fullText = ""

        for await (const chunk of WorkflowExecutor.stream(orgId, input)) {
          // LangGraph yields { nodeName: { messages: [...] } }
          for (const [, nodeOutput] of Object.entries(chunk)) {
            const output = nodeOutput as any
            if (output?.messages) {
              for (const msg of output.messages) {
                const text = msg?.content?.toString() ?? ""
                if (text) {
                  fullText += text
                  send("token", { text })
                }
              }
            }
          }
        }

        // Run full governance pipeline after streaming to get citations + scores
        const result = await WorkflowExecutor.run(orgId, input, ticketId)

        // Emit citations
        for (const citation of result.citations) {
          send("citation", citation)
        }

        // Final done event — spread to access all union members safely
        const fullResult = result as any
        send("done", {
          confidence: result.overallConfidence,
          hitlRequired: fullResult.hitlRequired ?? false,
          hitlReason: fullResult.hitlReason,
          policyChecks: fullResult.policyChecks ?? [],
          hallucinationResult: fullResult.hallucinationResult,
          latencyMs: fullResult.latencyMs,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        send("error", { message: msg })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
