/**
 * AI Control — Rule-based analysis engine.
 * Queries activity_logs, call_results, checklist_assignments, staff_sessions, students.
 * Never invents data. Returns structured findings with severity, evidence, affected IDs.
 * No external LLM or API calls.
 */
import { pool, db, staffTable, staffSessionsTable, studentsTable, activityLogsTable, callResultsTable, followupTasksTable, checklistAssignmentsTable } from "@workspace/db";
import { and, gte, lte, eq, isNull, lt, sql, desc, not, inArray, isNotNull } from "drizzle-orm";

export type Severity = "info" | "warning" | "important" | "critical";

export interface AiFinding {
  type: string;
  severity: Severity;
  titleAr: string;
  descriptionAr: string;
  evidence: string[];
  affectedStaffIds: number[];
  affectedStudentIds: number[];
  suggestedActionAr: string;
  period: string;
  linkPath?: string;
}

const INSUFFICIENT = "لا توجد بيانات كافية للحكم.";

async function getStaffNames(): Promise<Record<number, string>> {
  const rows = await db.select({ id: staffTable.id, fullName: staffTable.fullName }).from(staffTable);
  return Object.fromEntries(rows.map(r => [r.id, r.fullName]));
}

/** 1. Staff with active sessions idle for more than idleMinutes. */
export async function analyzeIdleStaff(idleMinutes = 20): Promise<AiFinding[]> {
  const cutoff = new Date(Date.now() - idleMinutes * 60_000);
  const rows = await db
    .select({
      staffId: staffSessionsTable.staffId,
      lastAction: staffSessionsTable.lastActionAt,
      heartbeat: staffSessionsTable.lastHeartbeatAt,
    })
    .from(staffSessionsTable)
    .where(
      and(
        eq(staffSessionsTable.isActive, true),
        lt(staffSessionsTable.lastActionAt, cutoff),
        isNotNull(staffSessionsTable.lastActionAt),
      )
    );

  if (rows.length === 0) return [];
  const names = await getStaffNames();

  return rows.map(r => {
    const idleMin = Math.round((Date.now() - (r.lastAction?.getTime() ?? Date.now())) / 60_000);
    const name = names[r.staffId] ?? `#${r.staffId}`;
    return {
      type: "idle_staff",
      severity: idleMin > 45 ? "important" : "warning",
      titleAr: `موظف خامل: ${name}`,
      descriptionAr: `${name} متصل منذ أكثر من ${idleMin} دقيقة دون أي نشاط مسجل.`,
      evidence: [
        `آخر نشاط: ${r.lastAction?.toLocaleString("ar-EG") ?? "—"}`,
        `الجلسة نشطة: نعم`,
        `مدة الخمول: ${idleMin} دقيقة`,
      ],
      affectedStaffIds: [r.staffId],
      affectedStudentIds: [],
      suggestedActionAr: "تحقق من حضور الموظف أو اتصل به للتأكد من انخراطه في العمل.",
      period: "الآن",
      linkPath: `/gab-c7x2p/staff-activity`,
    };
  });
}

/** 2. Calls recorded within the last 48h without a result confirmation. */
export async function analyzeCallsWithoutResult(lookbackHours = 48): Promise<AiFinding[]> {
  const cutoff = new Date(Date.now() - lookbackHours * 60 * 60_000);
  const rows = await db
    .select({
      id: callResultsTable.id,
      staffId: callResultsTable.staffId,
      staffName: callResultsTable.staffName,
      studentId: callResultsTable.studentId,
      clickedAt: callResultsTable.clickedAt,
    })
    .from(callResultsTable)
    .where(
      and(
        gte(callResultsTable.clickedAt, cutoff),
        isNull(callResultsTable.result),
      )
    )
    .orderBy(desc(callResultsTable.clickedAt))
    .limit(50);

  if (rows.length === 0) return [];

  const byStaff: Record<number, typeof rows> = {};
  for (const r of rows) {
    if (!byStaff[r.staffId]) byStaff[r.staffId] = [];
    byStaff[r.staffId].push(r);
  }

  const findings: AiFinding[] = [];
  for (const [staffId, calls] of Object.entries(byStaff)) {
    const sid = Number(staffId);
    const name = calls[0]?.staffName ?? `#${sid}`;
    findings.push({
      type: "calls_without_result",
      severity: calls.length >= 5 ? "important" : "warning",
      titleAr: `مكالمات بدون نتيجة: ${name}`,
      descriptionAr: `${name} لديه ${calls.length} مكالمة مسجلة في آخر ${lookbackHours} ساعة دون تأكيد نتيجة.`,
      evidence: calls.slice(0, 5).map(c => `مكالمة بتاريخ ${c.clickedAt.toLocaleString("ar-EG")} مع طالب #${c.studentId}`),
      affectedStaffIds: [sid],
      affectedStudentIds: calls.map(c => c.studentId).filter(Boolean) as number[],
      suggestedActionAr: "اطلب من الموظف تأكيد نتائج المكالمات المفتوحة.",
      period: `آخر ${lookbackHours} ساعة`,
      linkPath: `/gab-c7x2p/staff-activity`,
    });
  }
  return findings;
}

/** 3. Students with overdue follow-up date (not confirmed/paid). */
export async function analyzeStudentsWithoutFollowup(): Promise<AiFinding[]> {
  const now = new Date();
  const rows = await db
    .select({
      id: studentsTable.id,
      firstName: studentsTable.firstName,
      lastName: studentsTable.lastName,
      stage: studentsTable.stage,
      nextFollowupAt: studentsTable.nextFollowupAt,
    })
    .from(studentsTable)
    .where(
      and(
        lt(studentsTable.nextFollowupAt, now),
        isNull(studentsTable.deletedAt),
        not(inArray(studentsTable.stage, ["confirmed", "paid", "dropped"])),
      )
    )
    .orderBy(studentsTable.nextFollowupAt)
    .limit(50);

  if (rows.length === 0) return [];

  const severity: Severity = rows.length >= 10 ? "important" : rows.length >= 5 ? "warning" : "info";
  const overdueCount = rows.length;
  const oldest = rows[0];
  const oldestDays = oldest?.nextFollowupAt
    ? Math.round((now.getTime() - oldest.nextFollowupAt.getTime()) / 86400_000)
    : 0;

  return [{
    type: "students_without_followup",
    severity,
    titleAr: `${overdueCount} طالب بمتابعة متأخرة`,
    descriptionAr: `${overdueCount} طالب تجاوز موعد متابعتهم. أقدمها تأخر ${oldestDays} يوم.`,
    evidence: rows.slice(0, 5).map(r => {
      const days = r.nextFollowupAt ? Math.round((now.getTime() - r.nextFollowupAt.getTime()) / 86400_000) : 0;
      return `${r.firstName} ${r.lastName} — مرحلة: ${r.stage} — تأخر: ${days} يوم`;
    }),
    affectedStaffIds: [],
    affectedStudentIds: rows.map(r => r.id),
    suggestedActionAr: "راجع قائمة المتابعات وأعد جدولتها أو أعد تعيينها.",
    period: "اليوم",
    linkPath: `/gab-c7x2p/students`,
  }];
}

/** 4. Today's checklist completion rate per employee. */
export async function analyzeChecklistCompletion(): Promise<AiFinding[]> {
  const dateKey = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({
      staffId: checklistAssignmentsTable.staffId,
      status: checklistAssignmentsTable.status,
    })
    .from(checklistAssignmentsTable)
    .where(eq(checklistAssignmentsTable.dateKey, dateKey));

  if (rows.length === 0) return [];

  const byStaff: Record<number, { total: number; incomplete: number }> = {};
  for (const r of rows) {
    if (!byStaff[r.staffId]) byStaff[r.staffId] = { total: 0, incomplete: 0 };
    byStaff[r.staffId].total++;
    if (!["done", "completed", "cancelled"].includes(r.status)) {
      byStaff[r.staffId].incomplete++;
    }
  }

  const names = await getStaffNames();
  const findings: AiFinding[] = [];

  for (const [staffId, stats] of Object.entries(byStaff)) {
    const sid = Number(staffId);
    const rate = ((stats.total - stats.incomplete) / stats.total) * 100;
    if (rate < 70) {
      const name = names[sid] ?? `#${sid}`;
      findings.push({
        type: "checklist_low_completion",
        severity: rate < 40 ? "critical" : rate < 60 ? "important" : "warning",
        titleAr: `اكتمال قائمة مهام منخفض: ${name}`,
        descriptionAr: `${name} أكمل ${Math.round(rate)}% فقط من مهام اليوم (${stats.total - stats.incomplete}/${stats.total}).`,
        evidence: [
          `المهام المكتملة: ${stats.total - stats.incomplete}`,
          `المهام المفتوحة: ${stats.incomplete}`,
          `نسبة الإنجاز: ${Math.round(rate)}%`,
          `تاريخ: ${dateKey}`,
        ],
        affectedStaffIds: [sid],
        affectedStudentIds: [],
        suggestedActionAr: "راجع قائمة مهام الموظف وتأكد من تسليم أو إعادة تعيين المهام المتأخرة.",
        period: "اليوم",
        linkPath: `/gab-c7x2p/checklist-admin`,
      });
    }
  }
  return findings;
}

/** 5. Two staff members contacting the same student within a short time window. */
export async function analyzeOverlappingContacts(windowMinutes = 30): Promise<AiFinding[]> {
  const lookback = new Date(Date.now() - 24 * 60 * 60_000);
  const result = await pool.query<{
    student_id: number;
    staff_ids: string;
    staff_names: string;
    contact_times: string;
  }>(`
    SELECT
      student_id,
      string_agg(DISTINCT CAST(staff_id AS text), ',') AS staff_ids,
      string_agg(DISTINCT staff_name, ', ') AS staff_names,
      string_agg(clicked_at::text, ', ' ORDER BY clicked_at) AS contact_times
    FROM call_results
    WHERE clicked_at >= $1
      AND student_id IS NOT NULL
    GROUP BY student_id
    HAVING COUNT(DISTINCT staff_id) > 1
       AND MAX(clicked_at) - MIN(clicked_at) < INTERVAL '${windowMinutes} minutes'
    ORDER BY MIN(clicked_at) DESC
    LIMIT 20
  `, [lookback]);

  if (result.rows.length === 0) return [];

  const studentIds = result.rows.map(r => r.student_id);
  const students = await db
    .select({ id: studentsTable.id, firstName: studentsTable.firstName, lastName: studentsTable.lastName })
    .from(studentsTable)
    .where(inArray(studentsTable.id, studentIds));
  const studentMap = Object.fromEntries(students.map(s => [s.id, `${s.firstName} ${s.lastName}`]));

  return result.rows.map(r => {
    const sName = studentMap[r.student_id] ?? `#${r.student_id}`;
    const staffIds = r.staff_ids.split(",").map(Number);
    return {
      type: "overlapping_staff_contacts",
      severity: "warning" as Severity,
      titleAr: `تواصل مزدوج مع نفس الطالب`,
      descriptionAr: `موظفان تواصلا مع الطالب "${sName}" خلال ${windowMinutes} دقيقة.`,
      evidence: [
        `الطالب: ${sName}`,
        `الموظفون: ${r.staff_names}`,
        `أوقات التواصل: ${r.contact_times}`,
      ],
      affectedStaffIds: staffIds,
      affectedStudentIds: [r.student_id],
      suggestedActionAr: "تأكد من توزيع الطلاب بوضوح وعدم تكرار التواصل.",
      period: "آخر 24 ساعة",
      linkPath: `/gab-c7x2p/students/${r.student_id}`,
    };
  });
}

/** 6. New students with no call attempt within first 2 hours. */
export async function analyzeResponseTime(thresholdHours = 2): Promise<AiFinding[]> {
  const cutoff = new Date(Date.now() - thresholdHours * 60 * 60_000);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60_000);

  const newStudents = await db
    .select({ id: studentsTable.id, firstName: studentsTable.firstName, lastName: studentsTable.lastName, createdAt: studentsTable.createdAt })
    .from(studentsTable)
    .where(
      and(
        gte(studentsTable.createdAt, dayAgo),
        lt(studentsTable.createdAt, cutoff),
        isNull(studentsTable.deletedAt),
        not(inArray(studentsTable.stage, ["dropped"])),
      )
    );

  if (newStudents.length === 0) return [];

  const calledIds = new Set(
    (await db
      .select({ studentId: callResultsTable.studentId })
      .from(callResultsTable)
      .where(
        and(
          gte(callResultsTable.clickedAt, dayAgo),
          inArray(callResultsTable.studentId, newStudents.map(s => s.id)),
        )
      )).map(r => r.studentId)
  );

  const uncalled = newStudents.filter(s => !calledIds.has(s.id));
  if (uncalled.length === 0) return [];

  return [{
    type: "slow_response_time",
    severity: uncalled.length >= 3 ? "important" : "warning",
    titleAr: `${uncalled.length} طالب جديد لم يُتواصل معه`,
    descriptionAr: `${uncalled.length} طالب تسجلوا منذ أكثر من ${thresholdHours} ساعات دون أي محاولة اتصال.`,
    evidence: uncalled.slice(0, 5).map(s => {
      const hoursAgo = Math.round((Date.now() - s.createdAt.getTime()) / 3_600_000);
      return `${s.firstName} ${s.lastName} — منذ ${hoursAgo} ساعة`;
    }),
    affectedStaffIds: [],
    affectedStudentIds: uncalled.map(s => s.id),
    suggestedActionAr: "تواصل مع الطلاب الجدد فوراً لتحقيق أفضل معدل تحويل.",
    period: "آخر 24 ساعة",
    linkPath: `/gab-c7x2p/students`,
  }];
}

/** 7. Students in "interested/considering" stages not contacted in 7+ days. */
export async function analyzeStudentsWithoutContact(): Promise<AiFinding[]> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60_000);
  const rows = await db
    .select({
      id: studentsTable.id,
      firstName: studentsTable.firstName,
      lastName: studentsTable.lastName,
      lastContactedAt: studentsTable.lastContactedAt,
      stage: studentsTable.stage,
    })
    .from(studentsTable)
    .where(
      and(
        isNull(studentsTable.deletedAt),
        inArray(studentsTable.stage, ["new", "interested", "considering", "pending"]),
        and(
          lt(studentsTable.lastContactedAt, cutoff),
        ),
      )
    )
    .orderBy(studentsTable.lastContactedAt)
    .limit(30);

  if (rows.length === 0) return [];

  return [{
    type: "students_without_contact",
    severity: rows.length >= 10 ? "important" : "warning",
    titleAr: `${rows.length} طالب لم يُتواصل معهم منذ 7 أيام`,
    descriptionAr: `${rows.length} طالب في مراحل نشطة لم يُتواصل معهم منذ أكثر من أسبوع.`,
    evidence: rows.slice(0, 5).map(r => {
      const days = r.lastContactedAt
        ? Math.round((Date.now() - r.lastContactedAt.getTime()) / 86400_000)
        : "؟";
      return `${r.firstName} ${r.lastName} — ${r.stage} — آخر تواصل: ${days} يوم`;
    }),
    affectedStaffIds: [],
    affectedStudentIds: rows.map(r => r.id),
    suggestedActionAr: "أعد تعيين هؤلاء الطلاب أو حدد مسؤولاً لمتابعتهم.",
    period: "آخر 7 أيام",
    linkPath: `/gab-c7x2p/students`,
  }];
}

/** 8. Conversion rate analysis (confirmed+paid / total active). */
export async function analyzeConversionRate(): Promise<AiFinding[]> {
  const result = await pool.query<{ stage: string; cnt: string }>(`
    SELECT stage, COUNT(*) as cnt
    FROM students
    WHERE deleted_at IS NULL
    GROUP BY stage
  `);

  const counts: Record<string, number> = {};
  for (const r of result.rows) counts[r.stage] = parseInt(r.cnt, 10);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total < 10) return [{ type: "conversion_rate", severity: "info", titleAr: "معدل التحويل", descriptionAr: INSUFFICIENT, evidence: [], affectedStaffIds: [], affectedStudentIds: [], suggestedActionAr: "انتظر حتى تتراكم بيانات كافية.", period: "الكلي" }];

  const confirmed = (counts["confirmed"] ?? 0) + (counts["paid"] ?? 0);
  const rate = Math.round((confirmed / total) * 100);
  const severity: Severity = rate < 10 ? "important" : rate < 20 ? "warning" : "info";

  return [{
    type: "conversion_rate",
    severity,
    titleAr: `معدل التحويل: ${rate}%`,
    descriptionAr: `من أصل ${total} طالب، تم تأكيد أو دفع ${confirmed} (${rate}%).`,
    evidence: Object.entries(counts).map(([stage, cnt]) => `${stage}: ${cnt}`),
    affectedStaffIds: [],
    affectedStudentIds: [],
    suggestedActionAr: rate < 15 ? "راجع أسلوب المتابعة وجرب استراتيجيات تحويل مختلفة." : "معدل التحويل مقبول، واصل المتابعة.",
    period: "الكلي",
    linkPath: `/gab-c7x2p/pipeline`,
  }];
}

/** Run all analyses. Failures are silenced and excluded. */
export async function runAllAnalyses(idleMin = 20): Promise<AiFinding[]> {
  const results = await Promise.allSettled([
    analyzeIdleStaff(idleMin),
    analyzeCallsWithoutResult(48),
    analyzeStudentsWithoutFollowup(),
    analyzeChecklistCompletion(),
    analyzeOverlappingContacts(30),
    analyzeResponseTime(2),
    analyzeStudentsWithoutContact(),
    analyzeConversionRate(),
  ]);
  return results.flatMap(r => r.status === "fulfilled" ? r.value : []);
}

/** Top severity from a list of findings. */
export function topSeverity(findings: AiFinding[]): Severity {
  const order: Severity[] = ["critical", "important", "warning", "info"];
  for (const s of order) {
    if (findings.some(f => f.severity === s)) return s;
  }
  return "info";
}

/** Per-employee performance KPIs for a date range. */
export async function getStaffPerformance(fromDate: Date, toDate: Date): Promise<object[]> {
  const result = await pool.query<{
    staff_id: number;
    full_name: string;
    role: string;
    login_count: string;
    last_active: string | null;
    actions: string;
    students_opened: string;
    contacts_made: string;
    calls_with_result: string;
    calls_without_result: string;
    notes_added: string;
    tasks_completed: string;
    tasks_late: string;
    followups_completed: string;
    checklist_done: string;
    checklist_total: string;
  }>(`
    SELECT
      s.id AS staff_id,
      s.full_name,
      s.role,
      COUNT(DISTINCT ss.id) AS login_count,
      MAX(ss.last_heartbeat_at) AS last_active,
      COUNT(DISTINCT al.id) AS actions,
      COUNT(DISTINCT CASE WHEN al.entity_type = 'student' THEN al.entity_id END) AS students_opened,
      COUNT(DISTINCT CASE WHEN al.action_type = 'contact' OR al.action IN ('whatsapp_click','call_click') THEN al.id END) AS contacts_made,
      COUNT(DISTINCT CASE WHEN cr.result IS NOT NULL THEN cr.id END) AS calls_with_result,
      COUNT(DISTINCT CASE WHEN cr.result IS NULL THEN cr.id END) AS calls_without_result,
      COUNT(DISTINCT CASE WHEN al.action_type = 'note_added' OR al.action = 'note_added' THEN al.id END) AS notes_added,
      COUNT(DISTINCT CASE WHEN ft.completed = true THEN ft.id END) AS tasks_completed,
      COUNT(DISTINCT CASE WHEN ft.completed = false AND ft.due_at < NOW() THEN ft.id END) AS tasks_late,
      COUNT(DISTINCT CASE WHEN ft.completed = true AND ft.due_at IS NOT NULL AND ft.completed_at > ft.due_at THEN ft.id END) AS followups_completed,
      COUNT(DISTINCT CASE WHEN ca.status IN ('done','completed') THEN ca.id END) AS checklist_done,
      COUNT(DISTINCT ca.id) AS checklist_total
    FROM staff s
    LEFT JOIN staff_sessions ss ON ss.staff_id = s.id AND ss.started_at BETWEEN $1 AND $2
    LEFT JOIN activity_logs al ON al.employee_id = s.id AND al.created_at BETWEEN $1 AND $2
    LEFT JOIN call_results cr ON cr.staff_id = s.id AND cr.clicked_at BETWEEN $1 AND $2
    LEFT JOIN followup_tasks ft ON ft.assigned_to = s.id AND ft.created_at BETWEEN $1 AND $2
    LEFT JOIN checklist_assignments ca ON ca.staff_id = s.id AND ca.created_at BETWEEN $1 AND $2
    WHERE s.id IS NOT NULL
    GROUP BY s.id, s.full_name, s.role
    ORDER BY COUNT(DISTINCT al.id) DESC
  `, [fromDate, toDate]);

  return result.rows.map(r => ({
    staffId: r.staff_id,
    fullName: r.full_name,
    role: r.role,
    loginCount: parseInt(r.login_count, 10),
    lastActive: r.last_active,
    totalActions: parseInt(r.actions, 10),
    studentsOpened: parseInt(r.students_opened, 10),
    contactsMade: parseInt(r.contacts_made, 10),
    callsWithResult: parseInt(r.calls_with_result, 10),
    callsWithoutResult: parseInt(r.calls_without_result, 10),
    notesAdded: parseInt(r.notes_added, 10),
    tasksCompleted: parseInt(r.tasks_completed, 10),
    tasksLate: parseInt(r.tasks_late, 10),
    followupsCompleted: parseInt(r.followups_completed, 10),
    checklistDone: parseInt(r.checklist_done, 10),
    checklistTotal: parseInt(r.checklist_total, 10),
    checklistRate: r.checklist_total === "0" ? null : Math.round((parseInt(r.checklist_done, 10) / parseInt(r.checklist_total, 10)) * 100),
  }));
}
