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
import { requireAuth, requireRole } from "../middlewares/auth";
import { hashPassword } from "../lib/password";
import { logActivity } from "../lib/activityLogger";
import "../types/session";

const router: IRouter = Router();

router.get("/staff", requireRole("admin"), async (_req, res): Promise<void> => {
  const staff = await db.select().from(staffTable).orderBy(staffTable.createdAt);

  const safeStaff = staff.map((s) => ({
    id: s.id,
    username: s.username,
    fullName: s.fullName,
    role: s.role,
    createdAt: s.createdAt,
  }));

  res.json(ListStaffResponse.parse(safeStaff));
});

router.post("/staff", requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = CreateStaffBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db
    .select()
    .from(staffTable)
    .where(eq(staffTable.username, parsed.data.username));

  if (existing.length > 0) {
    res.status(400).json({ error: "Username already exists" });
    return;
  }

  const [staff] = await db
    .insert(staffTable)
    .values({
      username: parsed.data.username,
      passwordHash: hashPassword(parsed.data.password),
      fullName: parsed.data.fullName,
      role: parsed.data.role,
    })
    .returning();

  const performer = req.session.fullName ?? "Unknown";
  await logActivity("staff_created", `Staff member created: ${staff.fullName} (${staff.role})`, performer);

  res.status(201).json({
    id: staff.id,
    username: staff.username,
    fullName: staff.fullName,
    role: staff.role,
    createdAt: staff.createdAt,
  });
});

router.patch("/staff/:id", requireRole("admin"), async (req, res): Promise<void> => {
  const params = UpdateStaffParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateStaffBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, string> = {};
  if (parsed.data.fullName) updateData.fullName = parsed.data.fullName;
  if (parsed.data.role) updateData.role = parsed.data.role;
  if (parsed.data.password) updateData.passwordHash = hashPassword(parsed.data.password);

  const [staff] = await db
    .update(staffTable)
    .set(updateData)
    .where(eq(staffTable.id, params.data.id))
    .returning();

  if (!staff) {
    res.status(404).json({ error: "Staff not found" });
    return;
  }

  const performer = req.session.fullName ?? "Unknown";
  await logActivity("staff_updated", `Staff member updated: ${staff.fullName}`, performer);

  res.json(
    UpdateStaffResponse.parse({
      id: staff.id,
      username: staff.username,
      fullName: staff.fullName,
      role: staff.role,
      createdAt: staff.createdAt,
    })
  );
});

router.delete("/staff/:id", requireRole("admin"), async (req, res): Promise<void> => {
  const params = DeleteStaffParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [staff] = await db
    .delete(staffTable)
    .where(eq(staffTable.id, params.data.id))
    .returning();

  if (!staff) {
    res.status(404).json({ error: "Staff not found" });
    return;
  }

  const performer = req.session.fullName ?? "Unknown";
  await logActivity("staff_deleted", `Staff member deleted: ${staff.fullName}`, performer);

  res.sendStatus(204);
});

export default router;
