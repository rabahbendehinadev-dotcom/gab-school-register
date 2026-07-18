import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, staffTable } from "@workspace/db";
import {
  CreateStaffBody,
  ListStaffResponse,
  UpdateStaffParams,
  UpdateStaffBody,
  UpdateStaffResponse,
  DeleteStaffParams,
} from "@workspace/api-zod";
import { requirePermission, requireAnyPermission } from "../middlewares/auth";
import { hashPassword } from "../lib/password";
import { logActivity } from "../lib/activityLogger";
import "../types/session";

const router: IRouter = Router();

router.get("/staff", requirePermission("manage_staff"), async (_req, res): Promise<void> => {
  const staff = await db.select().from(staffTable).orderBy(staffTable.createdAt);
  const safeStaff = staff.map((s) => ({
    id: s.id,
    username: s.username,
    fullName: s.fullName,
    role: s.role,
    roleId: s.roleId,
    shiftType: s.shiftType,
    createdAt: s.createdAt,
  }));
  res.json(ListStaffResponse.parse(safeStaff));
});

/** Minimal staff list (id + name only) for assignee dropdowns — accessible by TLs with manage_tasks. */
router.get("/staff/assignable", requireAnyPermission("manage_staff", "manage_tasks"), async (_req, res): Promise<void> => {
  const staff = await db.select({ id: staffTable.id, fullName: staffTable.fullName }).from(staffTable).orderBy(staffTable.fullName);
  res.json(staff);
});

router.post("/staff", requirePermission("manage_staff"), async (req, res): Promise<void> => {
  const parsed = CreateStaffBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const existing = await db.select().from(staffTable).where(eq(staffTable.username, parsed.data.username));
  if (existing.length > 0) { res.status(400).json({ error: "Username already exists" }); return; }

  const roleId = req.body.roleId !== undefined ? Number(req.body.roleId) : undefined;

  const [staff] = await db
    .insert(staffTable)
    .values({
      username: parsed.data.username,
      passwordHash: hashPassword(parsed.data.password),
      fullName: parsed.data.fullName,
      role: parsed.data.role,
      ...(roleId ? { roleId } : {}),
    })
    .returning();

  const performer = req.session.fullName ?? "Unknown";
  await logActivity("staff_created", `إضافة موظف: ${staff.fullName} (${staff.role})`, performer, null, {
    employeeId: req.session.staffId,
    actionType: "staff_created",
    entityType: "staff",
    entityId: staff.id,
    newValue: JSON.stringify({ role: staff.role }),
    sessionId: req.session.sessionToken,
  });

  res.status(201).json({ id: staff.id, username: staff.username, fullName: staff.fullName, role: staff.role, createdAt: staff.createdAt });
});

router.patch("/staff/:id", requirePermission("manage_staff"), async (req, res): Promise<void> => {
  const params = UpdateStaffParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateStaffBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [before] = await db.select().from(staffTable).where(eq(staffTable.id, params.data.id));
  const updateData: Record<string, unknown> = {};
  if (parsed.data.fullName) updateData.fullName = parsed.data.fullName;
  if (parsed.data.role) updateData.role = parsed.data.role;
  if (parsed.data.password) updateData.passwordHash = hashPassword(parsed.data.password);
  if (req.body.roleId !== undefined) updateData.roleId = Number(req.body.roleId);

  const [staff] = await db.update(staffTable).set(updateData).where(eq(staffTable.id, params.data.id)).returning();
  if (!staff) { res.status(404).json({ error: "Staff not found" }); return; }

  const performer = req.session.fullName ?? "Unknown";
  await logActivity("staff_updated", `تحديث بيانات: ${staff.fullName}`, performer, null, {
    employeeId: req.session.staffId,
    actionType: "staff_updated",
    entityType: "staff",
    entityId: staff.id,
    oldValue: before ? JSON.stringify({ role: before.role }) : null,
    newValue: JSON.stringify({ role: staff.role }),
    sessionId: req.session.sessionToken,
  });

  res.json(UpdateStaffResponse.parse({ id: staff.id, username: staff.username, fullName: staff.fullName, role: staff.role, createdAt: staff.createdAt }));
});

router.delete("/staff/:id", requirePermission("manage_staff"), async (req, res): Promise<void> => {
  const params = DeleteStaffParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [staff] = await db.delete(staffTable).where(eq(staffTable.id, params.data.id)).returning();
  if (!staff) { res.status(404).json({ error: "Staff not found" }); return; }

  const performer = req.session.fullName ?? "Unknown";
  await logActivity("staff_deleted", `حذف موظف: ${staff.fullName}`, performer, null, {
    employeeId: req.session.staffId,
    actionType: "staff_deleted",
    entityType: "staff",
    entityId: staff.id,
    sessionId: req.session.sessionToken,
  });

  res.sendStatus(204);
});

export default router;
