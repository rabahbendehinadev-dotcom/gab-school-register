import { db, checklistAssignmentsTable, escalationLogTable, settingsTable, staffTable, notificationsTable } from "@workspace/db";
import { eq, and, lt, isNull, inArray, or, desc } from "drizzle-orm";
import { sendPushToAdmins, sendPushToStaff } from "./webPush";

async function getSetting(key: string, defaultValue: string): Promise<string> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  return row?.value ?? defaultValue;
}

async function getSettingInt(key: string, defaultValue: number): Promise<number> {
  const v = await getSetting(key, String(defaultValue));
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? defaultValue : n;
}

/**
 * Returns the most recent notifiedAt timestamp for a given assignment+level,
 * or null if this level has never fired.
 */
async function getLastEscalationFireTime(assignmentId: number, level: number): Promise<Date | null> {
  const [row] = await db
    .select({ notifiedAt: escalationLogTable.notifiedAt })
    .from(escalationLogTable)
    .where(and(eq(escalationLogTable.assignmentId, assignmentId), eq(escalationLogTable.level, level)))
    .orderBy(desc(escalationLogTable.notifiedAt))
    .limit(1);
  return row?.notifiedAt ?? null;
}

async function logEscalation(assignmentId: number, level: number, note: string, notifiedStaffId?: number): Promise<void> {
  await db.insert(escalationLogTable).values({ assignmentId, level, note, notifiedStaffId: notifiedStaffId ?? null });
}

/** Insert an in-app notification scoped to a specific staff member. */
async function notifyStaff(recipientStaffId: number, title: string, message: string, type: string): Promise<void> {
  await db.insert(notificationsTable).values({ type, title, message, studentId: null, recipientStaffId });
}

/** Notify all TL + admin staff (in-app) about an escalated assignment. */
async function notifySupervisors(title: string, message: string, type: string): Promise<void> {
  const supervisors = await db
    .select({ id: staffTable.id })
    .from(staffTable)
    .where(or(eq(staffTable.role, "team_leader"), eq(staffTable.role, "admin")));
  await Promise.all(supervisors.map(s => notifyStaff(s.id, title, message, type)));
}

/** Returns true if the current time is within shift hours. */
async function isWithinShiftHours(now: Date): Promise<boolean> {
  const startHour = await getSettingInt("checklist_shift_start_hour", 9);
  const endHour   = await getSettingInt("checklist_shift_end_hour", 20);
  const h = now.getHours();
  return h >= startHour && h < endHour;
}

export async function runChecklistEscalationTick(): Promise<void> {
  try {
    const now = new Date();

    const reminder2Min     = await getSettingInt("checklist_reminder2_min",   15);
    const importantMin     = await getSettingInt("checklist_important_min",   30);
    const overdueMin       = await getSettingInt("checklist_overdue_min",     60);
    const tlNotifyMin      = await getSettingInt("checklist_tl_notify_min",   90);
    const aiAlertMin       = await getSettingInt("checklist_ai_alert_min",   120);
    const repeatIntervalMin = await getSettingInt("checklist_repeat_interval_min", 15);

    const withinShift = await isWithinShiftHours(now);

    const activeStatuses = ["not_started", "in_progress", "overdue"];
    const active = await db
      .select({
        id:          checklistAssignmentsTable.id,
        staffId:     checklistAssignmentsTable.staffId,
        title:       checklistAssignmentsTable.title,
        dueAt:       checklistAssignmentsTable.dueAt,
        status:      checklistAssignmentsTable.status,
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
      if (snoozeActive) continue;

      const minutesLate = (now.getTime() - new Date(a.dueAt).getTime()) / 60000;

      // ── Level 1: initial due reminder to assignee ──────────────────────────
      if (minutesLate < reminder2Min) {
        const lastFire = await getLastEscalationFireTime(a.id, 1);
        const shouldFire = !lastFire || (now.getTime() - lastFire.getTime()) / 60000 >= repeatIntervalMin;
        if (shouldFire && withinShift) {
          await notifyStaff(a.staffId, `📋 مهمة مستحقة: ${a.title}`, `المهمة مستحقة الآن`, "checklist_due");
          await sendPushToStaff(a.staffId, {
            title: `📋 مهمة مستحقة`,
            body: a.title,
            tag: `checklist-due-${a.id}`,
          }).catch(() => {});
          await logEscalation(a.id, 1, "إشعار أولي عند الاستحقاق", a.staffId);
        }
      }

      // ── Level 2: second reminder (repeatIntervalMin interval) ─────────────
      if (minutesLate >= reminder2Min && minutesLate < importantMin) {
        const lastFire = await getLastEscalationFireTime(a.id, 2);
        const shouldFire = !lastFire || (now.getTime() - lastFire.getTime()) / 60000 >= repeatIntervalMin;
        if (shouldFire && withinShift) {
          await notifyStaff(a.staffId, `🔔 تذكير: ${a.title}`, `مهمة لم تُنجز منذ ${Math.round(minutesLate)} دقيقة`, "checklist_reminder");
          await sendPushToStaff(a.staffId, {
            title: `🔔 تذكير بمهمة`,
            body: `${a.title} — منذ ${Math.round(minutesLate)} دقيقة`,
            tag: `checklist-reminder-${a.id}`,
          }).catch(() => {});
          await logEscalation(a.id, 2, `تذكير ثانٍ — ${Math.round(minutesLate)} دقيقة تأخر`, a.staffId);
        }
      }

      // ── Level 3: urgent reminder to assignee ──────────────────────────────
      if (minutesLate >= importantMin && minutesLate < overdueMin) {
        const lastFire = await getLastEscalationFireTime(a.id, 3);
        const shouldFire = !lastFire || (now.getTime() - lastFire.getTime()) / 60000 >= repeatIntervalMin;
        if (shouldFire && withinShift) {
          await notifyStaff(a.staffId, `⚠️ مهمة عاجلة: ${a.title}`, `تأخر ${Math.round(minutesLate)} دقيقة — لم تُنجز`, "checklist_urgent");
          await sendPushToStaff(a.staffId, {
            title: `⚠️ تنبيه عاجل`,
            body: `${a.title} — تأخر ${Math.round(minutesLate)} دقيقة`,
            tag: `checklist-urgent-${a.id}`,
          }).catch(() => {});
          await logEscalation(a.id, 3, `تحذير عاجل — ${Math.round(minutesLate)} دقيقة`, a.staffId);
        }
      }

      // ── Level 4: mark overdue + continue reminding assignee ──────────────
      if (minutesLate >= overdueMin) {
        // Mark overdue status (idempotent)
        if (a.status !== "overdue") {
          await db.update(checklistAssignmentsTable).set({ status: "overdue" }).where(eq(checklistAssignmentsTable.id, a.id));
          await logEscalation(a.id, 4, `تم تصنيف المهمة متأخرة`, a.staffId);
        }
        // Continue repeating reminders to the assignee at repeat_interval_min
        // until the task is completed/cancelled — even after overdue threshold
        if (minutesLate < tlNotifyMin) {
          const lastAssigneeReminder = await getLastEscalationFireTime(a.id, 4);
          const shouldRemind = !lastAssigneeReminder ||
            (now.getTime() - lastAssigneeReminder.getTime()) / 60000 >= repeatIntervalMin;
          if (shouldRemind && withinShift) {
            await notifyStaff(a.staffId,
              `🔴 مهمة متأخرة: ${a.title}`,
              `تأخر ${Math.round(minutesLate)} دقيقة — المهمة لم تُنجز`,
              "checklist_overdue"
            );
            await sendPushToStaff(a.staffId, {
              title: `🔴 مهمة متأخرة`,
              body: `${a.title} — تأخر ${Math.round(minutesLate)} دقيقة`,
              tag: `checklist-overdue-${a.id}`,
            }).catch(() => {});
            await logEscalation(a.id, 4, `تذكير متأخر للموظف — ${Math.round(minutesLate)} دقيقة`, a.staffId);
          }
        }
      }

      // ── Level 5: escalate to supervisors with push ────────────────────────
      if (minutesLate >= tlNotifyMin && minutesLate < aiAlertMin) {
        const lastFire = await getLastEscalationFireTime(a.id, 5);
        const shouldFire = !lastFire || (now.getTime() - lastFire.getTime()) / 60000 >= repeatIntervalMin;
        if (shouldFire) {
          await notifySupervisors(
            `🚨 تصعيد: ${a.title}`,
            `مهمة بالغة التأخر (${Math.round(minutesLate)} دقيقة) — يستوجب التدخل الفوري`,
            "checklist_escalation_tl"
          );
          await sendPushToAdmins({
            title: `🚨 تصعيد مهمة`,
            body: `${a.title} — تأخر ${Math.round(minutesLate)} دقيقة`,
            tag: `checklist-escalate-${a.id}`,
          }, 2).catch(() => {});
          await logEscalation(a.id, 5, `تصعيد لمشرفي الفريق والإدارة`, a.staffId);
        }
      }

      // ── Level 6: AI / owner alert (one-shot) ──────────────────────────────
      if (minutesLate >= aiAlertMin) {
        const lastFire = await getLastEscalationFireTime(a.id, 6);
        if (!lastFire) {
          const pushPayload = {
            title: `🚨 AI Control: مهمة متأخرة جداً`,
            body: `${a.title} — تأخر ${Math.round(minutesLate)} دقيقة بدون إنجاز`,
            tag: `checklist-ai-alert-${a.id}`,
          };
          // Try targeted owner push first; fall back to all admins
          const ownerStaffId = await getSettingInt("checklist_owner_staff_id", 0);
          if (ownerStaffId > 0) {
            await sendPushToStaff(ownerStaffId, pushPayload).catch(() => {});
            await notifyStaff(ownerStaffId, pushPayload.title, pushPayload.body, "checklist_ai_alert");
          } else {
            await sendPushToAdmins(pushPayload, 3).catch(() => {});
          }
          await logEscalation(a.id, 6, `تنبيه AI Control أُرسل للمالك`, ownerStaffId || a.staffId);
        }
      }
    }
  } catch (err) {
    console.error("[checklistScheduler] tick error:", err);
  }
}

/** Generate assignments for a given staff member today (idempotent via dateKey).
 *  staffShiftType: the employee's own shift (morning/evening/split/null = no shift assigned).
 */
export async function generateDailyAssignments(staffId: number, staffRole: string, staffShiftType?: string | null): Promise<void> {
  try {
    const { checklistTemplatesTable, checklistItemsTable } = await import("@workspace/db");
    const { eq: eqT, and: andT, or: orT, isNull: isNullT, lte: lteT, gte: gteT } = await import("drizzle-orm");

    const today = new Date();
    const dateKey = today.toISOString().slice(0, 10);
    const dayOfWeek = today.getDay();

    const baseHour = await getSettingInt("checklist_base_hour",        9);
    const shiftEnd = await getSettingInt("checklist_shift_end_hour",  20);
    const shiftStart = await getSettingInt("checklist_shift_start_hour", 9);

    const templates = await db
      .select()
      .from(checklistTemplatesTable)
      .where(andT(
        eqT(checklistTemplatesTable.enabled, true),
        // Only templates within their validity window
        orT(isNullT(checklistTemplatesTable.validFrom),  lteT(checklistTemplatesTable.validFrom,  today)),
        orT(isNullT(checklistTemplatesTable.validUntil), gteT(checklistTemplatesTable.validUntil, today)),
      ));

    for (const tmpl of templates) {
      const days: number[] = (tmpl.daysOfWeek as number[]) ?? [0,1,2,3,4,5,6];
      if (!days.includes(dayOfWeek)) continue;

      // Targeting: specific staff wins over role; role wins over "all"
      if (tmpl.assignedToStaffId !== null && tmpl.assignedToStaffId !== undefined) {
        if (tmpl.assignedToStaffId !== staffId) continue;
      } else if (tmpl.assignedToRole) {
        if (tmpl.assignedToRole !== staffRole) continue;
      }
      // else: no targeting → generate for all active staff

      // ── Shift-type filtering ────────────────────────────────────────────
      // If template specifies a shiftType, only generate for staff with that shift.
      // Staff with no shift assigned (null) match only un-targeted templates (null shiftType).
      const tmplShift = (tmpl as { shiftType?: string | null }).shiftType;
      if (tmplShift) {
        // Template requires a specific shift — skip staff whose shift doesn't match
        if (!staffShiftType || staffShiftType !== tmplShift) continue;
      }
      // Template shiftType null → generate for all staff regardless of shift

      const items = await db
        .select()
        .from(checklistItemsTable)
        .where(eqT(checklistItemsTable.templateId, tmpl.id));

      for (const item of items) {
        const dueAt = new Date(today);
        dueAt.setHours(baseHour, 0, 0, 0);
        dueAt.setMinutes(dueAt.getMinutes() + item.offsetMinutes);

        // ── Idempotency check first — only warn/insert for NEW assignments ──
        const [existing] = await db
          .select({ id: checklistAssignmentsTable.id })
          .from(checklistAssignmentsTable)
          .where(andT(
            eqT(checklistAssignmentsTable.staffId, staffId),
            eqT(checklistAssignmentsTable.itemId, item.id),
            eqT(checklistAssignmentsTable.dateKey, dateKey),
          ));
        if (existing) continue;

        // Warn only on first creation (not on every repeated /generate call)
        if (dueAt.getHours() >= shiftEnd || dueAt.getHours() < shiftStart) {
          console.warn(
            `[generateDailyAssignments] Warning: item "${item.title}" (id=${item.id}) ` +
            `dueAt ${dueAt.toISOString()} is outside shift hours (${shiftStart}:00–${shiftEnd}:00)`
          );
          await notifySupervisors(
            `⚠️ مهمة خارج وقت الدوام: ${item.title}`,
            `الوقت المقرر ${dueAt.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })} يقع خارج ساعات الدوام (${shiftStart}:00 – ${shiftEnd}:00)`,
            "checklist_out_of_shift"
          ).catch(() => {});
        }

        await db.insert(checklistAssignmentsTable).values({
          templateId:      tmpl.id,
          itemId:          item.id,
          title:           item.title,
          description:     item.description,
          priority:        item.priority,
          proofRequired:   item.proofRequired,
          noteRequired:    item.noteRequired,
          resultRequired:  item.resultRequired,
          studentRequired: (item as { studentRequired?: boolean }).studentRequired ?? false,
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

/** Track last auto-generation date to trigger once per calendar day. */
let lastGeneratedDateKey = "";

async function runDailyAutoGeneration(): Promise<void> {
  const today = new Date();
  const dateKey = today.toISOString().slice(0, 10);
  if (dateKey === lastGeneratedDateKey) return;
  lastGeneratedDateKey = dateKey;

  try {
    const activeStaff = await db
      .select({ id: staffTable.id, role: staffTable.role, shiftType: staffTable.shiftType })
      .from(staffTable);

    for (const s of activeStaff) {
      await generateDailyAssignments(s.id, s.role ?? "", s.shiftType ?? null);
    }
    console.log(`[checklistScheduler] Auto-generated assignments for ${activeStaff.length} staff on ${dateKey}`);
  } catch (err) {
    console.error("[checklistScheduler] Auto-generation error:", err);
  }
}

export function startChecklistScheduler(): void {
  // Run immediately on startup (catches first-of-day)
  runDailyAutoGeneration().catch(() => {});

  setInterval(() => {
    // Check every minute if we need to generate for a new day
    runDailyAutoGeneration().catch(() => {});
    runChecklistEscalationTick().catch(() => {});
  }, 60 * 1000);
  console.log("Checklist escalation scheduler started (60s interval)");
}
