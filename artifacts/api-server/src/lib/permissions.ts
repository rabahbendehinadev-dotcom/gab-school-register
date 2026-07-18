export const ALL_PERMISSIONS = [
  "view_dashboard",
  "view_students",
  "edit_students",
  "delete_students",
  "contact_students",
  "call_students",
  "open_whatsapp",
  "add_notes",
  "edit_notes",
  "view_all_students",
  "view_own_students",
  "assign_students",
  "view_team_activity",
  "manage_tasks",
  "view_reports",
  "view_ai_control",
  "manage_ai_control",
  "view_audit_logs",
  "manage_roles",
  "manage_staff",
  "manage_shifts",
  "manage_notifications",
  "view_groups",
  "manage_groups",
  "view_payments",
  "manage_payments",
  "receive_ai_alerts",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

const OWNER_PERMS: Permission[] = [...ALL_PERMISSIONS];

const ADMIN_PERMS: Permission[] = ALL_PERMISSIONS.filter(
  (p) => !["view_ai_control", "manage_ai_control", "receive_ai_alerts"].includes(p)
);

const TEAM_LEADER_PERMS: Permission[] = [
  "view_dashboard", "view_students", "edit_students", "contact_students",
  "call_students", "open_whatsapp", "add_notes", "edit_notes",
  "view_all_students", "assign_students",
  "manage_tasks", "view_reports",
  "view_groups", "manage_groups", "view_payments",
];

const SALES_AGENT_PERMS: Permission[] = [
  "view_dashboard", "view_students", "contact_students", "call_students",
  "open_whatsapp", "add_notes", "view_own_students", "manage_tasks", "view_groups",
];

const CONTENT_MANAGER_PERMS: Permission[] = [
  "view_dashboard", "view_students", "view_groups",
];

const VIEWER_PERMS: Permission[] = [
  "view_students", "view_groups",
];

export const ROLE_PERMISSION_DEFAULTS: Record<string, Permission[]> = {
  owner: OWNER_PERMS,
  admin: ADMIN_PERMS,
  manager: TEAM_LEADER_PERMS,
  team_leader: TEAM_LEADER_PERMS,
  staff: SALES_AGENT_PERMS,
  sales_agent: SALES_AGENT_PERMS,
  assistant: VIEWER_PERMS,
  content_manager: CONTENT_MANAGER_PERMS,
  viewer: VIEWER_PERMS,
};

export const DEFAULT_ROLES = [
  { name: "owner",           displayName: "المالك",           permissions: OWNER_PERMS,         isSystem: true },
  { name: "admin",           displayName: "مشرف",             permissions: ADMIN_PERMS,          isSystem: true },
  { name: "manager",         displayName: "مدير الفريق",      permissions: TEAM_LEADER_PERMS,    isSystem: false },
  { name: "team_leader",     displayName: "قائد الفريق",      permissions: TEAM_LEADER_PERMS,    isSystem: false },
  { name: "staff",           displayName: "موظف مبيعات",      permissions: SALES_AGENT_PERMS,    isSystem: false },
  { name: "sales_agent",     displayName: "مندوب مبيعات",     permissions: SALES_AGENT_PERMS,    isSystem: false },
  { name: "assistant",       displayName: "مساعد",            permissions: VIEWER_PERMS,         isSystem: false },
  { name: "content_manager", displayName: "مدير المحتوى",     permissions: CONTENT_MANAGER_PERMS, isSystem: false },
  { name: "viewer",          displayName: "مراقب",            permissions: VIEWER_PERMS,         isSystem: false },
];

export function getPermissionsForRole(roleName: string): string[] {
  return ROLE_PERMISSION_DEFAULTS[roleName] ?? VIEWER_PERMS;
}
