import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import { buildSuggestionService } from "@/lib/copilot/composition"
import type { SuggestionEvent } from "@/lib/copilot/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Co-Pilot suggestion stream (SSE).
 *
 * POST /api/copilot/stream  (body, NOT query string — keeps the prompt out of
 * access logs / proxies, unlike the legacy GET /api/sse).
 *
 * Frames:  id: <seq>\nevent: <type>\ndata: <json>\n\n
 * Heartbeat comment frames (": ping") keep intermediaries from closing idle
 * connections. `Last-Event-ID` lets a reconnecting client skip already-seen
 * events (best-effort dedup within a reconnect window).
 */

const BodySchema = z.object({
  input: z.string().min(1).max(8000),
  ticketId: z.string().uuid().optional(),
  threshold: z.number().min(0).max(100).optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.orgId) return new Response("Unauthorized", { status: 401 })

  let parsed: z.infer<typeof BodySchema>
  try {
    parsed = BodySchema.parse(await req.json())
  } catch {
    return new Response("Invalid request body", { status: 400 })
  }

  const lastEventId = Number(req.headers.get("last-event-id") ?? -1)
  const service = buildSuggestionService()
  const encoder = new TextEncoder()
  let seq = 0

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      const heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": ping\n\n"))
      }, 15_000)

      const send = (event: SuggestionEvent) => {
        const id = seq++
        if (id <= lastEventId) return // already delivered before reconnect
        controller.enqueue(encoder.encode(`id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`))
      }

      try {
        for await (const event of service.run({
          orgId: session.user.orgId,
          userId: session.user.id,
          input: parsed.input,
          ticketId: parsed.ticketId,
          threshold: parsed.threshold ?? 85,
        })) {
          send(event)
        }
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : String(err), recoverable: true })
      } finally {
        closed = true
        clearInterval(heartbeat)
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
