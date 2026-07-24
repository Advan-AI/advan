import { initTRPC, TRPCError } from '@trpc/server';
import { sanitizeTrpcErrorShape } from './sanitize-trpc-error';

/**
 * Advan AI API Layer (Layer 2)
 * tRPC v11 server initialization.
 */

interface Context {
  user?: { id: string; orgId: string; role: string };
}

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    // Never leak SQL, stacks, or raw Zod JSON to clients (dev or prod).
    return sanitizeTrpcErrorShape(shape, error);
  },
});

import { db } from "@/lib/db"
import { organizations } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

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

/**
 * Procedural guard for active billing subscriptions.
 * Reusable across dashboard write routes to restrict access for past_due or canceled orgs
 * while keeping read actions and chat intake fully operational.
 */
export const activeSubscriptionProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, ctx.user.orgId),
    columns: { subscriptionStatus: true },
  })

  if (org?.subscriptionStatus === "past_due" || org?.subscriptionStatus === "canceled") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Billing subscription is past due or canceled. Please update your billing details under Settings to restore full dashboard access.",
    })
  }

  return next()
})
