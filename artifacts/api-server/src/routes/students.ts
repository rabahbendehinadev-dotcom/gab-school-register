import { Router, type IRouter } from "express";
import { eq, ilike, or, and, sql, desc } from "drizzle-orm";
import { db, studentsTable } from "@workspace/db";
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
import "../types/session";

const router: IRouter = Router();

router.get("/students", requireAuth, async (req, res): Promise<void> => {
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

  res.status(201).json(GetStudentResponse.parse(student));
});

router.get("/students/:id", requireAuth, async (req, res): Promise<void> => {
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

router.patch("/students/:id/stage", requireRole("admin", "manager", "staff"), async (req, res): Promise<void> => {
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

router.get("/stats", requireAuth, async (_req, res): Promise<void> => {
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
