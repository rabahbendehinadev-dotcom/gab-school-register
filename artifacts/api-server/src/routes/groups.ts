import { Router, type IRouter } from "express";
import { eq, sql, and, isNull } from "drizzle-orm";
import { db, groupsTable, studentsTable } from "@workspace/db";
import {
  CreateGroupBody,
  UpdateGroupParams,
  UpdateGroupBody,
  UpdateGroupResponse,
  DeleteGroupParams,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";
import { logActivity } from "../lib/activityLogger";
import "../types/session";

const router: IRouter = Router();

function dateToStr(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().split("T")[0];
  return String(d).split("T")[0];
}

// GET /groups — returns all groups with per-group stats, ordered by position
router.get("/groups", requireRole("admin", "manager", "staff", "assistant"), async (_req, res): Promise<void> => {
  const result = await db.execute(sql`
    SELECT
      g.id,
      g.name,
      g.start_date                                                           AS start_date,
      g.training_type                                                        AS training_type,
      g.capacity,
      g.status,
      g.notes,
      g.position,
      g.color,
      g.hidden,
      COUNT(s.id)      FILTER (WHERE s.deleted_at IS NULL)::int              AS student_count,
      COUNT(s.id)      FILTER (WHERE s.deleted_at IS NULL
                               AND s.stage IN ('confirmed','attended','completed'))::int
                                                                             AS confirmed_count,
      COUNT(s.id)      FILTER (WHERE s.deleted_at IS NULL
                               AND s.payment_status IN ('paid','deposited'))::int
                                                                             AS paid_count,
      COUNT(s.id)      FILTER (WHERE s.deleted_at IS NULL
                               AND s.stage = 'no_show')::int                AS absent_count
    FROM groups g
    LEFT JOIN students s ON s.group_id = g.id
    WHERE g.deleted_at IS NULL
    GROUP BY g.id
    ORDER BY g.position ASC, g.start_date DESC
  `);

  const groups = (result.rows as Record<string, unknown>[]).map(r => ({
    id:             r.id,
    name:           r.name,
    startDate:      dateToStr(r.start_date as Date | string | null),
    trainingType:   r.training_type,
    capacity:       Number(r.capacity),
    status:         r.status,
    notes:          r.notes ?? null,
    position:       Number(r.position ?? 0),
    color:          (r.color as string | null) ?? null,
    hidden:         Boolean(r.hidden),
    studentCount:   Number(r.student_count  ?? 0),
    confirmedCount: Number(r.confirmed_count ?? 0),
    paidCount:      Number(r.paid_count      ?? 0),
    absentCount:    Number(r.absent_count    ?? 0),
  }));

  res.json(groups);
});

// POST /groups/reorder — bulk update positions
router.post("/groups/reorder", requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const { positions } = req.body as { positions: { id: number; position: number }[] };
  if (!Array.isArray(positions)) {
    res.status(400).json({ error: "positions must be an array" });
    return;
  }
  await Promise.all(
    positions.map(({ id, position }) =>
      db.update(groupsTable).set({ position }).where(eq(groupsTable.id, id)),
    ),
  );
  res.sendStatus(204);
});

// POST /groups
router.post("/groups", requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const parsed = CreateGroupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Place new group at the end
  const [{ maxPos }] = await db.execute(sql`SELECT COALESCE(MAX(position), -1) AS "maxPos" FROM groups WHERE deleted_at IS NULL`) as unknown as [{ maxPos: number }];

  const [group] = await db
    .insert(groupsTable)
    .values({ ...parsed.data, startDate: new Date(parsed.data.startDate), position: (maxPos ?? -1) + 1 })
    .returning();

  const performer = req.session.fullName ?? "Unknown";
  await logActivity("group_created", `Group created: ${group.name}`, performer);

  res.status(201).json({
    ...group,
    startDate:      dateToStr(group.startDate),
    position:       group.position,
    color:          group.color ?? null,
    hidden:         group.hidden,
    studentCount:   0,
    confirmedCount: 0,
    paidCount:      0,
    absentCount:    0,
  });
});

// GET /groups/:id — returns group with full student list + stats (bypasses orval parser)
router.get("/groups/:id", requireRole("admin", "manager", "staff", "assistant"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const [group] = await db
    .select()
    .from(groupsTable)
    .where(and(eq(groupsTable.id, id), isNull(groupsTable.deletedAt)));

  if (!group) { res.status(404).json({ error: "Group not found" }); return; }

  const students = await db
    .select()
    .from(studentsTable)
    .where(and(eq(studentsTable.groupId, group.id), isNull(studentsTable.deletedAt)));

  const confirmedCount = students.filter(s => ["confirmed","attended","completed"].includes(s.stage)).length;
  const paidCount      = students.filter(s => ["paid","deposited"].includes(s.paymentStatus)).length;
  const absentCount    = students.filter(s => s.stage === "no_show").length;

  const formatDate = (d: Date | string | null | undefined) =>
    d instanceof Date ? d.toISOString() : (d ?? null);

  res.json({
    id:             group.id,
    name:           group.name,
    startDate:      dateToStr(group.startDate),
    trainingType:   group.trainingType,
    capacity:       group.capacity,
    status:         group.status,
    notes:          group.notes ?? null,
    position:       group.position,
    color:          group.color ?? null,
    hidden:         group.hidden,
    studentCount:   students.length,
    confirmedCount,
    paidCount,
    absentCount,
    students: students.map(s => ({
      id:              s.id,
      firstName:       s.firstName,
      lastName:        s.lastName,
      phone:           s.phone,
      whatsapp:        s.whatsapp,
      city:            s.city,
      stage:           s.stage,
      paymentStatus:   s.paymentStatus,
      note:            s.note ?? null,
      contactReason:   s.contactReason ?? null,
      trainingType:    s.trainingType,
      receiptUrl:      s.receiptUrl ?? null,
      createdAt:       formatDate(s.createdAt),
    })),
  });
});

// PATCH /groups/:id/color — update custom color
router.patch("/groups/:id/color", requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const { color } = req.body as { color: string | null };
  await db.update(groupsTable).set({ color: color ?? null }).where(eq(groupsTable.id, id));
  res.sendStatus(204);
});

// PATCH /groups/:id/visibility — show/hide a group
router.patch("/groups/:id/visibility", requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const { hidden } = req.body as { hidden: boolean };
  await db.update(groupsTable).set({ hidden: Boolean(hidden) }).where(eq(groupsTable.id, id));
  res.sendStatus(204);
});

// PATCH /groups/:id
router.patch("/groups/:id", requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const params = UpdateGroupParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateGroupBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { startDate: startDateStr, ...restData } = parsed.data;
  const updateValues = {
    ...restData,
    ...(startDateStr ? { startDate: new Date(startDateStr) } : {}),
  };

  const [group] = await db
    .update(groupsTable)
    .set(updateValues)
    .where(eq(groupsTable.id, params.data.id))
    .returning();

  if (!group) { res.status(404).json({ error: "Group not found" }); return; }

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(studentsTable)
    .where(and(eq(studentsTable.groupId, group.id), isNull(studentsTable.deletedAt)));

  const performer = req.session.fullName ?? "Unknown";
  await logActivity("group_updated", `Group updated: ${group.name}`, performer);

  res.json(UpdateGroupResponse.parse({
    ...group,
    startDate:    dateToStr(group.startDate),
    studentCount: countResult?.count ?? 0,
  }));
});

// DELETE /groups/:id
router.delete("/groups/:id", requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const params = DeleteGroupParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [group] = await db
    .delete(groupsTable)
    .where(eq(groupsTable.id, params.data.id))
    .returning();

  if (!group) { res.status(404).json({ error: "Group not found" }); return; }

  const performer = req.session.fullName ?? "Unknown";
  await logActivity("group_deleted", `Group deleted: ${group.name}`, performer);

  res.sendStatus(204);
});

export default router;
