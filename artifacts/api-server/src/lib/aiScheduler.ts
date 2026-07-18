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
      // critical_only: only send for critical findings
      if (pref === "critical_only" && severity !== "critical") return false;
      // during_shift: send warning/important/critical during working hours (06:00–22:00)
      if (pref === "during_shift" && (hour < 6 || hour >= 22)) return false;
      // always: all severities including warning, no time restriction
      // warning and above are included for always + during_shift
      return true;
    })
    .map(s => s.id);
}

async function getScheduleSettings() {
  const keys = [
    "ai_3h_interval_h", "ai_midday_hour", "ai_eod_hour",
    "ai_weekly_day", "ai_weekly_hour",
  ];
  const result = await pool.query<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key = ANY($1)`, [keys]
  );
  const m: Record<string, string> = {};
  for (const r of result.rows) m[r.key] = r.value;
  return {
    interval3h:  parseInt(m.ai_3h_interval_h ?? "3",  10),
    middayHour:  parseInt(m.ai_midday_hour   ?? "12", 10),
    eodHour:     parseInt(m.ai_eod_hour      ?? "20", 10),
    weeklyDay:   parseInt(m.ai_weekly_day    ?? "1",  10),
    weeklyHour:  parseInt(m.ai_weekly_hour   ?? "8",  10),
  };
}

async function notifyRecipients(findings: AiFinding[], tag: string): Promise<void> {
  // Notify for warning and above — recipients are filtered per their pref
  const notable = findings.filter(f => f.severity !== "info");
  if (notable.length === 0) return;
  const topSev: Severity = notable.some(f => f.severity === "critical")  ? "critical"
                          : notable.some(f => f.severity === "important") ? "important"
                          : "warning";
  const staffIds = await getAlertRecipients(topSev);
  if (staffIds.length === 0) return;
  const payload: PushPayload = {
    title: `تنبيه — ${notable.length} تنبيه`,
    body: notable[0].titleAr,
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

  // 3-hour rolling summary — interval is configurable, checked every 5 min
  let last3h = 0;
  setInterval(async () => {
    const { interval3h } = await getScheduleSettings();
    const elapsedH = (Date.now() - last3h) / 3_600_000;
    if (elapsedH >= interval3h) { last3h = Date.now(); runReport("3h_summary"); }
  }, 5 * 60_000);

  // Midday, EOD, Weekly — checked every 15 min, timings read from settings
  const fired: Record<string, string> = { midday: "", eod: "", weekly: "" };
  setInterval(async () => {
    const now = new Date();
    const hour   = now.getHours();
    const dayKey = now.toISOString().slice(0, 10);
    const { middayHour, eodHour, weeklyDay, weeklyHour } = await getScheduleSettings();
    const weekKey = `${now.getFullYear()}-${now.getDay()}-${dayKey}`;

    if (hour === middayHour && fired.midday !== dayKey)  { fired.midday = dayKey; runReport("midday_report"); }
    if (hour === eodHour    && fired.eod   !== dayKey)   { fired.eod   = dayKey; runReport("end_of_day"); }
    if (now.getDay() === weeklyDay && hour === weeklyHour && fired.weekly !== weekKey) {
      fired.weekly = weekKey; runReport("weekly_summary");
    }
  }, 15 * 60_000);

  console.log("[aiScheduler] AI scheduler started (critical:dynamic, 3h, midday:12h, EOD:20h, weekly:Mon8h)");
}
