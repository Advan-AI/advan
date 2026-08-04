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
import { organizations, orgRoles, users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import {
  DEFAULT_ROLE_PERMISSIONS,
  TEAM_PERMISSION_KEYS,
  sanitizePermissions,
  type BaseTeamRole,
} from "@/lib/team-permissions"

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

type TeamPermissionKey = (typeof TEAM_PERMISSION_KEYS)[number]

async function resolveUserPermissions(input: {
  userId: string
  orgId: string
  fallbackRole: BaseTeamRole
}): Promise<string[]> {
  const userRow = await db.query.users.findFirst({
    where: eq(users.id, input.userId),
    columns: { id: true, orgId: true, role: true, roleId: true },
  })

  if (!userRow || userRow.orgId !== input.orgId) {
    return DEFAULT_ROLE_PERMISSIONS[input.fallbackRole]
  }

  if (!userRow.roleId) {
    return DEFAULT_ROLE_PERMISSIONS[userRow.role]
  }

  const customRole = await db.query.orgRoles.findFirst({
    where: eq(orgRoles.id, userRow.roleId),
    columns: { id: true, orgId: true, permissions: true },
  })

  if (!customRole || customRole.orgId !== input.orgId) {
    return DEFAULT_ROLE_PERMISSIONS[userRow.role]
  }

  return sanitizePermissions(customRole.permissions || [])
}

/**
 * Permission-aware procedure guard for org-scoped dashboard actions.
 * Uses built-in role defaults unless a custom org role assignment exists.
 */
export const permissionedProcedure = (permission: TeamPermissionKey) =>
  protectedProcedure.use(async ({ ctx, next }) => {
    const permissions = await resolveUserPermissions({
      userId: ctx.user.id,
      orgId: ctx.user.orgId,
      fallbackRole: ctx.user.role as BaseTeamRole,
    })

    if (!permissions.includes(permission)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Missing required permission: ${permission}`,
      })
    }

    return next()
  })
