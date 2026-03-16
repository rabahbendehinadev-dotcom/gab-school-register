import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, groupsTable, studentsTable } from "@workspace/db";
import {
  CreateGroupBody,
  ListGroupsResponse,
  GetGroupParams,
  GetGroupResponse,
  UpdateGroupParams,
  UpdateGroupBody,
  UpdateGroupResponse,
  DeleteGroupParams,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";
import { logActivity } from "../lib/activityLogger";
import "../types/session";

const router: IRouter = Router();

router.get("/groups", requireRole("admin", "manager", "staff"), async (_req, res): Promise<void> => {
  const groups = await db.select().from(groupsTable).orderBy(groupsTable.startDate);

  const groupsWithCounts = await Promise.all(
    groups.map(async (g) => {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(studentsTable)
        .where(eq(studentsTable.groupId, g.id));
      return { ...g, studentCount: countResult?.count ?? 0 };
    })
  );

  res.json(ListGroupsResponse.parse(groupsWithCounts));
});

router.post("/groups", requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const parsed = CreateGroupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [group] = await db
    .insert(groupsTable)
    .values(parsed.data)
    .returning();

  const performer = req.session.fullName ?? "Unknown";
  await logActivity("group_created", `Group created: ${group.name}`, performer);

  res.status(201).json({ ...group, studentCount: 0 });
});

router.get("/groups/:id", requireRole("admin", "manager", "staff"), async (req, res): Promise<void> => {
  const params = GetGroupParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [group] = await db
    .select()
    .from(groupsTable)
    .where(eq(groupsTable.id, params.data.id));

  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  const students = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.groupId, group.id));

  res.json(
    GetGroupResponse.parse({
      ...group,
      studentCount: students.length,
      students,
    })
  );
});

router.patch("/groups/:id", requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const params = UpdateGroupParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateGroupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [group] = await db
    .update(groupsTable)
    .set(parsed.data)
    .where(eq(groupsTable.id, params.data.id))
    .returning();

  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(studentsTable)
    .where(eq(studentsTable.groupId, group.id));

  const performer = req.session.fullName ?? "Unknown";
  await logActivity("group_updated", `Group updated: ${group.name}`, performer);

  res.json(UpdateGroupResponse.parse({ ...group, studentCount: countResult?.count ?? 0 }));
});

router.delete("/groups/:id", requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const params = DeleteGroupParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [group] = await db
    .delete(groupsTable)
    .where(eq(groupsTable.id, params.data.id))
    .returning();

  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  const performer = req.session.fullName ?? "Unknown";
  await logActivity("group_deleted", `Group deleted: ${group.name}`, performer);

  res.sendStatus(204);
});

export default router;
