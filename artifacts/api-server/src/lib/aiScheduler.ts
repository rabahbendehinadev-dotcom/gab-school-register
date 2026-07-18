/**
 * AI Scheduler — periodic report generation.
 * Runs analyses on schedule and stores results in ai_reports table.
 * Sends push notifications to accounts with receive_ai_alerts permission.
 */
import { pool, db, staffTable, rolesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { runAllAnalyses, topSeverity, type AiFinding, type Severity } from "./aiControl";
import { sendPushToStaff, type PushPayload } from "./webPush";

async function getAiSetting(key: string, fallback: string): Promise<string> {
  const result = await pool.query<{ value: string }>(
    `SELECT value FROM settings WHERE key = $1 LIMIT 1`, [key]
  );
  return result.rows[0]?.value ?? fallback;
}

async function storeReport(reportType: string, severity: Severity, findings: AiFinding[]): Promise<number> {
  const result = await pool.query<{ id: number }>(
    `INSERT INTO ai_reports (report_type, severity, findings) VALUES ($1, $2, $3) RETURNING id`,
    [reportType, severity, JSON.stringify(findings)]
  );
  return result.rows[0]?.id ?? 0;
}

async function getStaffWithPermission(permission: string): Promise<number[]> {
  const allStaff = await db.select({ id: staffTable.id, roleId: staffTable.roleId, role: staffTable.role }).from(staffTable);
  const roles = await db.select({ name: rolesTable.name, permissions: rolesTable.permissions }).from(rolesTable);
  const roleMap = Object.fromEntries(roles.map(r => [r.name, r.permissions as string[]]));

  return allStaff
    .filter(s => {
      const perms = roleMap[s.role] ?? [];
      return perms.includes(permission);
    })
    .map(s => s.id);
}

async function notifyAlertRecipients(findings: AiFinding[], reportType: string): Promise<void> {
  const criticalFindings = findings.filter(f => f.severity === "critical" || f.severity === "important");
  if (criticalFindings.length === 0) return;

  const staffIds = await getStaffWithPermission("receive_ai_alerts");
  if (staffIds.length === 0) return;

  const payload: PushPayload = {
    title: `🔔 تنبيه تحكم — ${criticalFindings.length} تنبيه`,
    body: criticalFindings[0].titleAr,
    url: "/gab-c7x2p/ai-control",
    tag: `ai-alert-${reportType}`,
  };

  await Promise.allSettled(staffIds.map(id => sendPushToStaff(id, payload)));
}

async function runReport(reportType: string): Promise<void> {
  try {
    const enabled = await getAiSetting("ai_scheduler_enabled", "true");
    if (enabled === "false") return;

    const idleMin = parseInt(await getAiSetting("ai_idle_threshold_min", "20"), 10);
    const findings = await runAllAnalyses(idleMin);
    const severity = topSeverity(findings);

    await storeReport(reportType, severity, findings);
    await notifyAlertRecipients(findings, reportType);

    console.log(`[aiScheduler] ${reportType} report generated: ${findings.length} findings, severity=${severity}`);
  } catch (err) {
    console.error(`[aiScheduler] ${reportType} failed:`, err);
  }
}

async function runCriticalCheck(): Promise<void> {
  try {
    const enabled = await getAiSetting("ai_scheduler_enabled", "true");
    if (enabled === "false") return;

    const idleMin = parseInt(await getAiSetting("ai_idle_threshold_min", "20"), 10);
    const findings = await runAllAnalyses(idleMin);
    const criticals = findings.filter(f => f.severity === "critical");

    if (criticals.length > 0) {
      await storeReport("critical_alert", "critical", criticals);
      await notifyAlertRecipients(criticals, "critical_alert");
      console.log(`[aiScheduler] Critical check: ${criticals.length} critical findings → alerted`);
    }
  } catch (err) {
    console.error("[aiScheduler] Critical check failed:", err);
  }
}

let schedulerStarted = false;

export function startAiScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const THREE_HOURS = 3 * 60 * 60_000;
  const TEN_MINUTES = 10 * 60_000;

  // Critical alert check every 10 minutes
  setInterval(runCriticalCheck, TEN_MINUTES);

  // Full summary report every 3 hours
  setInterval(() => runReport("3h_summary"), THREE_HOURS);

  // Mid-day report: check every 30 min, fire once per day around noon
  let lastMidday = "";
  setInterval(() => {
    const now = new Date();
    const dayKey = now.toISOString().slice(0, 10);
    const hour = now.getHours();
    if (hour === 12 && lastMidday !== dayKey) {
      lastMidday = dayKey;
      runReport("midday_report");
    }
  }, 30 * 60_000);

  // End-of-day report: check every 30 min, fire once per day around 8 PM
  let lastEod = "";
  setInterval(() => {
    const now = new Date();
    const dayKey = now.toISOString().slice(0, 10);
    const hour = now.getHours();
    if (hour === 20 && lastEod !== dayKey) {
      lastEod = dayKey;
      runReport("end_of_day");
    }
  }, 30 * 60_000);

  console.log("[aiScheduler] AI scheduler started (critical: 10min, summary: 3h, midday: 12:00, EOD: 20:00)");
}
