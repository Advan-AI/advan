import { router } from './trpc';
import { governanceRouter } from './routers/governance';
import { orchestrationRouter } from './routers/orchestration';

/**
 * Advan AI Root tRPC Router
 */
export const appRouter = router({
  governance: governanceRouter,
  orchestration: orchestrationRouter,
});

export type AppRouter = typeof appRouter;
