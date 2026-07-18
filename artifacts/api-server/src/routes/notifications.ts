import { Router, type IRouter } from "express";
import { eq, desc, and, isNull, lt, sql, or } from "drizzle-orm";
import { db, notificationsTable, studentsTable } from "@workspace/db";
import { requirePermission } from "../middlewares/auth";
import { createNotification } from "../lib/notifications";
import "../types/session";

const router: IRouter = Router();

async function generateDerivedNotifications(): Promise<void> {
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const waiting = await db.select().from(studentsTable).where(
    and(isNull(studentsTable.deletedAt), sql`${studentsTable.stage} IN ('payment_pending','interested')`, lt(studentsTable.createdAt, threeDaysAgo))
  );
  for (const s of waiting) {
    const [existing] = await db.select({ id: notificationsTable.id }).from(notificationsTable).where(
      and(eq(notificationsTable.studentId, s.id), eq(notificationsTable.type, "waiting_payment"), eq(notificationsTable.handled, false))
    );
    if (!existing) {
      await createNotification("waiting_payment", "⏳ طالب بانتظار الدفع", `${s.firstName} ${s.lastName} لم يدفع منذ أكثر من 3 أيام`, s.id);
    }
  }
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const notContacted = await db.select().from(studentsTable).where(
    and(isNull(studentsTable.deletedAt), eq(studentsTable.stage, "new"), lt(studentsTable.createdAt, oneDayAgo))
  );
  for (const s of notContacted) {
    const [existing] = await db.select({ id: notificationsTable.id }).from(notificationsTable).where(
      and(eq(notificationsTable.studentId, s.id), eq(notificationsTable.type, "not_contacted"), eq(notificationsTable.handled, false))
    );
    if (!existing) {
      await createNotification("not_contacted", "📞 طالب لم يتم الاتصال به", `${s.firstName} ${s.lastName} مسجّل منذ أكثر من يوم ولم يتم الاتصال به`, s.id);
    }
  }
}

function isSupervisor(perms: string[]): boolean {
  // Only manage_staff (admin / team_leader) grants supervisor-level
  // notification visibility. manage_tasks is held by regular staff and
  // must NOT confer cross-user read access.
  return perms.includes("manage_staff");
}

router.get("/notifications", requirePermission("view_dashboard"), async (req, res): Promise<void> => {
  try { await generateDerivedNotifications(); } catch (e) { console.error("generateDerivedNotifications failed:", e); }

  const perms: string[] = req.session.permissions ?? [];
  const staffId = req.session.staffId!;
  const supervisor = isSupervisor(perms);

  // Supervisors see all; regular staff see only their own checklist notifications + global (non-recipient-scoped) ones
  const filter = supervisor
    ? undefined
    : or(
        isNull(notificationsTable.recipientStaffId),
        eq(notificationsTable.recipientStaffId, staffId),
      );

  const query = db
    .select({ id: notificationsTable.id, type: notificationsTable.type, title: notificationsTable.title, message: notificationsTable.message, studentId: notificationsTable.studentId, recipientStaffId: notificationsTable.recipientStaffId, handled: notificationsTable.handled, handledAt: notificationsTable.handledAt, createdAt: notificationsTable.createdAt })
    .from(notificationsTable)
    .orderBy(desc(notificationsTable.createdAt))
    .limit(100);

  const notifications = filter ? await query.where(filter) : await query;
  const unhandledCount = notifications.filter((n) => !n.handled).length;
  res.json({ notifications, unhandledCount });
});

router.patch("/notifications/:id/handle", requirePermission("view_dashboard"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const perms: string[] = req.session.permissions ?? [];
  const staffId = req.session.staffId!;
  const supervisor = isSupervisor(perms);

  // Verify the caller can handle this notification (must be recipient or supervisor)
  const [existing] = await db.select({ recipientStaffId: notificationsTable.recipientStaffId })
    .from(notificationsTable).where(eq(notificationsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Notification not found" }); return; }
  if (!supervisor && existing.recipientStaffId !== null && existing.recipientStaffId !== staffId) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }

  const performer = req.session.fullName ?? "Unknown";
  const [n] = await db.update(notificationsTable).set({ handled: true, handledAt: new Date(), handledBy: performer }).where(eq(notificationsTable.id, id)).returning();
  res.json(n);
});

router.post("/notifications/handle-all", requirePermission("view_dashboard"), async (req, res): Promise<void> => {
  const perms: string[] = req.session.permissions ?? [];
  const staffId = req.session.staffId!;
  const supervisor = isSupervisor(perms);
  const performer = req.session.fullName ?? "Unknown";

  if (supervisor) {
    await db.update(notificationsTable).set({ handled: true, handledAt: new Date(), handledBy: performer }).where(eq(notificationsTable.handled, false));
  } else {
    // Staff can only handle-all for notifications visible to them
    await db.update(notificationsTable)
      .set({ handled: true, handledAt: new Date(), handledBy: performer })
      .where(and(
        eq(notificationsTable.handled, false),
        or(isNull(notificationsTable.recipientStaffId), eq(notificationsTable.recipientStaffId, staffId)),
      ));
  }
  res.json({ ok: true });
});

export default router;
