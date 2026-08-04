import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { hash } from "bcryptjs"

import { router, protectedProcedure } from "../trpc"
import { db } from "@/lib/db"
import { orgRoles, users } from "@/lib/db/schema"
import { assertSeatLimit } from "@/lib/billing/subscription-service"
import { BUILTIN_ROLES, DEFAULT_ROLE_PERMISSIONS, sanitizePermissions } from "@/lib/team-permissions"

const BUILTIN_ROLE_KEY_SET = new Set(BUILTIN_ROLES.map((role) => role.key))
const BUILTIN_ROLE_MAP = new Map(BUILTIN_ROLES.map((role) => [role.key, role]))

function slugifyRoleKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

async function ensureAdmin(callerRole: string) {
  if (callerRole !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only administrators can manage team access.",
    })
  }
}

async function resolveRoleSelection(orgId: string, roleKey: string | undefined, fallbackRole: "admin" | "member" | "viewer") {
  const normalizedKey = roleKey?.trim().toLowerCase()

  if (!normalizedKey || BUILTIN_ROLE_KEY_SET.has(normalizedKey)) {
    const builtin = BUILTIN_ROLE_MAP.get(normalizedKey || fallbackRole) || BUILTIN_ROLE_MAP.get(fallbackRole)
    if (!builtin) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid role selection." })
    }
    return {
      baseRole: builtin.baseRole,
      roleId: null as string | null,
      effectiveRoleKey: builtin.key,
      effectiveRoleName: builtin.name,
      permissions: builtin.permissions,
    }
  }

  const customRole = await db.query.orgRoles.findFirst({
    where: and(eq(orgRoles.orgId, orgId), eq(orgRoles.key, normalizedKey)),
    columns: {
      id: true,
      key: true,
      name: true,
      baseRole: true,
      permissions: true,
    },
  })

  if (!customRole) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Selected role was not found." })
  }

  return {
    baseRole: customRole.baseRole,
    roleId: customRole.id,
    effectiveRoleKey: customRole.key,
    effectiveRoleName: customRole.name,
    permissions: sanitizePermissions(customRole.permissions || []),
  }
}

async function assertNotLastAdmin(orgId: string, targetUserId: string) {
  const orgUsers = await db.query.users.findMany({
    where: eq(users.orgId, orgId),
    columns: { id: true, role: true },
  })

  const adminCount = orgUsers.filter((user) => user.role === "admin").length
  const targetIsAdmin = orgUsers.some((user) => user.id === targetUserId && user.role === "admin")

  if (targetIsAdmin && adminCount <= 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "At least one administrator must remain in the workspace.",
    })
  }
}

export const teamRouter = router({
  /**
   * List all members of the caller's organization.
   */
  listMembers: protectedProcedure.query(async ({ ctx }) => {
    const [members, customRoles] = await Promise.all([
      db.query.users.findMany({
        where: eq(users.orgId, ctx.user.orgId),
        columns: { id: true, name: true, email: true, role: true, roleId: true, createdAt: true },
      }),
      db.query.orgRoles.findMany({
        where: eq(orgRoles.orgId, ctx.user.orgId),
        columns: {
          id: true,
          key: true,
          name: true,
          baseRole: true,
          permissions: true,
          description: true,
          isSystem: true,
        },
      }),
    ])

    const customRoleMap = new Map(customRoles.map((role) => [role.id, role]))

    return members.map((member) => {
      const customRole = member.roleId ? customRoleMap.get(member.roleId) : undefined
      const builtinRole = BUILTIN_ROLE_MAP.get(member.role)

      return {
        ...member,
        roleKey: customRole?.key || member.role,
        roleName: customRole?.name || builtinRole?.name || member.role,
        permissions: customRole
          ? sanitizePermissions(customRole.permissions || [])
          : DEFAULT_ROLE_PERMISSIONS[member.role],
      }
    })
  }),

  /**
   * List built-in and custom roles available to the caller's organization.
   */
  listRoles: protectedProcedure.query(async ({ ctx }) => {
    const customRoles = await db.query.orgRoles.findMany({
      where: eq(orgRoles.orgId, ctx.user.orgId),
      columns: {
        id: true,
        key: true,
        name: true,
        description: true,
        baseRole: true,
        permissions: true,
        isSystem: true,
        createdAt: true,
      },
    })

    return [
      ...BUILTIN_ROLES,
      ...customRoles.map((role) => ({
        ...role,
        permissions: sanitizePermissions(role.permissions || []),
      })),
    ]
  }),

  /**
   * Create a custom role with granular permissions.
   */
  createRole: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(60),
        description: z.string().max(240).optional(),
        baseRole: z.enum(["admin", "member", "viewer"]),
        permissions: z.array(z.string()).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureAdmin(ctx.user.role)

      const normalizedName = input.name.trim()
      const key = slugifyRoleKey(normalizedName)

      if (!key) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Role name must contain letters or numbers." })
      }

      if (BUILTIN_ROLE_KEY_SET.has(key)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This role key is reserved by a system role." })
      }

      const existingRoles = await db.query.orgRoles.findMany({
        where: eq(orgRoles.orgId, ctx.user.orgId),
        columns: { id: true, key: true, name: true },
      })

      if (existingRoles.some((role) => role.key === key)) {
        throw new TRPCError({ code: "CONFLICT", message: "A custom role with this name already exists." })
      }

      if (existingRoles.some((role) => role.name.toLowerCase() === normalizedName.toLowerCase())) {
        throw new TRPCError({ code: "CONFLICT", message: "A custom role with this display name already exists." })
      }

      const [createdRole] = await db
        .insert(orgRoles)
        .values({
          orgId: ctx.user.orgId,
          key,
          name: normalizedName,
          description: input.description?.trim() || null,
          baseRole: input.baseRole,
          permissions: sanitizePermissions(input.permissions),
          isSystem: false,
        })
        .returning({
          id: orgRoles.id,
          key: orgRoles.key,
          name: orgRoles.name,
          description: orgRoles.description,
          baseRole: orgRoles.baseRole,
          permissions: orgRoles.permissions,
          isSystem: orgRoles.isSystem,
          createdAt: orgRoles.createdAt,
        })

      return {
        ...createdRole,
        permissions: sanitizePermissions(createdRole.permissions || []),
      }
    }),

  /**
   * Update an existing custom role.
   */
  updateRole: protectedProcedure
    .input(
      z.object({
        roleId: z.string().uuid(),
        name: z.string().min(2).max(60),
        description: z.string().max(240).optional(),
        baseRole: z.enum(["admin", "member", "viewer"]),
        permissions: z.array(z.string()).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureAdmin(ctx.user.role)

      const existingRole = await db.query.orgRoles.findFirst({
        where: and(eq(orgRoles.id, input.roleId), eq(orgRoles.orgId, ctx.user.orgId)),
        columns: { id: true, key: true, isSystem: true },
      })

      if (!existingRole) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Role not found." })
      }

      if (existingRole.isSystem) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "System roles cannot be edited." })
      }

      const normalizedName = input.name.trim()
      const key = slugifyRoleKey(normalizedName)
      if (!key) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Role name must contain letters or numbers." })
      }
      if (BUILTIN_ROLE_KEY_SET.has(key)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This role key is reserved by a system role." })
      }

      const siblings = await db.query.orgRoles.findMany({
        where: eq(orgRoles.orgId, ctx.user.orgId),
        columns: { id: true, key: true, name: true },
      })

      if (siblings.some((role) => role.id !== input.roleId && role.key === key)) {
        throw new TRPCError({ code: "CONFLICT", message: "Another custom role already uses this name." })
      }

      if (siblings.some((role) => role.id !== input.roleId && role.name.toLowerCase() === normalizedName.toLowerCase())) {
        throw new TRPCError({ code: "CONFLICT", message: "Another custom role already uses this display name." })
      }

      const [updatedRole] = await db
        .update(orgRoles)
        .set({
          key,
          name: normalizedName,
          description: input.description?.trim() || null,
          baseRole: input.baseRole,
          permissions: sanitizePermissions(input.permissions),
        })
        .where(and(eq(orgRoles.id, input.roleId), eq(orgRoles.orgId, ctx.user.orgId)))
        .returning({
          id: orgRoles.id,
          key: orgRoles.key,
          name: orgRoles.name,
          description: orgRoles.description,
          baseRole: orgRoles.baseRole,
          permissions: orgRoles.permissions,
          isSystem: orgRoles.isSystem,
          createdAt: orgRoles.createdAt,
        })

      return {
        ...updatedRole,
        permissions: sanitizePermissions(updatedRole.permissions || []),
      }
    }),

  /**
   * Delete a custom role. Assigned users can optionally be reassigned.
   */
  deleteRole: protectedProcedure
    .input(
      z.object({
        roleId: z.string().uuid(),
        replacementRoleKey: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureAdmin(ctx.user.role)

      const targetRole = await db.query.orgRoles.findFirst({
        where: and(eq(orgRoles.id, input.roleId), eq(orgRoles.orgId, ctx.user.orgId)),
        columns: { id: true, key: true, name: true, baseRole: true, isSystem: true },
      })

      if (!targetRole) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Role not found." })
      }

      if (targetRole.isSystem) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "System roles cannot be deleted." })
      }

      const assignedMembers = await db.query.users.findMany({
        where: and(eq(users.orgId, ctx.user.orgId), eq(users.roleId, targetRole.id)),
        columns: { id: true },
      })

      if (assignedMembers.length > 0) {
        if (!input.replacementRoleKey) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This role is assigned to members. Choose a replacement role first.",
          })
        }

        const replacement = await resolveRoleSelection(ctx.user.orgId, input.replacementRoleKey, "member")

        await db
          .update(users)
          .set({
            role: replacement.baseRole,
            roleId: replacement.roleId,
          })
          .where(and(eq(users.orgId, ctx.user.orgId), eq(users.roleId, targetRole.id)))
      }

      await db.delete(orgRoles).where(and(eq(orgRoles.id, targetRole.id), eq(orgRoles.orgId, ctx.user.orgId)))

      return { success: true }
    }),

  /**
   * Invite a new member to the organization.
   *
   * Seat enforcement: assertSeatLimit counts existing users and throws if the
   * org is at its plan's seatLimit. Seats are a hard cap — no silent overage.
   */
  addMember: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        role: z.enum(["admin", "member", "viewer"]).default("member"),
        roleKey: z.string().optional(),
        // Temporary password; in production this would be a magic-link invite.
        // Included here so the row is immediately usable without a separate flow.
        password: z.string().min(6),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureAdmin(ctx.user.role)

      // 1. Hard seat-limit check — throws with a clear upgrade message if at limit.
      try {
        await assertSeatLimit(ctx.user.orgId)
      } catch (err: any) {
        throw new TRPCError({ code: "FORBIDDEN", message: err.message })
      }

      const emailLower = input.email.toLowerCase().trim()

      // 2. Duplicate email guard.
      const existing = await db.query.users.findFirst({
        where: eq(users.email, emailLower),
        columns: { id: true },
      })
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A user with this email address already exists.",
        })
      }

      const passwordHash = await hash(input.password, 12)
      const roleSelection = await resolveRoleSelection(ctx.user.orgId, input.roleKey, input.role)

      const [newUser] = await db
        .insert(users)
        .values({
          orgId: ctx.user.orgId,
          email: emailLower,
          name: input.name.trim(),
          passwordHash,
          role: roleSelection.baseRole,
          roleId: roleSelection.roleId,
        })
        .returning({ id: users.id, email: users.email, name: users.name, role: users.role, roleId: users.roleId })

      return {
        ...newUser,
        roleKey: roleSelection.effectiveRoleKey,
        roleName: roleSelection.effectiveRoleName,
        permissions: roleSelection.permissions,
      }
    }),

  /**
   * Update an existing member's role assignment.
   */
  updateMemberRole: protectedProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        roleKey: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureAdmin(ctx.user.role)

      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Use your own profile settings to change access." })
      }

      const target = await db.query.users.findFirst({
        where: and(eq(users.id, input.userId), eq(users.orgId, ctx.user.orgId)),
        columns: { id: true, role: true },
      })

      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found." })
      }

      const selectedRole = await resolveRoleSelection(ctx.user.orgId, input.roleKey, "member")

      if (target.role === "admin" && selectedRole.baseRole !== "admin") {
        await assertNotLastAdmin(ctx.user.orgId, target.id)
      }

      await db
        .update(users)
        .set({
          role: selectedRole.baseRole,
          roleId: selectedRole.roleId,
        })
        .where(and(eq(users.id, target.id), eq(users.orgId, ctx.user.orgId)))

      return { success: true }
    }),

  /**
   * Remove a member from the organization.
   * Admins cannot remove themselves.
   */
  removeMember: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ensureAdmin(ctx.user.role)

      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot remove yourself." })
      }

      const target = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
        columns: { id: true, orgId: true },
      })

      if (!target || target.orgId !== ctx.user.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found." })
      }

      await assertNotLastAdmin(ctx.user.orgId, target.id)

      await db.delete(users).where(eq(users.id, input.userId))
      return { success: true }
    }),
})
