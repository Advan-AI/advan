import { initTRPC, TRPCError } from '@trpc/server';
import { ZodError } from 'zod';

/**
 * Advan AI API Layer (Layer 2)
 * tRPC v11 server initialization.
 */

interface Context {
  user?: { id: string; orgId: string; role: string };
}

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Protected procedure that requires a valid session/orgId.
 * Enforces multi-tenancy at the middleware level.
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user || !ctx.user.orgId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Organization context missing' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});
