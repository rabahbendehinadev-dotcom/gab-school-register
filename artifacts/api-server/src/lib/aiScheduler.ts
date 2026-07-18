/**
 * AI Scheduler — periodic report generation.
 * Schedule: critical check (10 min), 3-hour summary, midday, EOD, weekly.
 * All intervals read from settings at call time so no restart required
 * for threshold changes (timer interval itself is fixed at startup).
 */
import { pool, db, staffTable, rolesTable } from "@workspace/db";
import { runAllAnalyses, topSeverity, DEFAULT_SETTINGS, type AiFinding, type Severity } from "./aiControl";
import { sendPushToStaff, type PushPayload } from "./webPush";

// ── Settings helpers ────────────────────────────────────────────────────────

async function getSetting(key: string, fallback: string): Promise<string> {
  const r = await pool.query<{ value: string }>(`SELECT value FROM settings WHERE key=$1 LIMIT 1`, [key]);
  return r.rows[0]?.value ?? fallback;
}

async function getAnalysisSettings() {
  const [idle, resp, calls] = await Promise.all([
    getSetting("ai_idle_threshold_min",              String(DEFAULT_SETTINGS.idleThresholdMin)),
    getSetting("ai_late_response_threshold_h",       String(DEFAULT_SETTINGS.lateResponseThresholdH)),
    getSetting("ai_calls_without_result_threshold",  String(DEFAULT_SETTINGS.callsWithoutResultThreshold)),
  ]);
  return {
    idleThresholdMin:             parseInt(idle,  10),
    lateResponseThresholdH:       parseInt(resp,  10),
    callsWithoutResultThreshold:  parseInt(calls, 10),
  };
}

// ── Notification helpers ────────────────────────────────────────────────────

/**
 * Returns staff IDs that hold receive_ai_alerts AND whose notification_pref
 * allows the given severity.
 * notification_pref values: "during_shift" | "always" | "critical_only" | "off"
 */
async function getAlertRecipients(severity: Severity): Promise<number[]> {
  // Use raw query to access notification_pref column (added via migration, not in Drizzle schema)
  const result = await pool.query<{ id: number; notification_pref: string; role: string }>(`
    SELECT s.id, COALESCE(s.notification_pref, 'during_shift') AS notification_pref, s.role
    FROM staff s
  `);
  const roles = await db.select({ name: rolesTable.name, permissions: rolesTable.permissions }).from(rolesTable);
  const roleMap = Object.fromEntries(roles.map(r => [r.name, (r.permissions as string[]) ?? []]));

  const now = new Date();
  const hour = now.getHours();

  return result.rows
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
  const critical = findings.filter(f => f.severity === "critical" || f.severity === "important");
  if (critical.length === 0) return;

  const topSev = critical.some(f => f.severity === "critical") ? "critical" as Severity : "important" as Severity;
  const staffIds = await getAlertRecipients(topSev);
  if (staffIds.length === 0) return;

  const payload: PushPayload = {
    title: `تنبيه — ${critical.length} تنبيه مهم`,
    body: critical[0].titleAr,
    url: "/gab-c7x2p/ai-control",
    tag: `ai-alert-${tag}`,
  };

  await Promise.allSettled(staffIds.map(id => sendPushToStaff(id, payload)));
}

// ── Report store & run ──────────────────────────────────────────────────────

async function storeReport(type: string, severity: Severity, findings: AiFinding[]): Promise<void> {
  await pool.query(
    `INSERT INTO ai_reports (report_type, severity, findings) VALUES ($1, $2, $3)`,
    [type, severity, JSON.stringify(findings)]
  );
  // Prune: keep only last 500 reports to avoid unbounded growth
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

async function runCriticalCheck(): Promise<void> {
  try {
    const enabled = await getSetting("ai_scheduler_enabled", "true");
    if (enabled === "false") return;

    const settings = await getAnalysisSettings();
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

// ── Scheduler startup ───────────────────────────────────────────────────────

let started = false;

export function startAiScheduler(): void {
  if (started) return;
  started = true;

  // Critical: every 10 minutes
  setInterval(runCriticalCheck, 10 * 60_000);

  // 3-hour rolling summary
  setInterval(() => runReport("3h_summary"), 3 * 60 * 60_000);

  // Midday, EOD, Weekly — checked every 15 min to avoid drift
  const fired: Record<string, string> = { midday: "", eod: "", weekly: "" };

  setInterval(() => {
    const now    = new Date();
    const hour   = now.getHours();
    const dayKey = now.toISOString().slice(0, 10);
    const weekKey = `${now.getFullYear()}-W${Math.ceil((now.getDate() + new Date(now.getFullYear(), 0, 1).getDay()) / 7)}`;

    if (hour === 12 && fired.midday !== dayKey) {
      fired.midday = dayKey;
      runReport("midday_report");
    }
    if (hour === 20 && fired.eod !== dayKey) {
      fired.eod = dayKey;
      runReport("end_of_day");
    }
    // Weekly: every Monday at 08:00
    if (now.getDay() === 1 && hour === 8 && fired.weekly !== weekKey) {
      fired.weekly = weekKey;
      runReport("weekly_summary");
    }
  }, 15 * 60_000);

  console.log("[aiScheduler] AI scheduler started (critical:10m, 3h, midday:12h, EOD:20h, weekly:Mon8h)");
}
