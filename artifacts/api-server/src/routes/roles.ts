import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, rolesTable, staffTable } from "@workspace/db";
import { requirePermission } from "../middlewares/auth";
import { ALL_PERMISSIONS, DEFAULT_ROLES } from "../lib/permissions";
import { logActivity } from "../lib/activityLogger";
import "../types/session";

const router: IRouter = Router();

router.get("/roles", requirePermission("manage_roles"), async (_req, res): Promise<void> => {
  const roles = await db.select().from(rolesTable).orderBy(rolesTable.id);
  res.json(roles);
});

router.get("/roles/permissions", requirePermission("manage_roles"), (_req, res): Promise<void> => {
  res.json(ALL_PERMISSIONS);
  return Promise.resolve();
});

router.post("/roles", requirePermission("manage_roles"), async (req, res): Promise<void> => {
  const { name, displayName, permissions } = req.body as {
    name?: string;
    displayName?: string;
    permissions?: string[];
  };

  if (!name || !displayName || !Array.isArray(permissions)) {
    res.status(400).json({ error: "name, displayName و permissions مطلوبة" });
    return;
  }

  const validPerms = permissions.filter((p) => (ALL_PERMISSIONS as readonly string[]).includes(p));

  const [role] = await db
    .insert(rolesTable)
    .values({ name, displayName, permissions: validPerms, isSystem: false })
    .returning();

  const performer = req.session.fullName ?? "Unknown";
  await logActivity("role_created", `دور جديد: ${displayName}`, performer, null, {
    employeeId: req.session.staffId,
    actionType: "role_created",
    entityType: "role",
    entityId: role.id,
    newValue: JSON.stringify(validPerms),
  });

  res.status(201).json(role);
});

router.patch("/roles/:id", requirePermission("manage_roles"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(rolesTable).where(eq(rolesTable.id, id));
  if (!existing) { res.status(404).json({ error: "الدور غير موجود" }); return; }

  const { displayName, permissions } = req.body as { displayName?: string; permissions?: string[] };
  const updates: Partial<typeof rolesTable.$inferInsert> = {};

  if (displayName) updates.displayName = displayName;
  if (Array.isArray(permissions)) {
    updates.permissions = permissions.filter((p) => (ALL_PERMISSIONS as readonly string[]).includes(p));
  }

  const [role] = await db.update(rolesTable).set(updates).where(eq(rolesTable.id, id)).returning();

  const performer = req.session.fullName ?? "Unknown";
  await logActivity("role_updated", `تحديث دور: ${role.displayName}`, performer, null, {
    employeeId: req.session.staffId,
    actionType: "role_updated",
    entityType: "role",
    entityId: role.id,
    oldValue: JSON.stringify(existing.permissions),
    newValue: JSON.stringify(role.permissions),
  });

  res.json(role);
});

router.delete("/roles/:id", requirePermission("manage_roles"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(rolesTable).where(eq(rolesTable.id, id));
  if (!existing) { res.status(404).json({ error: "الدور غير موجود" }); return; }
  if (existing.isSystem) { res.status(400).json({ error: "لا يمكن حذف الأدوار الأساسية" }); return; }

  await db.delete(rolesTable).where(eq(rolesTable.id, id));

  const performer = req.session.fullName ?? "Unknown";
  await logActivity("role_deleted", `حذف دور: ${existing.displayName}`, performer, null, {
    employeeId: req.session.staffId,
    actionType: "role_deleted",
    entityType: "role",
    entityId: id,
  });

  res.sendStatus(204);
});

router.patch("/staff/:id/role", requirePermission("manage_staff"), async (req, res): Promise<void> => {
  const staffId = parseInt(String(req.params.id), 10);
  if (isNaN(staffId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { roleId, role } = req.body as { roleId?: number; role?: string };

  const updates: Partial<typeof staffTable.$inferInsert> = {};
  if (roleId !== undefined) updates.roleId = roleId;
  if (role) updates.role = role;

  const [staff] = await db.update(staffTable).set(updates).where(eq(staffTable.id, staffId)).returning();
  if (!staff) { res.status(404).json({ error: "الموظف غير موجود" }); return; }

  const performer = req.session.fullName ?? "Unknown";
  await logActivity("staff_role_changed", `تغيير دور ${staff.fullName}`, performer, null, {
    employeeId: req.session.staffId,
    actionType: "staff_role_changed",
    entityType: "staff",
    entityId: staffId,
  });

  res.json({ id: staff.id, fullName: staff.fullName, role: staff.role, roleId: staff.roleId });
});

export { DEFAULT_ROLES };
export default router;
