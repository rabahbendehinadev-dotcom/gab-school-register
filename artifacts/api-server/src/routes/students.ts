import { Router, type IRouter } from "express";
import { eq, ilike, or, and, sql, desc, isNull, gte, lt } from "drizzle-orm";
import { db, studentsTable, groupsTable } from "@workspace/db";
import {
  CreateStudentBody,
  GetStudentParams,
  UpdateStudentParams,
  UpdateStudentBody,
  DeleteStudentParams,
  UpdateStudentStageParams,
  UpdateStudentStageParams as _USP,
  AssignStudentToGroupParams,
  AssignStudentToGroupBody,
  GetDashboardStatsResponse,
} from "@workspace/api-zod";
import { requirePermission, requireAuth } from "../middlewares/auth";
import { logActivity } from "../lib/activityLogger";
import { createNotification } from "../lib/notifications";
import { sendTelegramNotification } from "../lib/telegram";
import { objectStorageClient } from "../lib/objectStorage";
import multer from "multer";
import { randomUUID } from "crypto";
import "../types/session";

const ALL_STAGE_VALUES = [
  "new", "contacted", "interested", "payment_pending", "payment_confirmed",
  "confirmed", "attended", "no_show", "completed", "archived",
] as const;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function parseStoragePath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const parts = path.split("/");
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

const router: IRouter = Router();

router.get("/students", requirePermission("view_students"), async (req, res): Promise<void> => {
  const rq = req.query as Record<string, string | undefined>;
  const conditions = [isNull(studentsTable.deletedAt)];

  const rawStage = rq.stage;
  if (rawStage && (ALL_STAGE_VALUES as readonly string[]).includes(rawStage)) {
    conditions.push(eq(studentsTable.stage, rawStage));
  }
  const rawTrainingType = rq.trainingType;
  if (rawTrainingType && ["physical", "online"].includes(rawTrainingType)) {
    conditions.push(eq(studentsTable.trainingType, rawTrainingType));
  }
  const rawGroupId = rq.groupId ? parseInt(rq.groupId, 10) : undefined;
  if (rawGroupId && !isNaN(rawGroupId)) {
    conditions.push(eq(studentsTable.groupId, rawGroupId));
  }
  const rawPaymentStatus = rq.paymentStatus;
  if (rawPaymentStatus && ["unpaid", "deposited", "paid"].includes(rawPaymentStatus)) {
    conditions.push(eq(studentsTable.paymentStatus, rawPaymentStatus));
  }
  if (rq.housingNeeded === "true" || rq.housingNeeded === "false") {
    conditions.push(eq(studentsTable.housingNeeded, rq.housingNeeded === "true"));
  }
  if (rq.city) {
    conditions.push(ilike(studentsTable.city, `%${rq.city}%`));
  }
  if (rq.search) {
    const term = `%${rq.search}%`;
    conditions.push(or(
      ilike(studentsTable.firstName, term),
      ilike(studentsTable.lastName, term),
      ilike(studentsTable.phone, term),
      ilike(studentsTable.city, term),
    )!);
  }
  if (rq.dateFrom) {
    try { conditions.push(gte(studentsTable.createdAt, new Date(rq.dateFrom))); } catch { /* ignore */ }
  }
  if (rq.dateTo) {
    try {
      const end = new Date(rq.dateTo);
      end.setDate(end.getDate() + 1);
      conditions.push(lt(studentsTable.createdAt, end));
    } catch { /* ignore */ }
  }

  const students = await db
    .select()
    .from(studentsTable)
    .where(and(...conditions))
    .orderBy(desc(studentsTable.createdAt));

  res.json(students);
});

router.post("/students", async (req, res): Promise<void> => {
  const parsed = CreateStudentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [student] = await db
    .insert(studentsTable)
    .values({ ...parsed.data, stage: "new" })
    .returning();

  await logActivity(
    "student_registered",
    `🎓 تسجيل جديد: ${student.firstName} ${student.lastName} — ${student.city}`,
    "Public Registration",
    student.id,
    { actionType: "student_registered", entityType: "student", entityId: student.id }
  );

  await createNotification(
    "new_registration",
    "🎓 تسجيل جديد!",
    `${student.firstName} ${student.lastName} من ${student.city} — ${student.phone}`,
    student.id
  ).catch(() => {});

  import("../lib/webPush").then(({ sendPushToAdmins }) =>
    sendPushToAdmins({
      title: "🎓 تسجيل جديد في GAB SCHOOL!",
      body:  `👤 الاسم: ${student.firstName} ${student.lastName}\n📞 الهاتف: ${student.phone}\n📍 ${student.city}`,
      url:   `/gab-c7x2p/students/${student.id}`,
      tag:   `new-reg-${student.id}`,
    }, 3)
  ).catch(() => {});

  const trainingLabel = student.trainingType === "physical" ? "حضوري" : "أونلاين";
  function toIntlPhone(phone: string): string {
    let clean = phone.replace(/\D/g, "");
    if (clean.startsWith("0") && clean.length === 10) clean = "213" + clean.slice(1);
    else if (clean.startsWith("5") && clean.length === 9) clean = "213" + clean;
    return clean;
  }
  const waNumber = toIntlPhone(student.whatsapp || student.phone);
  const waText = encodeURIComponent(`مرحباً ${student.firstName}، شكراً على تسجيلك في GAB SCHOOL! سنتواصل معك قريباً بخصوص تفاصيل الدورة.`);
  const waLink = `https://wa.me/${waNumber}?text=${waText}`;

  const telegramMsg = [
    `🎓 <b>طالب جديد سجّل في GAB SCHOOL!</b>`,
    ``,
    `👤 <b>الاسم:</b> ${student.firstName} ${student.lastName}`,
    `📞 <b>الهاتف:</b> ${student.phone}`,
    `💬 <b>الواتساب:</b> ${student.whatsapp}`,
    `📍 <b>الولاية:</b> ${student.city}`,
    `📚 <b>نوع الدورة:</b> ${trainingLabel}`,
    `🏠 <b>يحتاج إقامة:</b> ${student.housingNeeded ? "نعم" : "لا"}`,
    `📊 <b>مستوى الخبرة:</b> ${student.experienceLevel}`,
    student.note ? `📝 <b>ملاحظة:</b> ${student.note}` : "",
    ``,
    `📲 <a href="${waLink}">راسله مباشرة على واتساب</a>`,
  ].filter(Boolean).join("\n");

  sendTelegramNotification(telegramMsg).catch(() => {});

  res.status(201).json(student);
});

router.get("/students/stage-counts", requirePermission("view_students"), async (_req, res): Promise<void> => {
  const rows = await db
    .select({ stage: studentsTable.stage, cnt: sql<number>`count(*)::int` })
    .from(studentsTable)
    .where(isNull(studentsTable.deletedAt))
    .groupBy(studentsTable.stage);

  const result: Record<string, number> = { _total: 0 };
  for (const row of rows) {
    result[row.stage] = row.cnt;
    result["_total"] = (result["_total"] ?? 0) + row.cnt;
  }
  res.json(result);
});

router.patch("/students/bulk/stage", requirePermission("edit_students"), async (req, res): Promise<void> => {
  const ids: unknown = req.body?.ids;
  const stage: unknown = req.body?.stage;
  if (!Array.isArray(ids) || ids.length === 0 || typeof stage !== "string" || !(ALL_STAGE_VALUES as readonly string[]).includes(stage)) {
    res.status(400).json({ error: "Invalid ids or stage" });
    return;
  }
  const numIds = ids.map(Number).filter(n => !isNaN(n) && n > 0);
  if (numIds.length === 0) { res.status(400).json({ error: "No valid ids" }); return; }

  const { inArray } = await import("drizzle-orm");
  const updated = await db
    .update(studentsTable)
    .set({ stage })
    .where(and(inArray(studentsTable.id, numIds), isNull(studentsTable.deletedAt)))
    .returning({ id: studentsTable.id });

  const performer = req.session.fullName ?? "Unknown";
  await logActivity(
    "stage_changed",
    `🔄 تغيير مرحلة جماعي → ${stage} (${updated.length} طالب)`,
    performer,
    null,
    {
      employeeId: req.session.staffId,
      actionType: "bulk_stage_changed",
      entityType: "student",
      newValue: stage,
      sessionId: req.session.sessionToken,
      metadata: { count: updated.length, ids: numIds },
    }
  ).catch(() => {});

  res.json({ updated: updated.length });
});

router.get("/students/:id", requirePermission("view_students"), async (req, res): Promise<void> => {
  const params = GetStudentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, params.data.id));

  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  await logActivity(
    "student_viewed",
    `${student.firstName} ${student.lastName} — فتح ملف الطالب`,
    req.session.fullName ?? null,
    student.id,
    {
      employeeId: req.session.staffId,
      actionType: "student_viewed",
      entityType: "student",
      entityId: student.id,
      sessionId: req.session.sessionToken,
    }
  ).catch(() => {});

  res.json(student);
});

router.patch("/students/:id", requirePermission("edit_students"), async (req, res): Promise<void> => {
  const params = UpdateStudentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateStudentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [before] = await db.select().from(studentsTable).where(eq(studentsTable.id, params.data.id));
  const [student] = await db
    .update(studentsTable)
    .set(parsed.data)
    .where(eq(studentsTable.id, params.data.id))
    .returning();

  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  const performer = req.session.fullName ?? "Unknown";
  await logActivity(
    "student_updated",
    `✏️ تحديث بيانات: ${student.firstName} ${student.lastName}`,
    performer,
    student.id,
    {
      employeeId: req.session.staffId,
      actionType: "student_updated",
      entityType: "student",
      entityId: student.id,
      oldValue: before ? JSON.stringify({ stage: before.stage, paymentStatus: before.paymentStatus }) : null,
      newValue: JSON.stringify({ stage: student.stage, paymentStatus: student.paymentStatus }),
      sessionId: req.session.sessionToken,
    }
  );

  res.json(student);
});

router.delete("/students/:id", requirePermission("delete_students"), async (req, res): Promise<void> => {
  const params = DeleteStudentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [student] = await db
    .update(studentsTable)
    .set({ deletedAt: new Date() })
    .where(and(eq(studentsTable.id, params.data.id), isNull(studentsTable.deletedAt)))
    .returning();

  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  const performer = req.session.fullName ?? "Unknown";
  await logActivity(
    "student_deleted",
    `🗑️ أرشفة: ${student.firstName} ${student.lastName}`,
    performer,
    student.id,
    {
      employeeId: req.session.staffId,
      actionType: "student_deleted",
      entityType: "student",
      entityId: student.id,
      sessionId: req.session.sessionToken,
    }
  );

  res.sendStatus(204);
});

router.patch("/students/:id/stage", requirePermission("edit_students"), async (req, res): Promise<void> => {
  const params = UpdateStudentStageParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const stageVal = typeof req.body?.stage === "string" ? req.body.stage : "";
  if (!(ALL_STAGE_VALUES as readonly string[]).includes(stageVal)) {
    res.status(400).json({ error: "Invalid stage value" });
    return;
  }

  const [oldStudent] = await db.select().from(studentsTable).where(eq(studentsTable.id, params.data.id));
  if (!oldStudent) { res.status(404).json({ error: "Student not found" }); return; }

  const [student] = await db
    .update(studentsTable)
    .set({ stage: stageVal })
    .where(eq(studentsTable.id, params.data.id))
    .returning();

  const performer = req.session.fullName ?? "Unknown";
  await logActivity(
    "stage_changed",
    `🔄 ${student.firstName} ${student.lastName}: ${oldStudent.stage} → ${stageVal}`,
    performer,
    student.id,
    {
      employeeId: req.session.staffId,
      actionType: "stage_changed",
      entityType: "student",
      entityId: student.id,
      oldValue: oldStudent.stage,
      newValue: stageVal,
      sessionId: req.session.sessionToken,
    }
  );

  res.json(student);
});

router.patch("/students/:id/group", requirePermission("assign_students"), async (req, res): Promise<void> => {
  const params = AssignStudentToGroupParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = AssignStudentToGroupBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  if (parsed.data.groupId !== null && parsed.data.groupId !== undefined) {
    const [group] = await db.select({ id: groupsTable.id }).from(groupsTable).where(eq(groupsTable.id, parsed.data.groupId));
    if (!group) { res.status(404).json({ error: "Group not found" }); return; }
  }

  const [student] = await db
    .update(studentsTable)
    .set({ groupId: parsed.data.groupId })
    .where(eq(studentsTable.id, params.data.id))
    .returning();

  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  const performer = req.session.fullName ?? "Unknown";
  await logActivity(
    "group_assigned",
    `👥 ${student.firstName} ${student.lastName} → مجموعة ${parsed.data.groupId ?? "بدون"}`,
    performer,
    student.id,
    {
      employeeId: req.session.staffId,
      actionType: "group_assigned",
      entityType: "student",
      entityId: student.id,
      newValue: String(parsed.data.groupId ?? "null"),
      sessionId: req.session.sessionToken,
    }
  );

  res.json(student);
});

router.post("/students/:id/receipt", requirePermission("manage_payments"), upload.single("receipt"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }

  const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!privateDir) { res.status(500).json({ error: "Storage not configured" }); return; }

  const [existing] = await db.select({ id: studentsTable.id }).from(studentsTable).where(eq(studentsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Student not found" }); return; }

  try {
    const objectId = randomUUID();
    const fullGcsPath = `${privateDir}/uploads/${objectId}`;
    const { bucketName, objectName } = parseStoragePath(fullGcsPath);

    await objectStorageClient.bucket(bucketName).file(objectName).save(req.file.buffer, {
      contentType: req.file.mimetype,
      resumable: false,
    });

    const serveUrl = `/api/storage/receipts/${objectId}`;
    await db.update(studentsTable).set({ receiptUrl: serveUrl }).where(eq(studentsTable.id, id));

    res.json({ receiptUrl: serveUrl });
  } catch (error) {
    console.error("Receipt upload error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});

router.get("/stats", requirePermission("view_dashboard"), async (_req, res): Promise<void> => {
  const students = (await db.select().from(studentsTable)).filter((s) => !s.deletedAt);
  const stats = {
    totalStudents: students.length,
    newStudents: students.filter((s) => s.stage === "new").length,
    contactedStudents: students.filter((s) => s.stage === "contacted").length,
    interestedStudents: students.filter((s) => s.stage === "interested").length,
    noShowStudents: students.filter((s) => s.stage === "no_show").length,
    archivedStudents: students.filter((s) => s.stage === "archived").length,
    totalGroups: 0,
    openGroups: 0,
  };
  const { groupsTable: gt } = await import("@workspace/db");
  const groups = (await db.select().from(gt)).filter((g) => !g.deletedAt);
  stats.totalGroups = groups.length;
  stats.openGroups = groups.filter((g) => g.status === "open").length;
  res.json(GetDashboardStatsResponse.parse(stats));
});

router.get("/stats/erp", requirePermission("view_dashboard"), async (_req, res): Promise<void> => {
  const all = await db.select().from(studentsTable);
  const students = all.filter((s) => !s.deletedAt);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayRegistrations = students.filter((s) => new Date(s.createdAt) >= startOfDay).length;
  const monthRegistrations = students.filter((s) => new Date(s.createdAt) >= startOfMonth).length;
  const isStage = (s: typeof students[number], ...stages: string[]) => stages.includes(s.stage);
  const notContacted = students.filter((s) => isStage(s, "new")).length;
  const waitingPayment = students.filter((s) => isStage(s, "payment_pending", "interested")).length;
  const confirmed = students.filter((s) => isStage(s, "payment_confirmed")).length;
  const inTraining = students.filter((s) => isStage(s, "assigned", "in_training")).length;
  const completed = students.filter((s) => isStage(s, "completed")).length;
  const archived = students.filter((s) => isStage(s, "archived")).length;
  const paidCount = students.filter((s) => s.paymentStatus === "paid").length;
  const conversionRate = students.length > 0 ? Math.round((paidCount / students.length) * 100) : 0;
  res.json({ todayRegistrations, monthRegistrations, notContacted, waitingPayment, confirmed, inTraining, completed, archived, totalStudents: students.length, conversionRate });
});

export default router;
