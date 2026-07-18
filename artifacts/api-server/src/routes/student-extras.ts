import { Router, type IRouter } from "express";
import { eq, desc, asc, and } from "drizzle-orm";
import { db, studentsTable, studentNotesTable, attendanceTable, activityLogsTable, paymentsTable, groupsTable } from "@workspace/db";
import { z } from "zod/v4";
import { requirePermission, requireAnyPermission, requireAuth } from "../middlewares/auth";
import { logActivity } from "../lib/activityLogger";
import "../types/session";

const router: IRouter = Router();

// ---------- NOTES ----------
const CreateNoteBody = z.object({ content: z.string().min(1) });

router.get("/students/:id/notes", requireAnyPermission("view_students", "view_all_students"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const notes = await db.select().from(studentNotesTable).where(eq(studentNotesTable.studentId, id)).orderBy(desc(studentNotesTable.createdAt));
  res.json(notes);
});

router.post("/students/:id/notes", requirePermission("add_notes"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = CreateNoteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const performer = req.session.fullName ?? "Unknown";
  const [note] = await db.insert(studentNotesTable).values({
    studentId: id,
    content: parsed.data.content,
    createdBy: performer
  }).returning();
  await logActivity("note_added", `📝 ملاحظة جديدة`, performer, id, {
    employeeId: req.session.staffId,
    actionType: "note_added",
    entityType: "student",
    entityId: id,
    newValue: parsed.data.content.substring(0, 500),
    sessionId: req.session.sessionToken,
  });
  res.status(201).json(note);
});

// ---------- ATTENDANCE ----------
const SetAttendanceBody = z.object({
  dayNumber: z.coerce.number().int().min(1).max(5),
  present: z.boolean(),
});

router.get("/students/:id/attendance", requireAnyPermission("view_students", "view_all_students"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const rows = await db.select().from(attendanceTable).where(eq(attendanceTable.studentId, id)).orderBy(asc(attendanceTable.dayNumber));
  res.json(rows);
});

router.put("/students/:id/attendance", requirePermission("edit_students"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = SetAttendanceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  const performer = req.session.fullName ?? "Unknown";
  const [existing] = await db.select().from(attendanceTable).where(and(eq(attendanceTable.studentId, id), eq(attendanceTable.dayNumber, parsed.data.dayNumber)));

  let row;
  if (existing) {
    [row] = await db.update(attendanceTable).set({ present: parsed.data.present, markedBy: performer, groupId: student.groupId }).where(eq(attendanceTable.id, existing.id)).returning();
  } else {
    [row] = await db.insert(attendanceTable).values({ studentId: id, groupId: student.groupId, dayNumber: parsed.data.dayNumber, present: parsed.data.present, markedBy: performer }).returning();
  }

  await logActivity("attendance_marked", `${parsed.data.present ? "✅ حاضر" : "❌ غائب"} — اليوم ${parsed.data.dayNumber}`, performer, id, {
    employeeId: req.session.staffId,
    actionType: "attendance_marked",
    entityType: "student",
    entityId: id,
    newValue: JSON.stringify({ day: parsed.data.dayNumber, present: parsed.data.present }),
    sessionId: req.session.sessionToken,
  });
  res.json(row);
});

router.get("/groups/:id/attendance", requirePermission("view_groups"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const students = await db.select().from(studentsTable).where(eq(studentsTable.groupId, id)).orderBy(asc(studentsTable.firstName));
  const att = await db.select().from(attendanceTable).where(eq(attendanceTable.groupId, id));
  const byStudent = new Map<number, Record<number, boolean>>();
  for (const a of att) {
    if (!byStudent.has(a.studentId)) byStudent.set(a.studentId, {});
    byStudent.get(a.studentId)![a.dayNumber] = a.present;
  }
  res.json(students.map((s) => ({
    id: s.id, firstName: s.firstName, lastName: s.lastName, phone: s.phone,
    attendance: byStudent.get(s.id) ?? {},
  })));
});

// ---------- TIMELINE ----------
router.get("/students/:id/timeline", requireAnyPermission("view_students", "view_all_students"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const logs = await db.select().from(activityLogsTable).where(eq(activityLogsTable.studentId, id)).orderBy(desc(activityLogsTable.createdAt)).limit(200);
  const notes = await db.select().from(studentNotesTable).where(eq(studentNotesTable.studentId, id));
  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.studentId, id));

  type TimelineItem = { kind: string; icon: string; text: string; by: string | null; at: string };
  const items: TimelineItem[] = [];

  for (const l of logs) items.push({ kind: l.action, icon: "📌", text: l.details, by: l.performedBy, at: l.createdAt.toISOString() });
  for (const n of notes) items.push({ kind: "note", icon: "📝", text: n.content, by: n.createdBy, at: n.createdAt.toISOString() });
  for (const p of payments) items.push({ kind: "payment", icon: "💰", text: `دفعة ${p.amount} دج (${p.type})${p.note ? " — " + p.note : ""}`, by: p.recordedBy, at: p.createdAt.toISOString() });

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  res.json(items);
});

// ---------- FOLLOW-UP / CONTACT TRACKING ----------
const FollowupBody = z.object({
  nextFollowupAt: z.coerce.date().optional().nullable(),
  incrementAttempt: z.boolean().optional(),
});

router.patch("/students/:id/followup", requirePermission("contact_students"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = FollowupBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  const updates: Record<string, unknown> = {};
  if (parsed.data.nextFollowupAt !== undefined) updates.nextFollowupAt = parsed.data.nextFollowupAt;
  if (parsed.data.incrementAttempt) {
    updates.contactAttempts = (student.contactAttempts ?? 0) + 1;
    updates.lastContactedAt = new Date();
  }

  const [updated] = await db.update(studentsTable).set(updates).where(eq(studentsTable.id, id)).returning();
  const performer = req.session.fullName ?? "Unknown";
  if (parsed.data.incrementAttempt) {
    await logActivity("contact_logged", `📞 تسجيل محاولة تواصل (#${updated.contactAttempts})`, performer, id, {
      employeeId: req.session.staffId,
      actionType: "contact_click",
      entityType: "student",
      entityId: id,
      newValue: String(updated.contactAttempts),
      sessionId: req.session.sessionToken,
    });
  }
  res.json(updated);
});

// ---------- CLIENT-SIDE ACTION TRACKING ----------
const TrackActionBody = z.object({
  actionType: z.enum(["whatsapp_click", "call_click", "email_click"]),
  studentId: z.coerce.number().int().optional().nullable(),
});

router.post("/log/action", requireAuth, async (req, res): Promise<void> => {
  const parsed = TrackActionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const performer = req.session.fullName ?? "Unknown";
  const actionLabels: Record<string, string> = {
    whatsapp_click: "فتح واتساب",
    call_click: "نقر على الاتصال",
    email_click: "نقر على البريد",
  };
  await logActivity(
    parsed.data.actionType,
    `${actionLabels[parsed.data.actionType]} — ${performer}`,
    performer,
    parsed.data.studentId ?? null,
    {
      employeeId: req.session.staffId,
      actionType: parsed.data.actionType,
      entityType: "student",
      entityId: parsed.data.studentId ?? null,
      sessionId: req.session.sessionToken,
    }
  ).catch(() => {});
  res.json({ ok: true });
});

export default router;
