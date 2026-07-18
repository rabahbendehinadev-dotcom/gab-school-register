/**
 * AI Scheduler — periodic report generation.
 * Schedule: critical check (configurable, default 10 min), 3h summary,
 * midday (12:00), EOD (20:00), weekly (Mon 08:00).
 * All thresholds read from settings DB at call time — no restart required.
 * Critical interval read from ai_critical_alert_interval_min each tick.
 */
import { pool, db, rolesTable } from "@workspace/db";
import { runAllAnalyses, topSeverity, DEFAULT_SETTINGS, type AiFinding, type Severity } from "./aiControl";
import { sendPushToStaff, type PushPayload } from "./webPush";

// ── Settings ───────────────────────────────────────────────────────────────

async function getSetting(key: string, fallback: string): Promise<string> {
  const r = await pool.query<{ value: string }>(`SELECT value FROM settings WHERE key=$1 LIMIT 1`, [key]);
  return r.rows[0]?.value ?? fallback;
}

async function getAnalysisSettings() {
  const [idle, resp, calls] = await Promise.all([
    getSetting("ai_idle_threshold_min",             String(DEFAULT_SETTINGS.idleThresholdMin)),
    getSetting("ai_late_response_threshold_h",      String(DEFAULT_SETTINGS.lateResponseThresholdH)),
    getSetting("ai_calls_without_result_threshold", String(DEFAULT_SETTINGS.callsWithoutResultThreshold)),
  ]);
  return {
    idleThresholdMin:            parseInt(idle,  10),
    lateResponseThresholdH:      parseInt(resp,  10),
    callsWithoutResultThreshold: parseInt(calls, 10),
  };
}

// ── Recipients ─────────────────────────────────────────────────────────────

async function getAlertRecipients(severity: Severity): Promise<number[]> {
  const staff = await pool.query<{ id: number; role: string; notification_pref: string }>(`
    SELECT id, role, COALESCE(notification_pref, 'during_shift') AS notification_pref FROM staff
  `);
  const roles = await db.select({ name: rolesTable.name, permissions: rolesTable.permissions }).from(rolesTable);
  const roleMap = Object.fromEntries(roles.map(r => [r.name, (r.permissions as string[]) ?? []]));

  const hour = new Date().getHours();
  return staff.rows
    .filter(s => {
      if (!(roleMap[s.role] ?? []).includes("receive_ai_alerts")) return false;
      const pref = s.notification_pref;
      if (pref === "off") return false;
      if (pref === "critical_only" && severity !== "critical") return false;
      if (pref === "during_shift" && (hour < 6 || hour >= 22)) return false;
      return true;
    })
    .map(s => s.id);
}

async function notifyRecipients(findings: AiFinding[], tag: string): Promise<void> {
  const urgent = findings.filter(f => f.severity === "critical" || f.severity === "important");
  if (urgent.length === 0) return;
  const topSev: Severity = urgent.some(f => f.severity === "critical") ? "critical" : "important";
  const staffIds = await getAlertRecipients(topSev);
  if (staffIds.length === 0) return;
  const payload: PushPayload = {
    title: `تنبيه — ${urgent.length} تنبيه مهم`,
    body: urgent[0].titleAr,
    url: "/gab-c7x2p/ai-control",
    tag: `ai-alert-${tag}`,
  };
  await Promise.allSettled(staffIds.map(id => sendPushToStaff(id, payload)));
}

// ── Store & run ────────────────────────────────────────────────────────────

async function storeReport(type: string, severity: Severity, findings: AiFinding[]): Promise<void> {
  await pool.query(
    `INSERT INTO ai_reports (report_type, severity, findings) VALUES ($1, $2, $3)`,
    [type, severity, JSON.stringify(findings)]
  );
  // Prune to last 500 reports
  await pool.query(`
    DELETE FROM ai_reports WHERE id NOT IN (
      SELECT id FROM ai_reports ORDER BY generated_at DESC LIMIT 500
    )
  `).catch(() => {});
}

async function runReport(type: string): Promise<void> {
  try {
    const enabled = await getSetting("ai_scheduler_enabled", "true");
    if (enabled === "false") return;
    const settings = await getAnalysisSettings();
    const findings = await runAllAnalyses(settings);
    const severity  = topSeverity(findings);
    await storeReport(type, severity, findings);
    await notifyRecipients(findings, type);
    console.log(`[aiScheduler] ${type}: ${findings.length} findings, severity=${severity}`);
  } catch (err) {
    console.error(`[aiScheduler] ${type} failed:`, err);
  }
}

// Critical check: uses ai_critical_alert_interval_min to decide whether to act.
// Runs on a base 1-minute setInterval; acts only when the configured interval has elapsed.
let lastCriticalAt = 0;

async function runCriticalCheck(): Promise<void> {
  try {
    const enabled     = await getSetting("ai_scheduler_enabled", "true");
    if (enabled === "false") return;

    const intervalMin = parseInt(await getSetting("ai_critical_alert_interval_min", "10"), 10);
    const elapsedMin  = (Date.now() - lastCriticalAt) / 60_000;
    if (elapsedMin < intervalMin) return;
    lastCriticalAt = Date.now();

    const settings  = await getAnalysisSettings();
    const findings  = await runAllAnalyses(settings);
    const criticals = findings.filter(f => f.severity === "critical");
    if (criticals.length > 0) {
      await storeReport("critical_alert", "critical", criticals);
      await notifyRecipients(criticals, "critical_alert");
      console.log(`[aiScheduler] Critical check: ${criticals.length} critical findings → alerted`);
    }
  } catch (err) {
    console.error("[aiScheduler] Critical check failed:", err);
  }
}

// ── Startup ────────────────────────────────────────────────────────────────

let started = false;

export function startAiScheduler(): void {
  if (started) return;
  started = true;

  // Critical: base tick every 1 minute; actual firing determined by ai_critical_alert_interval_min setting
  setInterval(runCriticalCheck, 60_000);

  // 3-hour rolling summary
  setInterval(() => runReport("3h_summary"), 3 * 60 * 60_000);

  // Midday, EOD, Weekly — checked every 15 min
  const fired: Record<string, string> = { midday: "", eod: "", weekly: "" };
  setInterval(() => {
    const now     = new Date();
    const hour    = now.getHours();
    const dayKey  = now.toISOString().slice(0, 10);
    const weekKey = `${now.getFullYear()}-W${now.getDay() === 1 ? dayKey : ""}`;

    if (hour === 12 && fired.midday !== dayKey) { fired.midday = dayKey; runReport("midday_report"); }
    if (hour === 20 && fired.eod   !== dayKey) { fired.eod   = dayKey; runReport("end_of_day"); }
    // Weekly: every Monday at 08:00
    if (now.getDay() === 1 && hour === 8 && fired.weekly !== weekKey) {
      fired.weekly = weekKey; runReport("weekly_summary");
    }
  }, 15 * 60_000);

  console.log("[aiScheduler] AI scheduler started (critical:dynamic, 3h, midday:12h, EOD:20h, weekly:Mon8h)");
}
