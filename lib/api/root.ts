import { router } from "./trpc"
import { governanceRouter } from "./routers/governance"
import { orchestrationRouter } from "./routers/orchestration"
import { copilotRouter } from "./routers/copilot"
import { ticketsRouter } from "./routers/tickets"
import { conversationsRouter } from "./routers/conversations"
import { customersRouter } from "./routers/customers"
import { knowledgeRouter } from "./routers/knowledge"
import { analyticsRouter } from "./routers/analytics"
import { integrationsRouter } from "./routers/integrations"

/**
 * Advan AI Root tRPC Router — all procedures registered here.
 */
export const appRouter = router({
  governance: governanceRouter,
  orchestration: orchestrationRouter,
  copilot: copilotRouter,
  tickets: ticketsRouter,
  conversations: conversationsRouter,
  customers: customersRouter,
  knowledge: knowledgeRouter,
  analytics: analyticsRouter,
  integrations: integrationsRouter,
})

export type AppRouter = typeof appRouter
