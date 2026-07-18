import { Router, type IRouter } from "express";
import { eq, and, desc, gte, inArray } from "drizzle-orm";
import { db, studentsTable, staffTable, staffSessionsTable, studentOwnersTable, callResultsTable } from "@workspace/db";
import { z } from "zod/v4";
import { requirePermission, requireAuth } from "../middlewares/auth";
import { logActivity } from "../lib/activityLogger";
import "../types/session";

const router: IRouter = Router();

// ---------- ASSIGNABLE STAFF (for owner dialog — gated by assign_students) ----------
router.get("/staff/assignable", requirePermission("assign_students"), async (_req, res): Promise<void> => {
  const staff = await db
    .select({ id: staffTable.id, fullName: staffTable.fullName, role: staffTable.role, username: staffTable.username })
    .from(staffTable)
    .orderBy(staffTable.fullName);
  res.json(staff);
});

// ---------- CONCURRENT VIEWERS ----------
router.get("/students/:id/viewers", requirePermission("view_students"), async (req, res): Promise<void> => {
  const studentId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(studentId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);
  const sessions = await db
    .select({
      staffId: staffSessionsTable.staffId,
      fullName: staffTable.fullName,
      sessionToken: staffSessionsTable.sessionToken,
    })
    .from(staffSessionsTable)
    .leftJoin(staffTable, eq(staffSessionsTable.staffId, staffTable.id))
    .where(
      and(
        eq(staffSessionsTable.currentStudentId, studentId),
        eq(staffSessionsTable.isActive, true),
        gte(staffSessionsTable.lastHeartbeatAt, twoMinAgo)
      )
    );

  const myToken = req.session.sessionToken;
  const viewers = sessions
    .filter(s => s.sessionToken !== myToken)
    .map(s => ({ staffId: s.staffId, fullName: s.fullName ?? "موظف" }));

  res.json({ viewers });
});

// ---------- PRIMARY OWNER ----------
const AssignOwnerBody = z.object({ staffId: z.coerce.number().int().positive() });

router.get("/students/:id/owner", requirePermission("view_students"), async (req, res): Promise<void> => {
  const studentId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(studentId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [owner] = await db
    .select({ staffId: studentOwnersTable.staffId, fullName: staffTable.fullName, assignedAt: studentOwnersTable.assignedAt })
    .from(studentOwnersTable)
    .leftJoin(staffTable, eq(studentOwnersTable.staffId, staffTable.id))
    .where(eq(studentOwnersTable.studentId, studentId))
    .orderBy(desc(studentOwnersTable.assignedAt))
    .limit(1);

  res.json(owner ?? null);
});

router.post("/students/:id/owner", requirePermission("assign_students"), async (req, res): Promise<void> => {
  const studentId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(studentId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = AssignOwnerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [student] = await db.select({ id: studentsTable.id }).from(studentsTable).where(eq(studentsTable.id, studentId));
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  const [staff] = await db.select({ id: staffTable.id, fullName: staffTable.fullName }).from(staffTable).where(eq(staffTable.id, parsed.data.staffId));
  if (!staff) { res.status(404).json({ error: "Staff not found" }); return; }

  await db.delete(studentOwnersTable).where(inArray(studentOwnersTable.studentId, [studentId]));
  const [row] = await db.insert(studentOwnersTable).values({
    studentId,
    staffId: parsed.data.staffId,
    assignedBy: req.session.staffId,
  }).returning();

  const performer = req.session.fullName ?? "Unknown";
  await logActivity("owner_assigned", `👤 تعيين مسؤول: ${staff.fullName}`, performer, studentId, {
    employeeId: req.session.staffId,
    actionType: "owner_assigned",
    entityType: "student",
    entityId: studentId,
    newValue: staff.fullName,
    sessionId: req.session.sessionToken,
  }).catch(() => {});

  res.json({ ...row, fullName: staff.fullName });
});

// ---------- CALL TRACKING ----------
const CallAttemptBody = z.object({
  studentId: z.coerce.number().int().positive(),
});

const CallResultBody = z.object({
  result: z.enum(["answered", "no_answer", "busy", "wrong_number", "callback", "not_attempted"]),
  durationSeconds: z.coerce.number().int().min(0).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  nextFollowupAt: z.coerce.date().optional().nullable(),
});

router.post("/students/:id/call-attempt", requirePermission("call_students"), async (req, res): Promise<void> => {
  const studentId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(studentId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const staffId = req.session.staffId!;
  const staffName = req.session.fullName ?? "Unknown";

  const [row] = await db.insert(callResultsTable).values({
    studentId,
    staffId,
    staffName,
    source: "call_button",
    clickedAt: new Date(),
  }).returning();

  await logActivity("call_click", `📞 نقر على الاتصال`, staffName, studentId, {
    employeeId: staffId,
    actionType: "call_click",
    entityType: "student",
    entityId: studentId,
    sessionId: req.session.sessionToken,
  }).catch(() => {});

  res.status(201).json(row);
});

router.post("/students/:id/call-result/:callId", requirePermission("call_students"), async (req, res): Promise<void> => {
  const studentId = parseInt(String(req.params.id), 10);
  const callId = parseInt(String(req.params.callId), 10);
  if (Number.isNaN(studentId) || Number.isNaN(callId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = CallResultBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(callResultsTable).where(and(eq(callResultsTable.id, callId), eq(callResultsTable.studentId, studentId)));
  if (!existing) { res.status(404).json({ error: "Call attempt not found" }); return; }

  const [row] = await db.update(callResultsTable).set({
    result: parsed.data.result,
    durationSeconds: parsed.data.durationSeconds ?? null,
    note: parsed.data.note ?? null,
    nextFollowupAt: parsed.data.nextFollowupAt ?? null,
    source: "confirmed",
  }).where(eq(callResultsTable.id, callId)).returning();

  const staffName = req.session.fullName ?? "Unknown";
  const resultLabels: Record<string, string> = {
    answered: "تم الرد ✅",
    no_answer: "لا يرد ❌",
    busy: "مشغول ⚠️",
    wrong_number: "رقم خاطئ 🚫",
    callback: "طلب معاودة الاتصال 🔄",
    not_attempted: "لم تتم المكالمة",
  };

  if (parsed.data.nextFollowupAt) {
    await db.update(studentsTable).set({ nextFollowupAt: parsed.data.nextFollowupAt }).where(eq(studentsTable.id, studentId)).catch(() => {});
  }

  await logActivity("call_result", `📞 نتيجة المكالمة: ${resultLabels[parsed.data.result] ?? parsed.data.result}${parsed.data.note ? " — " + parsed.data.note : ""}`, staffName, studentId, {
    employeeId: req.session.staffId,
    actionType: "call_result",
    entityType: "student",
    entityId: studentId,
    newValue: parsed.data.result,
    sessionId: req.session.sessionToken,
  }).catch(() => {});

  res.json(row);
});

router.get("/students/:id/call-results", requirePermission("view_students"), async (req, res): Promise<void> => {
  const studentId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(studentId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const results = await db
    .select()
    .from(callResultsTable)
    .where(eq(callResultsTable.studentId, studentId))
    .orderBy(desc(callResultsTable.createdAt));

  res.json(results);
});

export default router;
