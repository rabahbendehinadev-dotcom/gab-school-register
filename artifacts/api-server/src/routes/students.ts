import { Router, type IRouter } from "express";
import { eq, ilike, or, and, sql, desc } from "drizzle-orm";
import { db, studentsTable, groupsTable } from "@workspace/db";
import {
  CreateStudentBody,
  ListStudentsQueryParams,
  ListStudentsResponse,
  GetStudentParams,
  GetStudentResponse,
  UpdateStudentParams,
  UpdateStudentBody,
  UpdateStudentResponse,
  DeleteStudentParams,
  UpdateStudentStageParams,
  UpdateStudentStageBody,
  UpdateStudentStageResponse,
  AssignStudentToGroupParams,
  AssignStudentToGroupBody,
  AssignStudentToGroupResponse,
  GetDashboardStatsResponse,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";
import { logActivity } from "../lib/activityLogger";
import { sendTelegramNotification } from "../lib/telegram";
import { objectStorageClient } from "../lib/objectStorage";
import multer from "multer";
import { randomUUID } from "crypto";
import "../types/session";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function parseStoragePath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const parts = path.split("/");
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

const router: IRouter = Router();

router.get("/students", requireRole("admin", "manager", "staff", "assistant"), async (req, res): Promise<void> => {
  const query = ListStudentsQueryParams.safeParse(req.query);
  const conditions = [];

  if (query.success) {
    if (query.data.stage) {
      conditions.push(eq(studentsTable.stage, query.data.stage));
    }
    if (query.data.trainingType) {
      conditions.push(eq(studentsTable.trainingType, query.data.trainingType));
    }
    if (query.data.groupId) {
      conditions.push(eq(studentsTable.groupId, query.data.groupId));
    }
    if (query.data.paymentStatus) {
      conditions.push(eq(studentsTable.paymentStatus, query.data.paymentStatus));
    }
    if (query.data.housingNeeded !== undefined) {
      conditions.push(eq(studentsTable.housingNeeded, query.data.housingNeeded === "true"));
    }
    if (query.data.search) {
      const term = `%${query.data.search}%`;
      conditions.push(
        or(
          ilike(studentsTable.firstName, term),
          ilike(studentsTable.lastName, term),
          ilike(studentsTable.phone, term),
          ilike(studentsTable.city, term)
        )!
      );
    }
  }

  const students = await db
    .select()
    .from(studentsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(studentsTable.createdAt));

  res.json(ListStudentsResponse.parse(students));
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
    `New student registered: ${student.firstName} ${student.lastName}`,
    "Public Registration"
  );

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

  res.status(201).json(GetStudentResponse.parse(student));
});

router.get("/students/:id", requireRole("admin", "manager", "staff", "assistant"), async (req, res): Promise<void> => {
  const params = GetStudentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, params.data.id));

  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  res.json(GetStudentResponse.parse(student));
});

router.patch("/students/:id", requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const params = UpdateStudentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateStudentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [student] = await db
    .update(studentsTable)
    .set(parsed.data)
    .where(eq(studentsTable.id, params.data.id))
    .returning();

  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  const performer = req.session.fullName ?? "Unknown";
  await logActivity(
    "student_updated",
    `Student updated: ${student.firstName} ${student.lastName}`,
    performer
  );

  res.json(UpdateStudentResponse.parse(student));
});

router.delete("/students/:id", requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const params = DeleteStudentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [student] = await db
    .delete(studentsTable)
    .where(eq(studentsTable.id, params.data.id))
    .returning();

  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  const performer = req.session.fullName ?? "Unknown";
  await logActivity(
    "student_deleted",
    `Student deleted: ${student.firstName} ${student.lastName}`,
    performer
  );

  res.sendStatus(204);
});

router.patch("/students/:id/stage", requireRole("admin", "manager", "staff", "assistant"), async (req, res): Promise<void> => {
  const params = UpdateStudentStageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateStudentStageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [oldStudent] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, params.data.id));

  if (!oldStudent) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  const [student] = await db
    .update(studentsTable)
    .set({ stage: parsed.data.stage })
    .where(eq(studentsTable.id, params.data.id))
    .returning();

  const performer = req.session.fullName ?? "Unknown";
  await logActivity(
    "stage_changed",
    `${student.firstName} ${student.lastName}: ${oldStudent.stage} → ${parsed.data.stage}`,
    performer
  );

  res.json(UpdateStudentStageResponse.parse(student));
});

router.patch("/students/:id/group", requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const params = AssignStudentToGroupParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AssignStudentToGroupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.groupId !== null && parsed.data.groupId !== undefined) {
    const [group] = await db.select({ id: groupsTable.id }).from(groupsTable).where(eq(groupsTable.id, parsed.data.groupId));
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }
  }

  const [student] = await db
    .update(studentsTable)
    .set({ groupId: parsed.data.groupId })
    .where(eq(studentsTable.id, params.data.id))
    .returning();

  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  const performer = req.session.fullName ?? "Unknown";
  await logActivity(
    "group_assigned",
    `${student.firstName} ${student.lastName} assigned to group ${parsed.data.groupId ?? "none"}`,
    performer
  );

  res.json(AssignStudentToGroupResponse.parse(student));
});

router.post("/students/:id/receipt", requireRole("admin", "manager"), upload.single("receipt"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (!req.file) {
    res.status(400).json({ error: "No file provided" });
    return;
  }

  const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!privateDir) {
    res.status(500).json({ error: "Storage not configured" });
    return;
  }

  try {
    const objectId = randomUUID();
    const fullGcsPath = `${privateDir}/uploads/${objectId}`;
    const { bucketName, objectName } = parseStoragePath(fullGcsPath);

    await objectStorageClient.bucket(bucketName).file(objectName).save(req.file.buffer, {
      contentType: req.file.mimetype,
      resumable: false,
    });

    const serveUrl = `/api/storage/objects/uploads/${objectId}`;

    const [student] = await db
      .update(studentsTable)
      .set({ receiptUrl: serveUrl })
      .where(eq(studentsTable.id, id))
      .returning();

    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    res.json({ receiptUrl: serveUrl });
  } catch (error) {
    console.error("Receipt upload error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});

router.get("/stats", requireRole("admin", "manager"), async (_req, res): Promise<void> => {
  const students = await db.select().from(studentsTable);
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

  const { groupsTable } = await import("@workspace/db");
  const groups = await db.select().from(groupsTable);
  stats.totalGroups = groups.length;
  stats.openGroups = groups.filter((g) => g.status === "open").length;

  res.json(GetDashboardStatsResponse.parse(stats));
});

export default router;
