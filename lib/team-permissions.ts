export type BaseTeamRole = "admin" | "member" | "viewer"

export const TEAM_PERMISSION_CATALOG = [
  {
    key: "tickets.read",
    label: "View tickets",
    description: "Browse the full support ticket queue.",
    category: "Support",
  },
  {
    key: "tickets.write",
    label: "Manage tickets",
    description: "Create, assign, update, and resolve tickets.",
    category: "Support",
  },
  {
    key: "conversations.respond",
    label: "Respond in conversations",
    description: "Send customer-facing replies and follow-ups.",
    category: "Support",
  },
  {
    key: "copilot.use",
    label: "Use Copilot",
    description: "Generate AI drafts and apply suggestions.",
    category: "AI",
  },
  {
    key: "knowledge.manage",
    label: "Manage knowledge base",
    description: "Upload, edit, and archive help content.",
    category: "AI",
  },
  {
    key: "analytics.read",
    label: "View analytics",
    description: "Access KPI, triage, and operational reports.",
    category: "Insights",
  },
  {
    key: "workflows.manage",
    label: "Manage workflows",
    description: "Create, activate, and tune workflow automations.",
    category: "Automation",
  },
  {
    key: "integrations.manage",
    label: "Manage integrations",
    description: "Configure chat widget, APIs, and external tools.",
    category: "Platform",
  },
  {
    key: "billing.manage",
    label: "Manage billing",
    description: "Update plan, payment methods, and invoices.",
    category: "Platform",
  },
  {
    key: "settings.organization",
    label: "Edit organization settings",
    description: "Change workspace identity and global settings.",
    category: "Security",
  },
  {
    key: "team.manage",
    label: "Manage team",
    description: "Invite users, assign roles, and remove members.",
    category: "Security",
  },
] as const

export const TEAM_PERMISSION_KEYS = TEAM_PERMISSION_CATALOG.map((item) => item.key)

export const DEFAULT_ROLE_PERMISSIONS: Record<BaseTeamRole, string[]> = {
  admin: [...TEAM_PERMISSION_KEYS],
  member: [
    "tickets.read",
    "tickets.write",
    "conversations.respond",
    "copilot.use",
    "knowledge.manage",
    "analytics.read",
    "workflows.manage",
  ],
  viewer: ["tickets.read", "analytics.read"],
}

export const BUILTIN_ROLES: Array<{
  id: string
  key: string
  name: string
  description: string
  baseRole: BaseTeamRole
  isSystem: true
  permissions: string[]
}> = [
  {
    id: "system-admin",
    key: "admin",
    name: "Administrator",
    description: "Full control over workspace, users, billing, and automation.",
    baseRole: "admin",
    isSystem: true,
    permissions: DEFAULT_ROLE_PERMISSIONS.admin,
  },
  {
    id: "system-member",
    key: "member",
    name: "Member",
    description: "Operate support workflows without sensitive platform controls.",
    baseRole: "member",
    isSystem: true,
    permissions: DEFAULT_ROLE_PERMISSIONS.member,
  },
  {
    id: "system-viewer",
    key: "viewer",
    name: "Viewer",
    description: "Read-only visibility into operations and reporting.",
    baseRole: "viewer",
    isSystem: true,
    permissions: DEFAULT_ROLE_PERMISSIONS.viewer,
  },
]

const CATALOG_KEY_SET: Set<string> = new Set(TEAM_PERMISSION_KEYS)

export function sanitizePermissions(input: string[]): string[] {
  return Array.from(new Set(input)).filter((permission) => CATALOG_KEY_SET.has(permission))
}
