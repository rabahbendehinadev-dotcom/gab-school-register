import { Router, type IRouter } from "express";
import { eq, and, desc, or, gte, lte, inArray, isNotNull } from "drizzle-orm";
import {
  db,
  checklistTemplatesTable,
  checklistItemsTable,
  checklistAssignmentsTable,
  escalationLogTable,
  staffTable,
  settingsTable,
} from "@workspace/db";
import { z } from "zod/v4";
import { requirePermission, requireAnyPermission, requireAuth } from "../middlewares/auth";
import { logActivity } from "../lib/activityLogger";
import { generateDailyAssignments } from "../lib/checklistScheduler";
import "../types/session";

const router: IRouter = Router();

// ── SETTINGS helpers ─────────────────────────────────────────────────────────
const CHECKLIST_SETTING_KEYS = [
  "checklist_reminder2_min",
  "checklist_important_min",
  "checklist_overdue_min",
  "checklist_tl_notify_min",
  "checklist_ai_alert_min",
  "checklist_snooze_options",
  "checklist_max_snooze_count",
  "checklist_base_hour",
  "checklist_shift_start_hour",
  "checklist_shift_end_hour",
  "checklist_repeat_interval_min",
  "checklist_owner_staff_id",
  "checklist_default_note_required",
  "checklist_default_proof_required",
] as const;

const CHECKLIST_SETTING_DEFAULTS: Record<string, string> = {
  checklist_reminder2_min:          "15",
  checklist_important_min:          "30",
  checklist_overdue_min:            "60",
  checklist_tl_notify_min:          "90",
  checklist_ai_alert_min:           "120",
  checklist_snooze_options:         "10,30,60",
  checklist_max_snooze_count:       "3",
  checklist_base_hour:              "9",
  checklist_shift_start_hour:       "9",
  checklist_shift_end_hour:         "20",
  checklist_repeat_interval_min:    "15",
  checklist_owner_staff_id:         "0",
  checklist_default_note_required:  "false",
  checklist_default_proof_required: "false",
};

router.get("/checklists/settings", requirePermission("view_dashboard"), async (_req, res): Promise<void> => {
  const rows = await db.select().from(settingsTable).where(
    or(...CHECKLIST_SETTING_KEYS.map(k => eq(settingsTable.key, k)))
  );
  const result: Record<string, string> = { ...CHECKLIST_SETTING_DEFAULTS };
  for (const row of rows) result[row.key] = row.value;
  res.json(result);
});

router.put("/checklists/settings", requirePermission("manage_staff"), async (req, res): Promise<void> => {
  const body = req.body as Record<string, string>;
  for (const key of CHECKLIST_SETTING_KEYS) {
    if (key in body) {
      await db.insert(settingsTable).values({ key, value: String(body[key]) })
        .onConflictDoUpdate({ target: settingsTable.key, set: { value: String(body[key]), updatedAt: new Date() } });
    }
  }
  res.json({ success: true });
});

// ── TEMPLATES ─────────────────────────────────────────────────────────────────
const TemplateBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assignedToRole: z.string().optional().nullable(),
  assignedToStaffId: z.coerce.number().int().positive().optional().nullable(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  shiftType: z.string().optional().nullable(),
  recurrence: z.string().optional(),
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  enabled: z.boolean().optional(),
});

router.get("/checklists/templates", requirePermission("manage_tasks"), async (_req, res): Promise<void> => {
  const templates = await db.select().from(checklistTemplatesTable).orderBy(desc(checklistTemplatesTable.createdAt));
  const result = await Promise.all(templates.map(async (t) => {
    const items = await db.select().from(checklistItemsTable).where(eq(checklistItemsTable.templateId, t.id)).orderBy(checklistItemsTable.sortOrder);
    return { ...t, items };
  }));
  res.json(result);
});

function coerceDateFields(data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  if (typeof out.validFrom === "string") out.validFrom = new Date(out.validFrom);
  if (typeof out.validUntil === "string") out.validUntil = new Date(out.validUntil);
  if (out.validFrom === null) out.validFrom = null;
  if (out.validUntil === null) out.validUntil = null;
  return out;
}

router.post("/checklists/templates", requirePermission("manage_tasks"), async (req, res): Promise<void> => {
  const parsed = TemplateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const values = coerceDateFields(parsed.data as Record<string, unknown>);
  const [tmpl] = await db.insert(checklistTemplatesTable).values({
    ...(values as typeof parsed.data),
    createdBy: req.session.staffId,
  }).returning();
  await logActivity("checklist_template_created", `📋 قالب جديد: ${tmpl.title}`, req.session.fullName, null, { actionType: "create", entityType: "checklist_template", entityId: tmpl.id });
  res.status(201).json(tmpl);
});

router.patch("/checklists/templates/:id", requirePermission("manage_tasks"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = TemplateBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const values = coerceDateFields(parsed.data as Record<string, unknown>);
  const [tmpl] = await db.update(checklistTemplatesTable).set({ ...(values as typeof parsed.data), updatedAt: new Date() }).where(eq(checklistTemplatesTable.id, id)).returning();
  if (!tmpl) { res.status(404).json({ error: "Template not found" }); return; }
  res.json(tmpl);
});

router.delete("/checklists/templates/:id", requirePermission("manage_tasks"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(checklistTemplatesTable).where(eq(checklistTemplatesTable.id, id));
  res.sendStatus(204);
});

// ── ITEMS ─────────────────────────────────────────────────────────────────────
const ItemBody = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  proofRequired: z.boolean().optional(),
  noteRequired: z.boolean().optional(),
  resultRequired: z.boolean().optional(),
  studentRequired: z.boolean().optional(),
  offsetMinutes: z.coerce.number().int().min(0).optional(),
  sortOrder: z.coerce.number().int().optional(),
});

router.post("/checklists/templates/:templateId/items", requirePermission("manage_tasks"), async (req, res): Promise<void> => {
  const templateId = parseInt(String(req.params.templateId), 10);
  if (Number.isNaN(templateId)) { res.status(400).json({ error: "Invalid templateId" }); return; }
  const parsed = ItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [item] = await db.insert(checklistItemsTable).values({ ...parsed.data, templateId }).returning();
  res.status(201).json(item);
});

router.patch("/checklists/items/:id", requirePermission("manage_tasks"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = ItemBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [item] = await db.update(checklistItemsTable).set(parsed.data).where(eq(checklistItemsTable.id, id)).returning();
  if (!item) { res.status(404).json({ error: "Item not found" }); return; }
  res.json(item);
});

router.delete("/checklists/items/:id", requirePermission("manage_tasks"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(checklistItemsTable).where(eq(checklistItemsTable.id, id));
  res.sendStatus(204);
});

// ── ASSIGNMENTS ───────────────────────────────────────────────────────────────
/** Generate today's assignments for the calling staff member (idempotent). */
router.post("/checklists/generate", requireAuth, async (req, res): Promise<void> => {
  const staffId = req.session.staffId!;
  const role = req.session.role ?? "staff";
  // Fetch staff's own shiftType for shift-aware generation
  const [staffRow] = await db.select({ shiftType: staffTable.shiftType }).from(staffTable).where(eq(staffTable.id, staffId));
  await generateDailyAssignments(staffId, role, staffRow?.shiftType ?? null);
  res.json({ success: true });
});

/** Get assignments for the calling staff member:
 *  - ALL incomplete assignments from any day (persistent accountability)
 *  - Plus today's completed/cancelled/postponed assignments
 */
router.get("/checklists/my", requireAuth, async (req, res): Promise<void> => {
  const { ne, notInArray } = await import("drizzle-orm");
  const staffId = req.session.staffId!;
  const today = new Date();
  const dateKey = today.toISOString().slice(0, 10);
  const terminalStatuses = ["completed", "cancelled", "postponed"];

  const assignments = await db
    .select()
    .from(checklistAssignmentsTable)
    .where(and(
      eq(checklistAssignmentsTable.staffId, staffId),
      or(
        // All non-terminal from any date (persistent carry-over)
        notInArray(checklistAssignmentsTable.status, terminalStatuses),
        // Today's terminal ones (completed/cancelled/postponed today)
        eq(checklistAssignmentsTable.dateKey, dateKey),
      ),
    ))
    .orderBy(checklistAssignmentsTable.dueAt);
  res.json(assignments);
});

/** Get ALL assignments for admin/TL (any date range). */
router.get("/checklists/assignments", requirePermission("manage_tasks"), async (req, res): Promise<void> => {
  const dateKey = String(req.query.dateKey || new Date().toISOString().slice(0, 10));
  const assignments = await db
    .select({
      id: checklistAssignmentsTable.id,
      title: checklistAssignmentsTable.title,
      status: checklistAssignmentsTable.status,
      priority: checklistAssignmentsTable.priority,
      dueAt: checklistAssignmentsTable.dueAt,
      staffId: checklistAssignmentsTable.staffId,
      staffName: staffTable.fullName,
      note: checklistAssignmentsTable.note,
      completedAt: checklistAssignmentsTable.completedAt,
      snoozeCount: checklistAssignmentsTable.snoozeCount,
      proofRequired: checklistAssignmentsTable.proofRequired,
      noteRequired: checklistAssignmentsTable.noteRequired,
      dateKey: checklistAssignmentsTable.dateKey,
      cancelledAt: checklistAssignmentsTable.cancelledAt,
    })
    .from(checklistAssignmentsTable)
    .leftJoin(staffTable, eq(checklistAssignmentsTable.staffId, staffTable.id))
    .where(eq(checklistAssignmentsTable.dateKey, dateKey))
    .orderBy(checklistAssignmentsTable.dueAt);
  res.json(assignments);
});

// ── ASSIGNMENT ACTIONS ────────────────────────────────────────────────────────
router.post("/checklists/assignments/:id/start", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(checklistAssignmentsTable).where(eq(checklistAssignmentsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Assignment not found" }); return; }

  const perms: string[] = req.session.permissions ?? [];
  const isAdmin = perms.includes("manage_staff") || perms.includes("assign_students");
  if (existing.staffId !== req.session.staffId && !isAdmin) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }

  const [updated] = await db.update(checklistAssignmentsTable)
    .set({ status: "in_progress", startedAt: new Date() })
    .where(and(eq(checklistAssignmentsTable.id, id), eq(checklistAssignmentsTable.status, "not_started")))
    .returning();
  if (!updated) { res.status(409).json({ error: "Cannot start — check current status" }); return; }
  await logActivity("checklist_started", `▶️ بدأ المهمة: ${existing.title}`, req.session.fullName, null, { actionType: "start", entityType: "checklist_assignment", entityId: id });
  res.json(updated);
});

const CompleteBody = z.object({
  note: z.string().optional().nullable(),
  result: z.string().optional().nullable(),
  proofUrl: z.string().optional().nullable(),
  studentId: z.coerce.number().int().positive().optional().nullable(),
});

router.post("/checklists/assignments/:id/complete", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(checklistAssignmentsTable).where(eq(checklistAssignmentsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Assignment not found" }); return; }

  const perms: string[] = req.session.permissions ?? [];
  const isAdmin = perms.includes("manage_staff") || perms.includes("assign_students");
  if (existing.staffId !== req.session.staffId && !isAdmin) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }

  if (existing.status === "completed") { res.status(409).json({ error: "المهمة منجزة بالفعل" }); return; }
  if (existing.cancelledAt) { res.status(409).json({ error: "المهمة ملغاة" }); return; }

  const parsed = CompleteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const validationErrors: string[] = [];
  if (existing.noteRequired && !parsed.data.note?.trim()) validationErrors.push("الملاحظة مطلوبة لهذه المهمة");
  if (existing.proofRequired && !parsed.data.proofUrl?.trim()) validationErrors.push("رفع إثبات الإنجاز مطلوب لهذه المهمة");
  if (existing.resultRequired && !parsed.data.result?.trim()) validationErrors.push("يجب تحديد نتيجة المهمة");
  if (existing.studentRequired && !parsed.data.studentId) validationErrors.push("يجب تحديد الطالب المرتبط بهذه المهمة");

  if (validationErrors.length > 0) {
    res.status(422).json({ error: "يرجى استيفاء جميع الشروط", details: validationErrors }); return;
  }

  const [updated] = await db.update(checklistAssignmentsTable)
    .set({
      status: "completed",
      completedAt: new Date(),
      note: parsed.data.note ?? null,
      result: parsed.data.result ?? null,
      proofUrl: parsed.data.proofUrl ?? null,
      studentId: parsed.data.studentId ?? null,
    })
    .where(eq(checklistAssignmentsTable.id, id))
    .returning();
  await logActivity("checklist_completed", `✅ أنجز المهمة: ${existing.title}`, req.session.fullName, null, { actionType: "complete", entityType: "checklist_assignment", entityId: id });
  res.json(updated);
});

const SnoozeBody = z.object({
  durationMinutes: z.coerce.number().int().positive(),
});

router.post("/checklists/assignments/:id/snooze", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(checklistAssignmentsTable).where(eq(checklistAssignmentsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Assignment not found" }); return; }
  if (existing.staffId !== req.session.staffId) { res.status(403).json({ error: "غير مصرح" }); return; }
  if (existing.status === "completed" || existing.cancelledAt) { res.status(409).json({ error: "لا يمكن تأجيل مهمة منتهية" }); return; }

  const maxSnoozeRow = await db.select().from(settingsTable).where(eq(settingsTable.key, "checklist_max_snooze_count"));
  const maxSnooze = parseInt(maxSnoozeRow[0]?.value ?? "3", 10);
  if (existing.snoozeCount >= maxSnooze) {
    res.status(422).json({ error: `تجاوزت الحد الأقصى للتأجيل (${maxSnooze} مرات)` }); return;
  }

  const snoozeOptsRow = await db.select().from(settingsTable).where(eq(settingsTable.key, "checklist_snooze_options"));
  const allowedMins = (snoozeOptsRow[0]?.value ?? "10,30,60").split(",").map(Number);
  const parsed = SnoozeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  if (!allowedMins.includes(parsed.data.durationMinutes)) {
    res.status(400).json({ error: `مدة التأجيل غير مسموح بها. الخيارات: ${allowedMins.join(", ")} دقيقة` }); return;
  }

  const snoozeUntil = new Date(Date.now() + parsed.data.durationMinutes * 60 * 1000);
  const [updated] = await db.update(checklistAssignmentsTable)
    .set({ snoozeUntil, snoozeCount: existing.snoozeCount + 1 })
    .where(eq(checklistAssignmentsTable.id, id))
    .returning();
  await logActivity("checklist_snoozed", `⏸ تأجيل المهمة: ${existing.title} لمدة ${parsed.data.durationMinutes} دقيقة (مرة ${updated.snoozeCount})`, req.session.fullName, null, { actionType: "snooze", entityType: "checklist_assignment", entityId: id });
  res.json(updated);
});

const HelpBody = z.object({ note: z.string().optional() });

router.post("/checklists/assignments/:id/help", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [existing] = await db.select().from(checklistAssignmentsTable).where(eq(checklistAssignmentsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Assignment not found" }); return; }
  if (existing.staffId !== req.session.staffId) { res.status(403).json({ error: "غير مصرح" }); return; }
  const parsed = HelpBody.safeParse(req.body);
  await logActivity("checklist_help_requested", `🆘 طلب مساعدة: ${existing.title}${parsed.success && parsed.data.note ? " — " + parsed.data.note : ""}`, req.session.fullName, null, { actionType: "help", entityType: "checklist_assignment", entityId: id });
  res.json({ success: true });
});

const PostponeBody = z.object({ note: z.string().optional() });

router.post("/checklists/assignments/:id/postpone-request", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [existing] = await db.select().from(checklistAssignmentsTable).where(eq(checklistAssignmentsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Assignment not found" }); return; }
  if (existing.staffId !== req.session.staffId) { res.status(403).json({ error: "غير مصرح" }); return; }
  if (existing.status === "completed" || existing.cancelledAt) { res.status(409).json({ error: "لا يمكن طلب تأجيل مهمة منتهية" }); return; }
  // Set to pending_postpone — awaits Admin/TL approval
  await db.update(checklistAssignmentsTable).set({ status: "pending_postpone" }).where(eq(checklistAssignmentsTable.id, id));
  await logActivity("checklist_postpone_requested", `📤 طلب تأجيل: ${existing.title}`, req.session.fullName, null, { actionType: "postpone_request", entityType: "checklist_assignment", entityId: id });
  res.json({ success: true });
});

router.post("/checklists/assignments/:id/approve-postpone", requirePermission("manage_tasks"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [existing] = await db.select().from(checklistAssignmentsTable).where(eq(checklistAssignmentsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Assignment not found" }); return; }
  if (existing.status !== "pending_postpone") { res.status(409).json({ error: "المهمة ليست في حالة انتظار التأجيل" }); return; }
  const [updated] = await db.update(checklistAssignmentsTable)
    .set({ status: "postponed" })
    .where(eq(checklistAssignmentsTable.id, id))
    .returning();
  await logActivity("checklist_postpone_approved", `✅ تأجيل موافق عليه: ${existing.title}`, req.session.fullName, null, { actionType: "postpone_approve", entityType: "checklist_assignment", entityId: id });
  res.json(updated);
});

router.post("/checklists/assignments/:id/reject-postpone", requirePermission("manage_tasks"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [existing] = await db.select().from(checklistAssignmentsTable).where(eq(checklistAssignmentsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Assignment not found" }); return; }
  if (existing.status !== "pending_postpone") { res.status(409).json({ error: "المهمة ليست في حالة انتظار التأجيل" }); return; }
  // Return to in_progress if previously started, otherwise not_started
  const revertStatus = existing.startedAt ? "in_progress" : "not_started";
  const [updated] = await db.update(checklistAssignmentsTable)
    .set({ status: revertStatus })
    .where(eq(checklistAssignmentsTable.id, id))
    .returning();
  await logActivity("checklist_postpone_rejected", `❌ رُفض طلب التأجيل: ${existing.title}`, req.session.fullName, null, { actionType: "postpone_reject", entityType: "checklist_assignment", entityId: id });
  res.json(updated);
});

router.post("/checklists/assignments/:id/cancel", requirePermission("manage_tasks"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [updated] = await db.update(checklistAssignmentsTable)
    .set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: req.session.staffId })
    .where(eq(checklistAssignmentsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Assignment not found" }); return; }
  res.json(updated);
});

/** Handover / transfer log — reassigned assignments with origin staff info. */
router.get("/checklists/handover-log", requirePermission("manage_tasks"), async (req, res): Promise<void> => {
  const fromStaff = staffTable;
  const toStaff   = { ...staffTable } as typeof staffTable;
  // Simple: fetch all assignments that have been reassigned (reassignedFrom IS NOT NULL)
  const rows = await db
    .select({
      id: checklistAssignmentsTable.id,
      title: checklistAssignmentsTable.title,
      dateKey: checklistAssignmentsTable.dateKey,
      status: checklistAssignmentsTable.status,
      priority: checklistAssignmentsTable.priority,
      dueAt: checklistAssignmentsTable.dueAt,
      reassignedFrom: checklistAssignmentsTable.reassignedFrom,
      staffId: checklistAssignmentsTable.staffId,
      completedAt: checklistAssignmentsTable.completedAt,
      toStaffName: fromStaff.fullName,
    })
    .from(checklistAssignmentsTable)
    .leftJoin(fromStaff, eq(checklistAssignmentsTable.staffId, fromStaff.id))
    .where(isNotNull(checklistAssignmentsTable.reassignedFrom))
    .orderBy(desc(checklistAssignmentsTable.createdAt))
    .limit(200);

  // Resolve original staff names separately
  const fromIds = [...new Set(rows.map(r => r.reassignedFrom).filter(Boolean) as number[])];
  const fromMap: Record<number, string> = {};
  if (fromIds.length > 0) {
    const fromRows = await db.select({ id: staffTable.id, fullName: staffTable.fullName })
      .from(staffTable)
      .where(inArray(staffTable.id, fromIds));
    for (const r of fromRows) fromMap[r.id] = r.fullName;
  }

  const result = rows.map(r => ({
    ...r,
    fromStaffName: r.reassignedFrom ? (fromMap[r.reassignedFrom] ?? `#${r.reassignedFrom}`) : null,
  }));
  res.json(result);
});

router.post("/checklists/assignments/:id/reassign", requirePermission("manage_tasks"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { staffId: newStaffId } = req.body as { staffId: number };
  if (!newStaffId) { res.status(400).json({ error: "staffId required" }); return; }
  const [existing] = await db.select().from(checklistAssignmentsTable).where(eq(checklistAssignmentsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const [updated] = await db.update(checklistAssignmentsTable)
    .set({ staffId: newStaffId, reassignedFrom: existing.staffId })
    .where(eq(checklistAssignmentsTable.id, id))
    .returning();
  await logActivity("checklist_reassigned", `🔄 أُعيد تعيين المهمة: ${existing.title}`, req.session.fullName, null, { actionType: "reassign", entityType: "checklist_assignment", entityId: id });
  res.json(updated);
});

router.get("/checklists/assignments/:id/escalations", requirePermission("manage_tasks"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const logs = await db.select().from(escalationLogTable).where(eq(escalationLogTable.assignmentId, id)).orderBy(escalationLogTable.notifiedAt);
  res.json(logs);
});

export default router;
