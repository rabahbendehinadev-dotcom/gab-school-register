/**
 * AI Control — Rule-based analysis engine (no external LLM).
 * Each finding carries: type, triggerCondition, affected entities, period,
 * evidence, severity, suggestedAction. Insufficient data returns an explicit
 * Info finding with "لا توجد بيانات كافية للحكم."
 */
import {
  pool, db,
  staffTable, staffSessionsTable, studentsTable, activityLogsTable,
  callResultsTable, followupTasksTable, checklistAssignmentsTable,
} from "@workspace/db";
import {
  and, gte, lt, eq, isNull, isNotNull, not, inArray, desc,
} from "drizzle-orm";

export type Severity = "info" | "warning" | "important" | "critical";

export interface AiFinding {
  type: string;
  severity: Severity;
  titleAr: string;
  descriptionAr: string;
  triggerCondition: string;
  evidence: string[];
  affectedStaffIds: number[];
  affectedStudentIds: number[];
  suggestedActionAr: string;
  period: string;
  linkPath?: string;
}

export interface AnalysisSettings {
  idleThresholdMin: number;
  lateResponseThresholdH: number;
  callsWithoutResultThreshold: number;
}

export const DEFAULT_SETTINGS: AnalysisSettings = {
  idleThresholdMin: 20,
  lateResponseThresholdH: 2,
  callsWithoutResultThreshold: 3,
};

const INSUFFICIENT = "لا توجد بيانات كافية للحكم.";

function insufficientFinding(type: string, period: string): AiFinding {
  return {
    type,
    severity: "info",
    titleAr: "بيانات غير كافية",
    descriptionAr: INSUFFICIENT,
    triggerCondition: "لا توجد سجلات كافية لتقييم هذا المعيار",
    evidence: [],
    affectedStaffIds: [],
    affectedStudentIds: [],
    suggestedActionAr: "انتظر حتى تتراكم بيانات كافية.",
    period,
  };
}

async function getStaffNames(): Promise<Record<number, string>> {
  const rows = await db.select({ id: staffTable.id, fullName: staffTable.fullName }).from(staffTable);
  return Object.fromEntries(rows.map(r => [r.id, r.fullName]));
}

// ── 1. Idle staff ─────────────────────────────────────────────────────────

export async function analyzeIdleStaff(idleMin = 20): Promise<AiFinding[]> {
  const cutoff = new Date(Date.now() - idleMin * 60_000);
  const rows = await db
    .select({ staffId: staffSessionsTable.staffId, lastAction: staffSessionsTable.lastActionAt })
    .from(staffSessionsTable)
    .where(and(
      eq(staffSessionsTable.isActive, true),
      lt(staffSessionsTable.lastActionAt, cutoff),
      isNotNull(staffSessionsTable.lastActionAt),
    ));

  if (rows.length === 0) return [];
  const names = await getStaffNames();

  return rows.map(r => {
    const elapsed = Math.round((Date.now() - (r.lastAction?.getTime() ?? Date.now())) / 60_000);
    const name = names[r.staffId] ?? `#${r.staffId}`;
    return {
      type: "idle_staff",
      severity: (elapsed > 45 ? "important" : "warning") as Severity,
      titleAr: `موظف خامل: ${name}`,
      descriptionAr: `${name} متصل منذ أكثر من ${elapsed} دقيقة دون أي نشاط.`,
      triggerCondition: `جلسة نشطة + عدم نشاط > ${idleMin} دقيقة`,
      evidence: [
        `آخر نشاط: ${r.lastAction?.toLocaleString("ar-EG") ?? "—"}`,
        `مدة الخمول: ${elapsed} دقيقة`,
      ],
      affectedStaffIds: [r.staffId],
      affectedStudentIds: [],
      suggestedActionAr: "تحقق من حضور الموظف أو اتصل به للتأكد من انخراطه في العمل.",
      period: "الآن",
      linkPath: `/gab-c7x2p/staff-activity?staff=${r.staffId}`,
    };
  });
}

// ── 2. Calls without result ───────────────────────────────────────────────

export async function analyzeCallsWithoutResult(threshold = 3, lookbackHours = 48): Promise<AiFinding[]> {
  const cutoff = new Date(Date.now() - lookbackHours * 3_600_000);
  const rows = await db
    .select({ staffId: callResultsTable.staffId, staffName: callResultsTable.staffName, studentId: callResultsTable.studentId, clickedAt: callResultsTable.clickedAt })
    .from(callResultsTable)
    .where(and(gte(callResultsTable.clickedAt, cutoff), isNull(callResultsTable.result)))
    .orderBy(desc(callResultsTable.clickedAt))
    .limit(100);

  // Count all calls in period to determine if data is insufficient
  const totalCalls = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM call_results WHERE clicked_at >= $1`, [cutoff]
  );
  if (parseInt(totalCalls.rows[0]?.cnt ?? "0", 10) < 2) {
    return [insufficientFinding("calls_without_result", `آخر ${lookbackHours} ساعة`)];
  }

  const byStaff: Record<number, typeof rows> = {};
  for (const r of rows) {
    if (!byStaff[r.staffId]) byStaff[r.staffId] = [];
    byStaff[r.staffId].push(r);
  }

  const findings = Object.entries(byStaff)
    .filter(([, calls]) => calls.length >= threshold)
    .map(([sid, calls]) => {
      const name = calls[0]?.staffName ?? `#${sid}`;
      const studentIds = calls.map(c => c.studentId).filter(Boolean) as number[];
      return {
        type: "calls_without_result",
        severity: (calls.length >= threshold * 2 ? "important" : "warning") as Severity,
        titleAr: `مكالمات بدون نتيجة: ${name}`,
        descriptionAr: `${name} لديه ${calls.length} مكالمة دون تأكيد نتيجة في آخر ${lookbackHours} ساعة.`,
        triggerCondition: `≥ ${threshold} مكالمات بدون نتيجة خلال ${lookbackHours} ساعة`,
        evidence: calls.slice(0, 5).map(c => `طالب #${c.studentId} — ${c.clickedAt.toLocaleString("ar-EG")}`),
        affectedStaffIds: [Number(sid)],
        affectedStudentIds: studentIds,
        suggestedActionAr: "اطلب من الموظف تأكيد نتائج المكالمات المفتوحة.",
        period: `آخر ${lookbackHours} ساعة`,
        // Link to specific student if only one affected, else to staff activity
        linkPath: studentIds.length === 1
          ? `/gab-c7x2p/students/${studentIds[0]}`
          : `/gab-c7x2p/staff-activity?staff=${sid}`,
      };
    });

  return findings;
}

// ── 3. Overdue follow-ups ─────────────────────────────────────────────────

export async function analyzeStudentsWithoutFollowup(): Promise<AiFinding[]> {
  const now = new Date();
  const rows = await db
    .select({ id: studentsTable.id, firstName: studentsTable.firstName, lastName: studentsTable.lastName, stage: studentsTable.stage, nextFollowupAt: studentsTable.nextFollowupAt })
    .from(studentsTable)
    .where(and(
      lt(studentsTable.nextFollowupAt, now),
      isNull(studentsTable.deletedAt),
      not(inArray(studentsTable.stage, ["confirmed", "paid", "dropped"])),
    ))
    .orderBy(studentsTable.nextFollowupAt)
    .limit(50);

  // Check if any students have nextFollowupAt set at all
  const hasFollowup = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM students WHERE next_followup_at IS NOT NULL AND deleted_at IS NULL`
  );
  if (parseInt(hasFollowup.rows[0]?.cnt ?? "0", 10) < 2) {
    return [insufficientFinding("students_without_followup", "اليوم")];
  }

  if (rows.length === 0) return [];

  const severity: Severity = rows.length >= 10 ? "important" : rows.length >= 5 ? "warning" : "info";
  const oldest = rows[0];
  const oldestDays = oldest?.nextFollowupAt ? Math.round((now.getTime() - oldest.nextFollowupAt.getTime()) / 86400_000) : 0;

  return [{
    type: "students_without_followup",
    severity,
    titleAr: `${rows.length} طالب بمتابعة متأخرة`,
    descriptionAr: `${rows.length} طالب تجاوز موعد متابعتهم. أقدمها تأخر ${oldestDays} يوم.`,
    triggerCondition: `next_followup_at < الآن + مرحلة نشطة (غير مؤكد/مدفوع/منسحب)`,
    evidence: rows.slice(0, 5).map(r => {
      const days = r.nextFollowupAt ? Math.round((now.getTime() - r.nextFollowupAt.getTime()) / 86400_000) : 0;
      return `${r.firstName} ${r.lastName} — ${r.stage} — تأخر ${days} يوم`;
    }),
    affectedStaffIds: [],
    affectedStudentIds: rows.map(r => r.id),
    suggestedActionAr: "راجع قائمة المتابعات وأعد جدولتها أو أعد تعيينها.",
    period: "اليوم",
    linkPath: `/gab-c7x2p/students`,
  }];
}

// ── 4. Checklist completion ───────────────────────────────────────────────

export async function analyzeChecklistCompletion(): Promise<AiFinding[]> {
  const dateKey = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({ staffId: checklistAssignmentsTable.staffId, status: checklistAssignmentsTable.status })
    .from(checklistAssignmentsTable)
    .where(eq(checklistAssignmentsTable.dateKey, dateKey));

  if (rows.length === 0) return [insufficientFinding("checklist_low_completion", "اليوم")];

  const byStaff: Record<number, { total: number; incomplete: number }> = {};
  for (const r of rows) {
    if (!byStaff[r.staffId]) byStaff[r.staffId] = { total: 0, incomplete: 0 };
    byStaff[r.staffId].total++;
    if (!["done", "completed", "cancelled"].includes(r.status)) byStaff[r.staffId].incomplete++;
  }

  const names = await getStaffNames();
  const findings: AiFinding[] = [];
  for (const [sid, stats] of Object.entries(byStaff)) {
    const rate = ((stats.total - stats.incomplete) / stats.total) * 100;
    if (rate < 70) {
      const name = names[Number(sid)] ?? `#${sid}`;
      findings.push({
        type: "checklist_low_completion",
        severity: (rate < 40 ? "critical" : rate < 60 ? "important" : "warning") as Severity,
        titleAr: `اكتمال قائمة مهام منخفض: ${name}`,
        descriptionAr: `${name} أكمل ${Math.round(rate)}% من مهام اليوم (${stats.total - stats.incomplete}/${stats.total}).`,
        triggerCondition: `نسبة إنجاز مهام اليوم < 70%`,
        evidence: [`المكتملة: ${stats.total - stats.incomplete}`, `المفتوحة: ${stats.incomplete}`, `نسبة: ${Math.round(rate)}%`],
        affectedStaffIds: [Number(sid)],
        affectedStudentIds: [],
        suggestedActionAr: "راجع قائمة مهام الموظف وتأكد من تسليم أو إعادة تعيين المهام المتأخرة.",
        period: "اليوم",
        linkPath: `/gab-c7x2p/checklist-admin?staff=${sid}`,
      });
    }
  }
  return findings;
}

// ── 5. Overlapping staff contacts ─────────────────────────────────────────

export async function analyzeOverlappingContacts(windowMin = 30): Promise<AiFinding[]> {
  const lookback = new Date(Date.now() - 24 * 3_600_000);
  const totalInWindow = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM call_results WHERE clicked_at >= $1`, [lookback]
  );
  if (parseInt(totalInWindow.rows[0]?.cnt ?? "0", 10) < 4) {
    return [insufficientFinding("overlapping_contacts", "آخر 24 ساعة")];
  }

  const result = await pool.query<{ student_id: number; staff_ids: string; staff_names: string; contact_times: string }>(`
    SELECT student_id,
      string_agg(DISTINCT staff_id::text, ',') AS staff_ids,
      string_agg(DISTINCT COALESCE(staff_name, staff_id::text), ', ') AS staff_names,
      string_agg(to_char(clicked_at, 'HH24:MI'), ', ' ORDER BY clicked_at) AS contact_times
    FROM call_results
    WHERE clicked_at >= $1 AND student_id IS NOT NULL
    GROUP BY student_id
    HAVING COUNT(DISTINCT staff_id) > 1
       AND MAX(clicked_at) - MIN(clicked_at) < ($2 || ' minutes')::interval
    ORDER BY MIN(clicked_at) DESC LIMIT 20
  `, [lookback, windowMin]);

  if (result.rows.length === 0) return [];

  const studentIds = result.rows.map(r => r.student_id);
  const students = await db
    .select({ id: studentsTable.id, firstName: studentsTable.firstName, lastName: studentsTable.lastName })
    .from(studentsTable)
    .where(inArray(studentsTable.id, studentIds));
  const sMap = Object.fromEntries(students.map(s => [s.id, `${s.firstName} ${s.lastName}`]));

  return result.rows.map(r => ({
    type: "overlapping_contacts",
    severity: "warning" as Severity,
    titleAr: `تواصل مزدوج: ${sMap[r.student_id] ?? `#${r.student_id}`}`,
    descriptionAr: `موظفان تواصلا مع نفس الطالب خلال ${windowMin} دقيقة.`,
    triggerCondition: `موظفان+ يتصلان بنفس الطالب خلال ${windowMin} دقيقة`,
    evidence: [
      `الطالب: ${sMap[r.student_id] ?? `#${r.student_id}`}`,
      `الموظفون: ${r.staff_names}`,
      `الأوقات: ${r.contact_times}`,
    ],
    affectedStaffIds: r.staff_ids.split(",").map(Number),
    affectedStudentIds: [r.student_id],
    suggestedActionAr: "تأكد من توزيع الطلاب بوضوح لتجنب تكرار التواصل.",
    period: "آخر 24 ساعة",
    linkPath: `/gab-c7x2p/students/${r.student_id}`,
  }));
}

// ── 6. Slow first response ────────────────────────────────────────────────

export async function analyzeResponseTime(thresholdH = 2): Promise<AiFinding[]> {
  const tooLong = new Date(Date.now() - thresholdH * 3_600_000);
  const dayAgo  = new Date(Date.now() - 24 * 3_600_000);
  const newStudents = await db
    .select({ id: studentsTable.id, firstName: studentsTable.firstName, lastName: studentsTable.lastName, createdAt: studentsTable.createdAt })
    .from(studentsTable)
    .where(and(gte(studentsTable.createdAt, dayAgo), lt(studentsTable.createdAt, tooLong), isNull(studentsTable.deletedAt)));

  if (newStudents.length < 1) {
    return [insufficientFinding("slow_response_time", "آخر 24 ساعة")];
  }

  const calledIds = new Set(
    (await db.select({ studentId: callResultsTable.studentId })
      .from(callResultsTable)
      .where(and(gte(callResultsTable.clickedAt, dayAgo), inArray(callResultsTable.studentId, newStudents.map(s => s.id)))))
      .map(r => r.studentId)
  );

  const uncalled = newStudents.filter(s => !calledIds.has(s.id));
  if (uncalled.length === 0) return [];

  return [{
    type: "slow_response_time",
    severity: (uncalled.length >= 3 ? "important" : "warning") as Severity,
    titleAr: `${uncalled.length} طالب جديد لم يُتواصل معه`,
    descriptionAr: `${uncalled.length} طالب سُجّلوا منذ أكثر من ${thresholdH} ساعة دون أي اتصال.`,
    triggerCondition: `طالب جديد + لا يوجد call_result خلال ${thresholdH} ساعة من التسجيل`,
    evidence: uncalled.slice(0, 5).map(s => `${s.firstName} ${s.lastName} — منذ ${Math.round((Date.now() - s.createdAt.getTime()) / 3_600_000)} ساعة`),
    affectedStaffIds: [],
    affectedStudentIds: uncalled.map(s => s.id),
    suggestedActionAr: "تواصل مع الطلاب الجدد فوراً لتحقيق أفضل معدل تحويل.",
    period: "آخر 24 ساعة",
    linkPath: `/gab-c7x2p/students`,
  }];
}

// ── 7. No contact in 7 days ───────────────────────────────────────────────

export async function analyzeStudentsWithoutContact(): Promise<AiFinding[]> {
  const cutoff = new Date(Date.now() - 7 * 86400_000);
  const hasAny = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM students WHERE deleted_at IS NULL AND stage NOT IN ('confirmed','paid','dropped') AND last_contacted_at IS NOT NULL`
  );
  if (parseInt(hasAny.rows[0]?.cnt ?? "0", 10) < 2) {
    return [insufficientFinding("students_without_contact", "آخر 7 أيام")];
  }

  const rows = await db
    .select({ id: studentsTable.id, firstName: studentsTable.firstName, lastName: studentsTable.lastName, lastContactedAt: studentsTable.lastContactedAt, stage: studentsTable.stage })
    .from(studentsTable)
    .where(and(
      isNull(studentsTable.deletedAt),
      inArray(studentsTable.stage, ["new", "interested", "considering", "pending"]),
      lt(studentsTable.lastContactedAt, cutoff),
    ))
    .orderBy(studentsTable.lastContactedAt)
    .limit(30);

  if (rows.length === 0) return [];

  return [{
    type: "students_without_contact",
    severity: (rows.length >= 10 ? "important" : "warning") as Severity,
    titleAr: `${rows.length} طالب لم يُتواصل معهم منذ 7 أيام`,
    descriptionAr: `${rows.length} طالب في مراحل نشطة لم يُتواصل معهم منذ أكثر من أسبوع.`,
    triggerCondition: `last_contacted_at < قبل 7 أيام + مرحلة نشطة`,
    evidence: rows.slice(0, 5).map(r => {
      const days = r.lastContactedAt ? Math.round((Date.now() - r.lastContactedAt.getTime()) / 86400_000) : "؟";
      return `${r.firstName} ${r.lastName} — ${r.stage} — آخر تواصل: ${days} يوم`;
    }),
    affectedStaffIds: [],
    affectedStudentIds: rows.map(r => r.id),
    suggestedActionAr: "أعد تعيين هؤلاء الطلاب أو حدد مسؤولاً لمتابعتهم.",
    period: "آخر 7 أيام",
    linkPath: `/gab-c7x2p/students`,
  }];
}

// ── 8. Stage change without note ──────────────────────────────────────────

export async function analyzeStatusChangesWithoutNotes(lookbackHours = 24): Promise<AiFinding[]> {
  const cutoff = new Date(Date.now() - lookbackHours * 3_600_000);
  const result = await pool.query<{
    employee_id: number; student_id: number; performed_by: string;
    old_value: string; new_value: string; created_at: string; has_note: boolean;
  }>(`
    SELECT al.employee_id, al.student_id, al.performed_by,
           al.old_value, al.new_value, al.created_at,
           EXISTS(
             SELECT 1 FROM student_notes sn
             WHERE sn.student_id = al.student_id
               AND sn.created_at BETWEEN al.created_at AND al.created_at + INTERVAL '30 minutes'
           ) AS has_note
    FROM activity_logs al
    WHERE al.created_at >= $1
      AND al.student_id IS NOT NULL
      AND (al.action ILIKE '%stage%' OR al.action_type ILIKE '%stage%')
  `, [cutoff]);

  if (result.rows.length < 1) {
    return [insufficientFinding("stage_change_without_note", `آخر ${lookbackHours} ساعة`)];
  }

  const withoutNotes = result.rows.filter(r => !r.has_note);
  if (withoutNotes.length === 0) return [];

  const names = await getStaffNames();
  const byStaff: Record<number, typeof withoutNotes> = {};
  for (const r of withoutNotes) {
    if (!byStaff[r.employee_id]) byStaff[r.employee_id] = [];
    byStaff[r.employee_id].push(r);
  }

  return Object.entries(byStaff).map(([sid, changes]) => {
    const name = names[Number(sid)] ?? changes[0]?.performed_by ?? `#${sid}`;
    const studentIds = changes.map(c => c.student_id).filter(Boolean);
    return {
      type: "stage_change_without_note",
      severity: "warning" as Severity,
      titleAr: `تغيير مرحلة بدون ملاحظة: ${name}`,
      descriptionAr: `${name} غيّر مرحلة ${changes.length} طالب دون إضافة ملاحظة خلال 30 دقيقة.`,
      triggerCondition: `تغيير stage في سجل النشاط + لا توجد ملاحظة خلال 30 دقيقة`,
      evidence: changes.slice(0, 5).map(c =>
        `طالب #${c.student_id}: ${c.old_value ?? "؟"} → ${c.new_value ?? "؟"} — ${new Date(c.created_at).toLocaleString("ar-EG")}`
      ),
      affectedStaffIds: [Number(sid)],
      affectedStudentIds: studentIds,
      suggestedActionAr: "أضف ملاحظة لكل تغيير مرحلة لتوثيق سبب التحول.",
      period: `آخر ${lookbackHours} ساعة`,
      linkPath: studentIds.length === 1
        ? `/gab-c7x2p/students/${studentIds[0]}`
        : `/gab-c7x2p/staff-activity?staff=${sid}`,
    };
  });
}

// ── 9. Students without owner ─────────────────────────────────────────────

export async function analyzeStudentsWithoutOwner(): Promise<AiFinding[]> {
  const result = await pool.query<{ id: number; first_name: string; last_name: string; stage: string; created_at: string }>(`
    SELECT s.id, s.first_name, s.last_name, s.stage, s.created_at
    FROM students s
    WHERE s.deleted_at IS NULL
      AND s.stage NOT IN ('confirmed', 'paid', 'dropped')
      AND NOT EXISTS (SELECT 1 FROM student_owners so WHERE so.student_id = s.id)
    ORDER BY s.created_at DESC LIMIT 30
  `);
  if (result.rows.length === 0) return [];

  return [{
    type: "students_without_owner",
    severity: (result.rows.length >= 10 ? "important" : "warning") as Severity,
    titleAr: `${result.rows.length} طالب بدون موظف مسؤول`,
    descriptionAr: `${result.rows.length} طالب في مراحل نشطة لم يُعيَّن لهم موظف مسؤول.`,
    triggerCondition: `student_owners فارغ + مرحلة نشطة`,
    evidence: result.rows.slice(0, 5).map(r => `${r.first_name} ${r.last_name} — ${r.stage} — ${new Date(r.created_at).toLocaleDateString("ar-EG")}`),
    affectedStaffIds: [],
    affectedStudentIds: result.rows.map(r => r.id),
    suggestedActionAr: "عيّن موظفاً مسؤولاً لكل طالب لضمان متابعة منتظمة.",
    period: "الكلي",
    linkPath: `/gab-c7x2p/students`,
  }];
}

// ── 10. Late tasks ────────────────────────────────────────────────────────

export async function analyzeLateTasks(): Promise<AiFinding[]> {
  const now = new Date();
  const rows = await db
    .select({ id: followupTasksTable.id, assignedTo: followupTasksTable.assignedTo, title: followupTasksTable.title, dueAt: followupTasksTable.dueAt, studentId: followupTasksTable.studentId })
    .from(followupTasksTable)
    .where(and(eq(followupTasksTable.completed, false), lt(followupTasksTable.dueAt, now), isNotNull(followupTasksTable.dueAt)))
    .orderBy(followupTasksTable.dueAt)
    .limit(100);

  if (rows.length === 0) return [];

  const names = await getStaffNames();
  const byStaff: Record<number, typeof rows> = {};
  for (const r of rows) {
    const sid = r.assignedTo ?? 0;
    if (sid === 0) continue;
    if (!byStaff[sid]) byStaff[sid] = [];
    byStaff[sid].push(r);
  }

  return Object.entries(byStaff).map(([sid, tasks]) => {
    const name = names[Number(sid)] ?? `#${sid}`;
    const maxDays = Math.max(...tasks.map(t => Math.round((now.getTime() - (t.dueAt?.getTime() ?? 0)) / 86400_000)));
    const studentIds = tasks.map(t => t.studentId).filter(Boolean) as number[];
    return {
      type: "late_tasks",
      severity: (tasks.length >= 3 || maxDays >= 3 ? "important" : "warning") as Severity,
      titleAr: `مهام متأخرة: ${name}`,
      descriptionAr: `${name} لديه ${tasks.length} مهمة متأخرة، أقدمها تأخر ${maxDays} يوم.`,
      triggerCondition: `followup_task.completed = false + due_at < الآن`,
      evidence: tasks.slice(0, 5).map(t => `"${t.title}" — تأخر ${Math.round((now.getTime() - (t.dueAt?.getTime() ?? 0)) / 86400_000)} يوم`),
      affectedStaffIds: [Number(sid)],
      affectedStudentIds: studentIds,
      suggestedActionAr: "راجع المهام المتأخرة وحددها أو أعد تعيينها.",
      period: "الكلي",
      // Link to specific student if single task with student, else to staff tasks
      linkPath: studentIds.length === 1
        ? `/gab-c7x2p/students/${studentIds[0]}`
        : `/gab-c7x2p/tasks?staff=${sid}`,
    };
  });
}

// ── 11. Shift not started ─────────────────────────────────────────────────

export async function analyzeShiftNotStarted(): Promise<AiFinding[]> {
  const now = new Date();
  const hour = now.getHours();
  // Only check between 8:00–22:00
  if (hour < 8 || hour >= 22) return [];

  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const dateKey = now.toISOString().slice(0, 10);

  // Staff scheduled today via checklist_assignments
  const expected = await pool.query<{ staff_id: number }>(
    `SELECT DISTINCT staff_id FROM checklist_assignments WHERE date_key = $1`, [dateKey]
  );
  if (expected.rows.length === 0) return [];

  // Staff who have logged in today
  const loggedIn = new Set(
    (await pool.query<{ staff_id: number }>(
      `SELECT DISTINCT staff_id FROM staff_sessions WHERE started_at >= $1`, [startOfDay]
    )).rows.map(r => r.staff_id)
  );

  const notStarted = expected.rows.map(r => r.staff_id).filter(id => !loggedIn.has(id));
  if (notStarted.length === 0) return [];

  const names = await getStaffNames();
  return [{
    type: "shift_not_started",
    severity: (hour >= 10 ? "important" : "warning") as Severity,
    titleAr: `${notStarted.length} موظف لم يبدأ وردية اليوم`,
    descriptionAr: `${notStarted.length} موظف مجدول اليوم لم يسجل دخوله حتى الساعة ${hour}:00.`,
    triggerCondition: `مجدول في checklist_assignments + لا توجد staff_session بدأت اليوم`,
    evidence: notStarted.slice(0, 5).map(id => `${names[id] ?? "#" + id} — لم يسجل دخوله`),
    affectedStaffIds: notStarted,
    affectedStudentIds: [],
    suggestedActionAr: "تواصل مع الموظف للتأكد من حضوره أو تعديل الجدول.",
    period: "اليوم",
    linkPath: `/gab-c7x2p/staff-activity`,
  }];
}

// ── 12. Abnormal activity drop ────────────────────────────────────────────

export async function analyzeAbnormalActivity(): Promise<AiFinding[]> {
  const now = new Date();
  const weekAgo     = new Date(Date.now() - 7 * 86400_000);
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400_000);

  const thisW = await pool.query<{ staff_id: number; cnt: string }>(
    `SELECT employee_id AS staff_id, COUNT(*) AS cnt FROM activity_logs WHERE created_at BETWEEN $1 AND $2 AND employee_id IS NOT NULL GROUP BY employee_id`,
    [weekAgo, now]
  );
  const prevW = await pool.query<{ staff_id: number; cnt: string }>(
    `SELECT employee_id AS staff_id, COUNT(*) AS cnt FROM activity_logs WHERE created_at BETWEEN $1 AND $2 AND employee_id IS NOT NULL GROUP BY employee_id`,
    [twoWeeksAgo, weekAgo]
  );

  if (prevW.rows.length === 0) {
    return [insufficientFinding("abnormal_activity", "آخر أسبوعين")];
  }

  const thisMap: Record<number, number> = {};
  for (const r of thisW.rows) thisMap[r.staff_id] = parseInt(r.cnt, 10);
  const prevMap: Record<number, number> = {};
  for (const r of prevW.rows) prevMap[r.staff_id] = parseInt(r.cnt, 10);

  const names = await getStaffNames();
  const findings: AiFinding[] = [];

  for (const [sid, prev] of Object.entries(prevMap)) {
    if (prev < 10) continue; // no reliable baseline
    const staffId = Number(sid);
    const current = thisMap[staffId] ?? 0;
    const dropPct = Math.round(((prev - current) / prev) * 100);
    if (dropPct >= 50) {
      const name = names[staffId] ?? `#${staffId}`;
      findings.push({
        type: "abnormal_activity_drop",
        severity: (dropPct >= 75 ? "important" : "warning") as Severity,
        titleAr: `انخفاض نشاط غير طبيعي: ${name}`,
        descriptionAr: `${name} نشاطه هذا الأسبوع (${current}) انخفض بنسبة ${dropPct}% مقارنة بالأسبوع الماضي (${prev}).`,
        triggerCondition: `انخفاض النشاط الأسبوعي > 50% مقارنة بالأسبوع السابق`,
        evidence: [
          `هذا الأسبوع: ${current} إجراء`,
          `الأسبوع الماضي: ${prev} إجراء`,
          `نسبة الانخفاض: ${dropPct}%`,
        ],
        affectedStaffIds: [staffId],
        affectedStudentIds: [],
        suggestedActionAr: "راجع حالة الموظف وتأكد من انخراطه في العمل.",
        period: "آخر أسبوعين",
        linkPath: `/gab-c7x2p/staff-activity?staff=${staffId}`,
      });
    }
  }
  return findings;
}

// ── 13. Conversion rate ───────────────────────────────────────────────────

export async function analyzeConversionRate(): Promise<AiFinding[]> {
  const weekAgo    = new Date(Date.now() - 7 * 86400_000);
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400_000);

  const overall  = await pool.query<{ stage: string; cnt: string }>(`SELECT stage, COUNT(*) AS cnt FROM students WHERE deleted_at IS NULL GROUP BY stage`);
  const thisW    = await pool.query<{ cnt: string }>(`SELECT COUNT(*) AS cnt FROM students WHERE deleted_at IS NULL AND stage IN ('confirmed','paid') AND updated_at >= $1`, [weekAgo]);
  const prevW    = await pool.query<{ cnt: string }>(`SELECT COUNT(*) AS cnt FROM students WHERE deleted_at IS NULL AND stage IN ('confirmed','paid') AND updated_at >= $1 AND updated_at < $2`, [twoWeeksAgo, weekAgo]);

  const counts: Record<string, number> = {};
  for (const r of overall.rows) counts[r.stage] = parseInt(r.cnt, 10);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  if (total < 10) return [insufficientFinding("conversion_rate", "الكلي")];

  const confirmed = (counts["confirmed"] ?? 0) + (counts["paid"] ?? 0);
  const rate      = Math.round((confirmed / total) * 100);
  const thisWn    = parseInt(thisW.rows[0]?.cnt ?? "0", 10);
  const prevWn    = parseInt(prevW.rows[0]?.cnt ?? "0", 10);
  const weekDrop  = prevWn > 0 ? Math.round(((prevWn - thisWn) / prevWn) * 100) : 0;

  const severity: Severity = rate < 10 ? "important" : weekDrop >= 30 ? "warning" : "info";

  return [{
    type: "conversion_rate",
    severity,
    titleAr: `معدل التحويل: ${rate}%${weekDrop >= 20 ? ` (انخفض ${weekDrop}% هذا الأسبوع)` : ""}`,
    descriptionAr: `من ${total} طالب، ${confirmed} مؤكد/مدفوع (${rate}%). هذا الأسبوع: ${thisWn}، الأسبوع الماضي: ${prevWn}.`,
    triggerCondition: `معدل التحويل الكلي < 15% أو انخفاض أسبوعي > 20%`,
    evidence: Object.entries(counts).map(([s, c]) => `${s}: ${c}`),
    affectedStaffIds: [],
    affectedStudentIds: [],
    suggestedActionAr: rate < 15 ? "راجع أسلوب المتابعة وجرب استراتيجيات تحويل مختلفة." : "معدل التحويل مقبول.",
    period: "الكلي",
    linkPath: `/gab-c7x2p/pipeline`,
  }];
}

// ── Run all ───────────────────────────────────────────────────────────────

export async function runAllAnalyses(settings: Partial<AnalysisSettings> = {}): Promise<AiFinding[]> {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const results = await Promise.allSettled([
    analyzeIdleStaff(s.idleThresholdMin),
    analyzeCallsWithoutResult(s.callsWithoutResultThreshold, 48),
    analyzeStudentsWithoutFollowup(),
    analyzeChecklistCompletion(),
    analyzeOverlappingContacts(30),
    analyzeResponseTime(s.lateResponseThresholdH),
    analyzeStudentsWithoutContact(),
    analyzeStatusChangesWithoutNotes(24),
    analyzeStudentsWithoutOwner(),
    analyzeLateTasks(),
    analyzeShiftNotStarted(),
    analyzeAbnormalActivity(),
    analyzeConversionRate(),
  ]);

  const findings = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
  const failed = results.filter(r => r.status === "rejected");
  if (failed.length > 0) {
    console.warn(`[aiControl] ${failed.length} analyses failed:`, (failed[0] as PromiseRejectedResult).reason);
  }
  return findings;
}

export function topSeverity(findings: AiFinding[]): Severity {
  for (const s of ["critical", "important", "warning", "info"] as Severity[]) {
    if (findings.some(f => f.severity === s)) return s;
  }
  return "info";
}

// ── Staff performance KPIs ────────────────────────────────────────────────

export async function getStaffPerformance(fromDate: Date, toDate: Date): Promise<object[]> {
  const days = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86400_000));

  // Average first response time per staff (first call to a student after signup)
  const frtResult = await pool.query<{ staff_id: number; avg_hours: string }>(`
    SELECT cr.staff_id,
      ROUND(AVG(EXTRACT(EPOCH FROM (cr.clicked_at - s.created_at)) / 3600)::numeric, 1) AS avg_hours
    FROM call_results cr
    JOIN students s ON s.id = cr.student_id
    WHERE cr.clicked_at BETWEEN $1 AND $2
      AND NOT EXISTS (
        SELECT 1 FROM call_results cr2
        WHERE cr2.student_id = cr.student_id AND cr2.clicked_at < cr.clicked_at
      )
    GROUP BY cr.staff_id
  `, [fromDate, toDate]);
  const frtMap: Record<number, number> = {};
  for (const r of frtResult.rows) frtMap[r.staff_id] = parseFloat(r.avg_hours);

  const result = await pool.query<{
    staff_id: number; full_name: string; role: string; shift_type: string;
    login_count: string; actual_login_hours: string; last_active: string | null;
    total_actions: string; students_opened: string;
    whatsapp_clicks: string; call_clicks: string; contacts_made: string;
    calls_with_result: string; calls_without_result: string; notes_added: string;
    tasks_total: string; tasks_completed: string; tasks_late: string;
    confirmed_students: string; paying_students: string;
    checklist_done: string; checklist_total: string;
  }>(`
    SELECT
      s.id AS staff_id,
      s.full_name,
      s.role,
      COALESCE(s.shift_type, 'morning') AS shift_type,
      COUNT(DISTINCT ss.id) AS login_count,
      COALESCE(
        ROUND(SUM(EXTRACT(EPOCH FROM (
          COALESCE(ss.ended_at, LEAST(ss.last_heartbeat_at, $2)) - ss.started_at
        )) / 3600)::numeric, 1), 0
      ) AS actual_login_hours,
      MAX(ss.last_heartbeat_at) AS last_active,
      COUNT(DISTINCT al.id)   AS total_actions,
      COUNT(DISTINCT CASE WHEN al.entity_type = 'student' THEN al.entity_id END) AS students_opened,
      COUNT(DISTINCT CASE WHEN al.action IN ('whatsapp_click','open_whatsapp') THEN al.id END) AS whatsapp_clicks,
      COUNT(DISTINCT CASE WHEN al.action IN ('call_click','call_student') THEN al.id END) AS call_clicks,
      COUNT(DISTINCT CASE
        WHEN al.action IN ('contact_student','whatsapp_click','call_click','open_whatsapp','call_student') THEN al.id
      END) AS contacts_made,
      COUNT(DISTINCT CASE WHEN cr.result IS NOT NULL THEN cr.id END) AS calls_with_result,
      COUNT(DISTINCT CASE WHEN cr.result IS NULL     THEN cr.id END) AS calls_without_result,
      COUNT(DISTINCT CASE
        WHEN al.action_type = 'note_added' OR al.action IN ('note_added','add_note') THEN al.id
      END) AS notes_added,
      -- Tasks constrained to date range (created within the period)
      COUNT(DISTINCT ft.id) FILTER (WHERE ft.assigned_to = s.id) AS tasks_total,
      COUNT(DISTINCT ft.id) FILTER (WHERE ft.assigned_to = s.id AND ft.completed = true) AS tasks_completed,
      COUNT(DISTINCT ft.id) FILTER (WHERE ft.assigned_to = s.id AND ft.completed = false AND ft.due_at < NOW()) AS tasks_late,
      -- Confirmed/paying students owned by this staff
      COUNT(DISTINCT CASE WHEN stu.stage = 'confirmed' AND so_q.staff_id = s.id THEN stu.id END) AS confirmed_students,
      COUNT(DISTINCT CASE WHEN stu.stage = 'paid'      AND so_q.staff_id = s.id THEN stu.id END) AS paying_students,
      COUNT(DISTINCT CASE WHEN ca.status IN ('done','completed') THEN ca.id END) AS checklist_done,
      COUNT(DISTINCT ca.id) AS checklist_total
    FROM staff s
    LEFT JOIN staff_sessions ss ON ss.staff_id = s.id
      AND ss.started_at BETWEEN $1 AND $2
    LEFT JOIN activity_logs al ON al.employee_id = s.id
      AND al.created_at BETWEEN $1 AND $2
    LEFT JOIN call_results cr ON cr.staff_id = s.id
      AND cr.clicked_at BETWEEN $1 AND $2
    LEFT JOIN followup_tasks ft ON ft.assigned_to = s.id
      AND ft.created_at BETWEEN $1 AND $2
    LEFT JOIN student_owners so_q ON so_q.staff_id = s.id
    LEFT JOIN students stu ON stu.id = so_q.student_id AND stu.deleted_at IS NULL
    LEFT JOIN checklist_assignments ca ON ca.staff_id = s.id
      AND ca.created_at BETWEEN $1 AND $2
    WHERE s.id IS NOT NULL
    GROUP BY s.id, s.full_name, s.role, s.shift_type
    ORDER BY COUNT(DISTINCT al.id) DESC
  `, [fromDate, toDate]);

  return result.rows.map(r => {
    const clDone   = parseInt(r.checklist_done, 10);
    const clTotal  = parseInt(r.checklist_total, 10);
    const tComp    = parseInt(r.tasks_completed, 10);
    const tTotal   = parseInt(r.tasks_total, 10);
    const confirmed = parseInt(r.confirmed_students, 10);
    const paying    = parseInt(r.paying_students, 10);
    const loginH    = parseFloat(r.actual_login_hours);

    // Scheduled hours: shift_type determines hours per day
    const hoursPerDay = r.shift_type === "both" ? 16 : 8;
    const scheduledHours = Math.round(hoursPerDay * days * 10) / 10;
    const idleHours = Math.max(0, Math.round((scheduledHours - loginH) * 10) / 10);

    // Owned students total (confirmed + paying + others) for conversion rate
    const ownedTotal = confirmed + paying;  // denominator from same owned-students query
    const conversionRate = ownedTotal > 0 ? Math.round((confirmed / ownedTotal) * 100) : null;

    return {
      staffId:              r.staff_id,
      fullName:             r.full_name,
      role:                 r.role,
      shiftType:            r.shift_type,
      scheduledHours,
      actualLoginHours:     loginH,
      idleHours,
      loginCount:           parseInt(r.login_count, 10),
      lastActive:           r.last_active,
      totalActions:         parseInt(r.total_actions, 10),
      studentsOpened:       parseInt(r.students_opened, 10),
      whatsappClicks:       parseInt(r.whatsapp_clicks, 10),
      callClicks:           parseInt(r.call_clicks, 10),
      contactsMade:         parseInt(r.contacts_made, 10),
      callsWithResult:      parseInt(r.calls_with_result, 10),
      callsWithoutResult:   parseInt(r.calls_without_result, 10),
      notesAdded:           parseInt(r.notes_added, 10),
      // Follow-up task metrics — date-range constrained
      followupTasksTotal:   tTotal,
      followupTasksDone:    tComp,
      followupTasksLate:    parseInt(r.tasks_late, 10),
      followupTaskRate:     tTotal > 0 ? Math.round((tComp / tTotal) * 100) : null,
      // Kept for backwards compat
      tasksTotal:           tTotal,
      tasksCompleted:       tComp,
      tasksLate:            parseInt(r.tasks_late, 10),
      taskCompletionRate:   tTotal > 0 ? Math.round((tComp / tTotal) * 100) : null,
      confirmedStudents:    confirmed,
      payingStudents:       paying,
      conversionCount:      confirmed + paying,
      conversionRate,
      checklistDone:        clDone,
      checklistTotal:       clTotal,
      checklistRate:        clTotal > 0 ? Math.round((clDone / clTotal) * 100) : null,
      avgFirstResponseHours: frtMap[r.staff_id] ?? null,
    };
  });
}
