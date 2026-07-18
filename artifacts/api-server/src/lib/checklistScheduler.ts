import { db, checklistAssignmentsTable, escalationLogTable, settingsTable, staffTable, notificationsTable } from "@workspace/db";
import { eq, and, lt, isNull, or, inArray, gte } from "drizzle-orm";
import { sendPushToAdmins } from "./webPush";

async function getSetting(key: string, defaultValue: string): Promise<string> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  return row?.value ?? defaultValue;
}

async function getSettingInt(key: string, defaultValue: number): Promise<number> {
  const v = await getSetting(key, String(defaultValue));
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? defaultValue : n;
}

async function ensureEscalationLevel(assignmentId: number, level: number): Promise<boolean> {
  const [existing] = await db
    .select({ id: escalationLogTable.id })
    .from(escalationLogTable)
    .where(and(eq(escalationLogTable.assignmentId, assignmentId), eq(escalationLogTable.level, level)));
  return !!existing;
}

async function logEscalation(assignmentId: number, level: number, note: string, notifiedStaffId?: number): Promise<void> {
  await db.insert(escalationLogTable).values({ assignmentId, level, note, notifiedStaffId: notifiedStaffId ?? null });
}

async function notifyStaff(staffId: number, title: string, message: string, type: string): Promise<void> {
  await db.insert(notificationsTable).values({ type, title, message, studentId: null });
}

export async function runChecklistEscalationTick(): Promise<void> {
  try {
    const now = new Date();

    const reminder2Min  = await getSettingInt("checklist_reminder2_min", 15);
    const importantMin  = await getSettingInt("checklist_important_min", 30);
    const overdueMin    = await getSettingInt("checklist_overdue_min", 60);
    const tlNotifyMin   = await getSettingInt("checklist_tl_notify_min", 90);
    const aiAlertMin    = await getSettingInt("checklist_ai_alert_min", 120);

    const activeStatuses = ["not_started", "in_progress", "overdue"];
    const active = await db
      .select({
        id: checklistAssignmentsTable.id,
        staffId: checklistAssignmentsTable.staffId,
        title: checklistAssignmentsTable.title,
        dueAt: checklistAssignmentsTable.dueAt,
        status: checklistAssignmentsTable.status,
        snoozeUntil: checklistAssignmentsTable.snoozeUntil,
      })
      .from(checklistAssignmentsTable)
      .where(
        and(
          inArray(checklistAssignmentsTable.status, activeStatuses),
          lt(checklistAssignmentsTable.dueAt, now),
          isNull(checklistAssignmentsTable.completedAt),
          isNull(checklistAssignmentsTable.cancelledAt),
        )
      );

    for (const a of active) {
      const snoozeActive = a.snoozeUntil && new Date(a.snoozeUntil) > now;
      const minutesLate = (now.getTime() - new Date(a.dueAt).getTime()) / 60000;

      if (!snoozeActive) {
        // Level 1 — initial notification (already sent at generation; just record if not done)
        if (!(await ensureEscalationLevel(a.id, 1))) {
          await notifyStaff(a.staffId, `📋 مهمة جديدة: ${a.title}`, `المهمة مستحقة الآن`, "checklist_due");
          await logEscalation(a.id, 1, "إشعار أولي عند الاستحقاق", a.staffId);
        }

        // Level 2 — reminder after reminder2Min
        if (minutesLate >= reminder2Min && !(await ensureEscalationLevel(a.id, 2))) {
          await notifyStaff(a.staffId, `🔔 تذكير: ${a.title}`, `مهمة لم تُنجز منذ ${Math.round(minutesLate)} دقيقة`, "checklist_reminder");
          await logEscalation(a.id, 2, `تذكير ثانٍ بعد ${reminder2Min} دقيقة`, a.staffId);
        }

        // Level 3 — important after importantMin
        if (minutesLate >= importantMin && !(await ensureEscalationLevel(a.id, 3))) {
          await notifyStaff(a.staffId, `⚠️ مهمة عاجلة: ${a.title}`, `تأخر ${Math.round(minutesLate)} دقيقة — مهمة لم تُنجز`, "checklist_urgent");
          await logEscalation(a.id, 3, `إشعار مهم بعد ${importantMin} دقيقة`, a.staffId);
        }

        // Level 4 — mark overdue + TL notify
        if (minutesLate >= overdueMin) {
          if (a.status !== "overdue") {
            await db.update(checklistAssignmentsTable).set({ status: "overdue" }).where(eq(checklistAssignmentsTable.id, a.id));
          }
          if (!(await ensureEscalationLevel(a.id, 4))) {
            const tlStaff = await db
              .select({ id: staffTable.id, fullName: staffTable.fullName })
              .from(staffTable)
              .where(or(eq(staffTable.role, "team_leader"), eq(staffTable.role, "admin")));
            for (const tl of tlStaff) {
              await notifyStaff(tl.id, `🔴 مهمة متأخرة: ${a.title}`, `الموظف لم ينجز المهمة منذ ${Math.round(minutesLate)} دقيقة`, "checklist_overdue_tl");
            }
            await logEscalation(a.id, 4, `مهمة متأخرة — تم إشعار المشرفين`, a.staffId);
          }
        }

        // Level 5 — TL escalation at tlNotifyMin
        if (minutesLate >= tlNotifyMin && !(await ensureEscalationLevel(a.id, 5))) {
          await notifyStaff(a.staffId, `🚨 تصعيد: ${a.title}`, `مهمة بالغة التأخر — ${Math.round(minutesLate)} دقيقة`, "checklist_escalation_tl");
          await logEscalation(a.id, 5, `تصعيد لمشرف الفريق`, a.staffId);
        }

        // Level 6 — AI/Owner alert at aiAlertMin
        if (minutesLate >= aiAlertMin && !(await ensureEscalationLevel(a.id, 6))) {
          await sendPushToAdmins({
            title: `🚨 تنبيه تحكم AI: مهمة متأخرة جداً`,
            body: `${a.title} — تأخر ${Math.round(minutesLate)} دقيقة بدون إنجاز`,
            tag: `checklist-ai-alert-${a.id}`,
          }, 2).catch(() => {});
          await logEscalation(a.id, 6, `تنبيه AI Control أُرسل للمالك`, a.staffId);
        }
      }
    }
  } catch (err) {
    console.error("[checklistScheduler] tick error:", err);
  }
}

/** Generate assignments for a given staff member today (idempotent via dateKey). */
export async function generateDailyAssignments(staffId: number, staffRole: string): Promise<void> {
  try {
    const { checklistTemplatesTable, checklistItemsTable } = await import("@workspace/db");
    const { eq: eqT, and: andT, or: orT } = await import("drizzle-orm");

    const today = new Date();
    const dateKey = today.toISOString().slice(0, 10);
    const dayOfWeek = today.getDay();

    const templates = await db
      .select()
      .from(checklistTemplatesTable)
      .where(andT(eq(checklistTemplatesTable.enabled, true)));

    for (const tmpl of templates) {
      const days: number[] = (tmpl.daysOfWeek as number[]) ?? [0,1,2,3,4,5,6];
      if (!days.includes(dayOfWeek)) continue;

      const roleMatch = !tmpl.assignedToRole || tmpl.assignedToRole === staffRole;
      const staffMatch = !tmpl.assignedToStaffId || tmpl.assignedToStaffId === staffId;
      if (!roleMatch && !staffMatch) continue;
      if (tmpl.assignedToStaffId && tmpl.assignedToStaffId !== staffId) continue;

      const items = await db
        .select()
        .from(checklistItemsTable)
        .where(eq(checklistItemsTable.templateId, tmpl.id));

      for (const item of items) {
        const dueAt = new Date(today);
        dueAt.setHours(9, 0, 0, 0);
        dueAt.setMinutes(dueAt.getMinutes() + item.offsetMinutes);

        const existKey = `${staffId}-${item.id}-${dateKey}`;
        const [existing] = await db
          .select({ id: checklistAssignmentsTable.id })
          .from(checklistAssignmentsTable)
          .where(andT(
            eq(checklistAssignmentsTable.staffId, staffId),
            eq(checklistAssignmentsTable.itemId, item.id),
            eq(checklistAssignmentsTable.dateKey, dateKey),
          ));
        if (existing) continue;

        await db.insert(checklistAssignmentsTable).values({
          templateId: tmpl.id,
          itemId: item.id,
          title: item.title,
          description: item.description,
          priority: item.priority,
          proofRequired: item.proofRequired,
          noteRequired: item.noteRequired,
          staffId,
          dueAt,
          status: "not_started",
          dateKey,
        });
      }
    }
  } catch (err) {
    console.error("[generateDailyAssignments] error:", err);
  }
}

export function startChecklistScheduler(): void {
  setInterval(() => {
    runChecklistEscalationTick().catch(() => {});
  }, 60 * 1000);
  console.log("Checklist escalation scheduler started (60s interval)");
}
