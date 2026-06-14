import { createTRPCReact } from "@trpc/react-query"
import type { AppRouter } from "@/lib/api/root"

/**
 * tRPC React client — type-safe hook access to all backend procedures.
 * Usage in client components:
 *
 *   import { api } from "@/lib/api/trpc-client"
 *   const { data } = api.tickets.list.useQuery()
 */
export const api = createTRPCReact<AppRouter>()
