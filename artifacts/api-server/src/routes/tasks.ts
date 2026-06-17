import { Router, type IRouter } from "express";
import { eq, desc, and, isNull } from "drizzle-orm";
import { db, followupTasksTable, studentsTable, staffTable } from "@workspace/db";
import { z } from "zod/v4";
import { requireRole } from "../middlewares/auth";
import { logActivity } from "../lib/activityLogger";
import { createNotification } from "../lib/notifications";
import "../types/session";

const router: IRouter = Router();

const CreateTaskBody = z.object({
  studentId: z.coerce.number().int().optional().nullable(),
  type: z.enum(["call", "whatsapp", "payment", "group", "site", "other"]).default("call"),
  title: z.string().min(1),
  dueAt: z.coerce.date().optional().nullable(),
  assignedTo: z.coerce.number().int().optional().nullable(),
});

const UpdateTaskBody = z.object({
  completed: z.boolean().optional(),
  title: z.string().min(1).optional(),
  dueAt: z.coerce.date().optional().nullable(),
  assignedTo: z.coerce.number().int().optional().nullable(),
  type: z.enum(["call", "whatsapp", "payment", "group", "site", "other"]).optional(),
});

// List tasks with optional filters
router.get("/tasks", requireRole("admin", "manager", "staff", "assistant"), async (req, res): Promise<void> => {
  const conditions = [];
  if (req.query.completed === "true") conditions.push(eq(followupTasksTable.completed, true));
  if (req.query.completed === "false") conditions.push(eq(followupTasksTable.completed, false));
  if (req.query.assignedTo) conditions.push(eq(followupTasksTable.assignedTo, parseInt(String(req.query.assignedTo), 10)));
  if (req.query.studentId) conditions.push(eq(followupTasksTable.studentId, parseInt(String(req.query.studentId), 10)));

  const tasks = await db
    .select({
      id: followupTasksTable.id,
      studentId: followupTasksTable.studentId,
      type: followupTasksTable.type,
      title: followupTasksTable.title,
      dueAt: followupTasksTable.dueAt,
      assignedTo: followupTasksTable.assignedTo,
      completed: followupTasksTable.completed,
      completedAt: followupTasksTable.completedAt,
      createdBy: followupTasksTable.createdBy,
      createdAt: followupTasksTable.createdAt,
      studentFirstName: studentsTable.firstName,
      studentLastName: studentsTable.lastName,
      studentPhone: studentsTable.phone,
      assigneeName: staffTable.fullName,
    })
    .from(followupTasksTable)
    .leftJoin(studentsTable, eq(followupTasksTable.studentId, studentsTable.id))
    .leftJoin(staffTable, eq(followupTasksTable.assignedTo, staffTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(followupTasksTable.createdAt));

  res.json(tasks);
});

// Create task
router.post("/tasks", requireRole("admin", "manager", "staff", "assistant"), async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const performer = req.session.fullName ?? "Unknown";
  const [task] = await db.insert(followupTasksTable).values({
    studentId: parsed.data.studentId ?? null,
    type: parsed.data.type,
    title: parsed.data.title,
    dueAt: parsed.data.dueAt ?? null,
    assignedTo: parsed.data.assignedTo ?? null,
    createdBy: performer,
  }).returning();

  await logActivity("task_created", `📋 مهمة جديدة: ${task.title}`, performer, task.studentId);

  res.status(201).json(task);
});

// Update / complete task
router.patch("/tasks/:id", requireRole("admin", "manager", "staff", "assistant"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.dueAt !== undefined) updates.dueAt = parsed.data.dueAt;
  if (parsed.data.assignedTo !== undefined) updates.assignedTo = parsed.data.assignedTo;
  if (parsed.data.type !== undefined) updates.type = parsed.data.type;
  if (parsed.data.completed !== undefined) {
    updates.completed = parsed.data.completed;
    updates.completedAt = parsed.data.completed ? new Date() : null;
  }

  const [task] = await db.update(followupTasksTable).set(updates).where(eq(followupTasksTable.id, id)).returning();
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }

  const performer = req.session.fullName ?? "Unknown";
  if (parsed.data.completed === true) {
    await logActivity("task_completed", `✅ مهمة مكتملة: ${task.title}`, performer, task.studentId);
  }

  res.json(task);
});

// Delete task
router.delete("/tasks/:id", requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(followupTasksTable).where(eq(followupTasksTable.id, id));
  res.sendStatus(204);
});

export default router;
