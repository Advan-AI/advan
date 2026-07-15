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
import { widgetConfigRouter } from "./routers/widget-config"
import { authRouter } from "./routers/auth"
import { teamRouter } from "./routers/team"
import { billingRouter } from "./routers/billing"

/**
 * Advan AI Root tRPC Router — all procedures registered here.
 */
export const appRouter = router({
  auth: authRouter,
  billing: billingRouter,
  team: teamRouter,
  governance: governanceRouter,
  orchestration: orchestrationRouter,
  copilot: copilotRouter,
  tickets: ticketsRouter,
  conversations: conversationsRouter,
  customers: customersRouter,
  knowledge: knowledgeRouter,
  analytics: analyticsRouter,
  integrations: integrationsRouter,
  widgetConfig: widgetConfigRouter,
})

export type AppRouter = typeof appRouter
