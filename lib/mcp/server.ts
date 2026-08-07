import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js"
import { db } from "@/lib/db"
import { tickets, customers, knowledgeSources, auditLogs } from "@/lib/db/schema"
import { eq, and, desc, count, ilike } from "drizzle-orm"
import { queryEmbeddings } from "@/lib/vector/store"
import { embedWithOllama } from "@/lib/vector/ollama-embeddings"
import { requireEnv } from "@/lib/env/required"

/**
 * Advan AI MCP Server
 *
 * Exposes Advan's core data layer as MCP tools so any MCP-compatible host
 * (Cursor, Claude Desktop, etc.) can query tickets, search the knowledge base,
 * and read analytics directly.
 *
 * Run standalone:
 *   npx tsx lib/mcp/server.ts
 *
 * Register in Cursor (~/.cursor/mcp.json):
 *   {
 *     "mcpServers": {
 *       "advan": {
 *         "command": "npx",
 *         "args": ["tsx", "/path/to/lib/mcp/server.ts"],
 *         "env": { "DATABASE_URL": "...", "MCP_ORG_ID": "<your-org-uuid>" }
 *       }
 *     }
 *   }
 *
 * MCP_ORG_ID scopes every query to a single tenant. For multi-tenant use,
 * pass the org ID as a tool argument or via an HTTP bearer token (see
 * lib/mcp/http-server.ts for the HTTP+SSE transport variant).
 */

const ORG_ID = requireEnv("MCP_ORG_ID")

const server = new Server(
  { name: "advan-ai", version: "1.0.0" },
  { capabilities: { tools: {} } }
)

// ─── Tool Definitions ────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_tickets",
      description:
        "List support tickets for the organisation. Optionally filter by status or priority.",
      inputSchema: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["open", "pending", "resolved", "closed"],
            description: "Filter by ticket status",
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
            description: "Filter by priority",
          },
          limit: {
            type: "number",
            description: "Max results to return (default 20, max 50)",
          },
        },
      },
    },
    {
      name: "get_ticket",
      description: "Get full details for a single ticket by its UUID.",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "Ticket UUID" },
        },
      },
    },
    {
      name: "create_ticket",
      description: "Create a new support ticket.",
      inputSchema: {
        type: "object",
        required: ["subject"],
        properties: {
          subject: { type: "string", description: "Ticket subject / title" },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
            default: "medium",
          },
          channel: {
            type: "string",
            enum: ["email", "chat", "voice", "slack", "portal"],
            default: "portal",
          },
        },
      },
    },
    {
      name: "search_knowledge",
      description:
        "Semantic search across the knowledge base. Returns the most relevant articles for a query.",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string", description: "Natural language search query" },
          limit: { type: "number", description: "Number of results (default 5, max 10)" },
        },
      },
    },
    {
      name: "get_analytics",
      description:
        "Get key performance metrics: total tickets, AI resolution rate, open count, resolved count.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "list_audit_logs",
      description:
        "List the most recent AI decision audit logs — includes confidence, citations, and policy checks.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of logs (default 10, max 25)" },
        },
      },
    },
  ],
}))

// ─── Tool Handlers ────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (!ORG_ID) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      "MCP_ORG_ID environment variable is not set. Set it to your organisation UUID."
    )
  }

  const { name, arguments: args = {} } = request.params

  try {
    switch (name) {
      // ── list_tickets ────────────────────────────────────────────────────────
      case "list_tickets": {
        const limit = Math.min(Number(args.limit ?? 20), 50)
        const conditions: ReturnType<typeof eq>[] = [eq(tickets.orgId, ORG_ID)]
        if (args.status) conditions.push(eq(tickets.status, args.status as any))
        if (args.priority) conditions.push(eq(tickets.priority, args.priority as any))

        const rows = await db
          .select({
            id: tickets.id,
            subject: tickets.subject,
            status: tickets.status,
            priority: tickets.priority,
            channel: tickets.channel,
            aiResolved: tickets.aiResolved,
            createdAt: tickets.createdAt,
          })
          .from(tickets)
          .where(and(...conditions))
          .orderBy(desc(tickets.createdAt))
          .limit(limit)

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ count: rows.length, tickets: rows }, null, 2),
            },
          ],
        }
      }

      // ── get_ticket ──────────────────────────────────────────────────────────
      case "get_ticket": {
        if (!args.id) throw new McpError(ErrorCode.InvalidParams, "id is required")

        const ticket = await db.query.tickets.findFirst({
          where: and(eq(tickets.id, String(args.id)), eq(tickets.orgId, ORG_ID)),
        })

        if (!ticket) {
          throw new McpError(ErrorCode.InvalidRequest, `Ticket ${args.id} not found`)
        }

        return {
          content: [{ type: "text", text: JSON.stringify(ticket, null, 2) }],
        }
      }

      // ── create_ticket ───────────────────────────────────────────────────────
      case "create_ticket": {
        if (!args.subject) throw new McpError(ErrorCode.InvalidParams, "subject is required")

        const [ticket] = await db
          .insert(tickets)
          .values({
            subject: String(args.subject),
            orgId: ORG_ID,
            priority: (args.priority as any) ?? "medium",
            channel: (args.channel as any) ?? "portal",
          })
          .returning()

        return {
          content: [
            {
              type: "text",
              text: `Ticket created successfully.\n${JSON.stringify(ticket, null, 2)}`,
            },
          ],
        }
      }

      // ── search_knowledge ────────────────────────────────────────────────────
      case "search_knowledge": {
        if (!args.query) throw new McpError(ErrorCode.InvalidParams, "query is required")

        const limit = Math.min(Number(args.limit ?? 5), 10)
        const queryText = String(args.query)

        // Try vector search first; fall back to title keyword search
        try {
          const queryVector = await embedWithOllama(queryText)
          const matches = await queryEmbeddings(ORG_ID, queryVector, limit)

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    query: queryText,
                    results: matches.map((m) => ({
                      id: m.id,
                      score: m.score,
                      title: m.metadata?.title,
                      url: m.metadata?.url,
                    })),
                  },
                  null,
                  2
                ),
              },
            ],
          }
        } catch {
          // fall through to keyword
        }

        // Keyword fallback
        const rows = await db
          .select({
            id: knowledgeSources.id,
            title: knowledgeSources.title,
            url: knowledgeSources.url,
            sourceType: knowledgeSources.sourceType,
            embeddingStatus: knowledgeSources.embeddingStatus,
          })
          .from(knowledgeSources)
          .where(
            and(
              eq(knowledgeSources.orgId, ORG_ID),
              ilike(knowledgeSources.title, `%${queryText}%`)
            )
          )
          .limit(limit)

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ query: queryText, results: rows }, null, 2),
            },
          ],
        }
      }

      // ── get_analytics ───────────────────────────────────────────────────────
      case "get_analytics": {
        const [total] = await db
          .select({ value: count() })
          .from(tickets)
          .where(eq(tickets.orgId, ORG_ID))

        const [open] = await db
          .select({ value: count() })
          .from(tickets)
          .where(and(eq(tickets.orgId, ORG_ID), eq(tickets.status, "open")))

        const [resolved] = await db
          .select({ value: count() })
          .from(tickets)
          .where(and(eq(tickets.orgId, ORG_ID), eq(tickets.status, "resolved")))

        const [aiResolved] = await db
          .select({ value: count() })
          .from(tickets)
          .where(and(eq(tickets.orgId, ORG_ID), eq(tickets.aiResolved, true)))

        const totalN = Number(total.value)
        const aiRate = totalN > 0 ? Math.round((Number(aiResolved.value) / totalN) * 100) : 0

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  totalTickets: totalN,
                  openTickets: Number(open.value),
                  resolvedTickets: Number(resolved.value),
                  aiResolutionRate: `${aiRate}%`,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      // ── list_audit_logs ─────────────────────────────────────────────────────
      case "list_audit_logs": {
        const limit = Math.min(Number(args.limit ?? 10), 25)

        const logs = await db
          .select({
            id: auditLogs.id,
            input: auditLogs.input,
            output: auditLogs.output,
            metadata: auditLogs.metadata,
            createdAt: auditLogs.createdAt,
          })
          .from(auditLogs)
          .where(eq(auditLogs.orgId, ORG_ID))
          .orderBy(desc(auditLogs.createdAt))
          .limit(limit)

        return {
          content: [{ type: "text", text: JSON.stringify({ count: logs.length, logs }, null, 2) }],
        }
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`)
    }
  } catch (err) {
    if (err instanceof McpError) throw err
    const msg = err instanceof Error ? err.message : String(err)
    throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${msg}`)
  }
})

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("[Advan MCP] Server running on stdio — waiting for requests")
}

main().catch((err) => {
  console.error("[Advan MCP] Fatal:", err)
  process.exit(1)
})
