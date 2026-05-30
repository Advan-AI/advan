import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/lib/api/root';

/**
 * Advan AI tRPC Edge-Ready Route Handler
 * Implements the HTTP transport for Layer 2.
 */

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => ({
      // In production, extract user/org from Clerk or NextAuth here
      user: { id: 'dev-user', orgId: 'dev-org', role: 'admin' },
    }),
  });

export { handler as GET, handler as POST };
