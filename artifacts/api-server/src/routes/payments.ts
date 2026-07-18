import { Router, type IRouter } from "express";
import { eq, desc, sql, gte, isNull } from "drizzle-orm";
import { db, paymentsTable, studentsTable, groupsTable } from "@workspace/db";
import { z } from "zod/v4";
import { requirePermission } from "../middlewares/auth";
import { logActivity } from "../lib/activityLogger";
import "../types/session";

const router: IRouter = Router();

const CreatePaymentBody = z.object({
  amount: z.coerce.number().int().positive(),
  method: z.enum(["cash", "ccp", "baridimob", "bank", "other"]).default("cash"),
  type: z.enum(["deposit", "installment", "full"]).default("installment"),
  note: z.string().optional().nullable(),
});

router.get("/students/:id/payments", requirePermission("view_payments"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.studentId, id)).orderBy(desc(paymentsTable.createdAt));
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  let agreedPrice = student?.agreedPrice ?? null;
  if (agreedPrice === null && student?.groupId) {
    const [group] = await db.select({ price: groupsTable.price }).from(groupsTable).where(eq(groupsTable.id, student.groupId));
    agreedPrice = group?.price ?? null;
  }
  const remaining = agreedPrice !== null ? Math.max(0, agreedPrice - totalPaid) : null;
  res.json({ payments, totalPaid, agreedPrice, remaining });
});

router.post("/students/:id/payments", requirePermission("manage_payments"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = CreatePaymentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }
  const performer = req.session.fullName ?? "Unknown";

  const [payment] = await db.insert(paymentsTable).values({
    studentId: id,
    amount: parsed.data.amount,
    method: parsed.data.method,
    type: parsed.data.type,
    note: parsed.data.note ?? null,
    recordedBy: performer,
  }).returning();

  const allPayments = await db.select().from(paymentsTable).where(eq(paymentsTable.studentId, id));
  const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);
  let agreedPrice = student.agreedPrice ?? null;
  if (agreedPrice === null && student.groupId) {
    const [group] = await db.select({ price: groupsTable.price }).from(groupsTable).where(eq(groupsTable.id, student.groupId));
    agreedPrice = group?.price ?? null;
  }
  let paymentStatus = student.paymentStatus;
  if (agreedPrice !== null && totalPaid >= agreedPrice) paymentStatus = "paid";
  else if (totalPaid > 0) paymentStatus = "deposited";
  await db.update(studentsTable).set({ paymentStatus, depositPaid: totalPaid > 0 }).where(eq(studentsTable.id, id));

  await logActivity("payment_recorded", `💰 ${parsed.data.amount} دج (${parsed.data.type}) — ${student.firstName} ${student.lastName}`, performer, id, {
    employeeId: req.session.staffId,
    actionType: "payment_recorded",
    entityType: "student",
    entityId: id,
    newValue: JSON.stringify({ amount: parsed.data.amount, method: parsed.data.method, type: parsed.data.type }),
    sessionId: req.session.sessionToken,
  });

  res.status(201).json(payment);
});

router.delete("/payments/:id", requirePermission("manage_payments"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [payment] = await db.delete(paymentsTable).where(eq(paymentsTable.id, id)).returning();
  if (!payment) { res.status(404).json({ error: "Payment not found" }); return; }
  const performer = req.session.fullName ?? "Unknown";
  await logActivity("payment_deleted", `🗑️ حذف دفعة ${payment.amount} دج`, performer, payment.studentId, {
    employeeId: req.session.staffId,
    actionType: "payment_deleted",
    entityType: "payment",
    entityId: id,
    oldValue: String(payment.amount),
    sessionId: req.session.sessionToken,
  });
  res.sendStatus(204);
});

router.get("/stats/financials", requirePermission("view_dashboard"), async (_req, res): Promise<void> => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [todayRow] = await db.select({ total: sql<number>`COALESCE(SUM(${paymentsTable.amount}), 0)` }).from(paymentsTable).where(gte(paymentsTable.createdAt, startOfDay));
  const [monthRow] = await db.select({ total: sql<number>`COALESCE(SUM(${paymentsTable.amount}), 0)` }).from(paymentsTable).where(gte(paymentsTable.createdAt, startOfMonth));
  const [allRow] = await db.select({ total: sql<number>`COALESCE(SUM(${paymentsTable.amount}), 0)` }).from(paymentsTable);
  const students = await db.select().from(studentsTable).where(isNull(studentsTable.deletedAt));
  const allPayments = await db.select().from(paymentsTable);
  const paidByStudent = new Map<number, number>();
  for (const p of allPayments) paidByStudent.set(p.studentId, (paidByStudent.get(p.studentId) ?? 0) + p.amount);
  const groups = await db.select().from(groupsTable);
  const groupPrice = new Map<number, number | null>();
  for (const g of groups) groupPrice.set(g.id, g.price);
  let outstanding = 0;
  for (const s of students) {
    if (s.stage === "archived") continue;
    let price = s.agreedPrice;
    if (price === null && s.groupId) price = groupPrice.get(s.groupId) ?? null;
    if (price === null || price === undefined) continue;
    const paid = paidByStudent.get(s.id) ?? 0;
    const rem = price - paid;
    if (rem > 0) outstanding += rem;
  }
  res.json({ todayRevenue: Number(todayRow.total), monthRevenue: Number(monthRow.total), totalRevenue: Number(allRow.total), outstanding });
});

export default router;
