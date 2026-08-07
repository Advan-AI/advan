import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import http from "http"
import { requireEnv, requireIntEnv } from "@/lib/env/required"

/**
 * Advan AI MCP HTTP+SSE Server
 *
 * Alternative transport for environments that prefer HTTP over stdio.
 * Used when the MCP host (e.g. a web dashboard or CI runner) can't spawn
 * a child process but can make HTTP requests.
 *
 * Start with:
 *   MCP_ORG_ID=<uuid> MCP_PORT=3001 npx tsx lib/mcp/http-server.ts
 *
 * The SSE endpoint lives at: GET /sse
 * Messages are POSTed to:    POST /message
 */

// Re-export the same tool definitions from the stdio server so this file stays
// thin. The real handler logic lives in lib/mcp/server.ts — we just swap the
// transport layer here.

const PORT = requireIntEnv("MCP_PORT", process.env, { min: 1 })
const MCP_ALLOWED_ORIGIN = requireEnv("MCP_ALLOWED_ORIGIN")

async function main() {
  // Lazy-import the configured server from the stdio module. Since both share
  // the same Server instance we just re-attach a different transport.
  const { default: serverModule } = await import("./server.js" as any)
  const mcpServer: Server = serverModule

  const httpServer = http.createServer()

  const transports = new Map<string, SSEServerTransport>()

  httpServer.on("request", async (req, res) => {
    // CORS — allow any origin in dev; lock down in production via env
    res.setHeader("Access-Control-Allow-Origin", MCP_ALLOWED_ORIGIN)
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")

    if (req.method === "OPTIONS") {
      res.writeHead(204)
      res.end()
      return
    }

    if (req.method === "GET" && req.url === "/sse") {
      const transport = new SSEServerTransport("/message", res)
      transports.set(transport.sessionId, transport)
      res.on("close", () => transports.delete(transport.sessionId))
      await mcpServer.connect(transport)
      return
    }

    if (req.method === "POST" && req.url?.startsWith("/message")) {
      const url = new URL(req.url, `http://localhost:${PORT}`)
      const sessionId = url.searchParams.get("sessionId") ?? ""
      const transport = transports.get(sessionId)

      if (!transport) {
        res.writeHead(404, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "Session not found" }))
        return
      }

      await transport.handlePostMessage(req, res)
      return
    }

    res.writeHead(404)
    res.end("Not found")
  })

  httpServer.listen(PORT, () => {
    console.error(`[Advan MCP HTTP] SSE transport listening on http://localhost:${PORT}/sse`)
  })
}

main().catch((err) => {
  console.error("[Advan MCP HTTP] Fatal:", err)
  process.exit(1)
})
