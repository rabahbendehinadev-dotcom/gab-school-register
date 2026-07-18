import { Router, type IRouter } from "express";
import { pool, db, staffTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requirePermission, requireAnyPermission } from "../middlewares/auth";
import { runAllAnalyses, getStaffPerformance, DEFAULT_SETTINGS } from "../lib/aiControl";
import "../types/session";

const router: IRouter = Router();

// ── AI REPORTS ─────────────────────────────────────────────────────────────

/** GET /ai/reports — paginated list, filterable */
router.get("/ai/reports", requirePermission("view_ai_control"), async (req, res): Promise<void> => {
  const limit  = Math.min(parseInt(String(req.query.limit  ?? "50"), 10), 200);
  const offset = parseInt(String(req.query.offset ?? "0"), 10);
  const severity = req.query.severity as string | undefined;
  const type     = req.query.type     as string | undefined;
  const fromDate = req.query.from     as string | undefined;
  const toDate   = req.query.to       as string | undefined;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (severity) { params.push(severity); conditions.push(`severity = $${params.length}`); }
  if (type)     { params.push(type);     conditions.push(`report_type = $${params.length}`); }
  if (fromDate) { params.push(fromDate); conditions.push(`generated_at >= $${params.length}`); }
  if (toDate)   { params.push(toDate);   conditions.push(`generated_at <= $${params.length}`); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  params.push(limit, offset);
  const rows = await pool.query(
    `SELECT id, report_type, severity, findings, is_read, generated_at
     FROM ai_reports ${where}
     ORDER BY generated_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM ai_reports ${where}`,
    params.slice(0, -2)
  );
  res.json({ total: parseInt(countResult.rows[0].count, 10), rows: rows.rows });
});

/** GET /ai/reports/:id — single report, marks as read */
router.get("/ai/reports/:id", requirePermission("view_ai_control"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const result = await pool.query(
    `UPDATE ai_reports SET is_read = true WHERE id = $1
     RETURNING id, report_type, severity, findings, is_read, generated_at`,
    [id]
  );
  if (!result.rows.length) { res.status(404).json({ error: "Not found" }); return; }
  res.json(result.rows[0]);
});

/**
 * GET /ai/alerts/active — unread warning/important/critical alerts
 * from the last 48 h, or any unread. Ordered by severity then date.
 */
router.get("/ai/alerts/active", requirePermission("view_ai_control"), async (_req, res): Promise<void> => {
  const result = await pool.query(`
    SELECT id, report_type, severity, findings, is_read, generated_at
    FROM ai_reports
    WHERE severity IN ('warning','important','critical')
      AND (is_read = false OR generated_at > NOW() - INTERVAL '48 hours')
    ORDER BY
      CASE severity WHEN 'critical' THEN 1 WHEN 'important' THEN 2 WHEN 'warning' THEN 3 ELSE 4 END,
      generated_at DESC
    LIMIT 50
  `);
  res.json(result.rows);
});

/** GET /ai/alerts/unread-count — badge count (warning+ unread) */
router.get("/ai/alerts/unread-count", requirePermission("view_ai_control"), async (_req, res): Promise<void> => {
  const result = await pool.query(`
    SELECT COUNT(*) FROM ai_reports
    WHERE is_read = false AND severity IN ('warning','important','critical')
  `);
  res.json({ count: parseInt(result.rows[0].count, 10) });
});

/** POST /ai/reports/run — manual trigger */
router.post("/ai/reports/run", requirePermission("view_ai_control"), async (req, res): Promise<void> => {
  const body = req.body as Record<string, string | number> | undefined;
  const settings = {
    idleThresholdMin:            Number(body?.idleMin            ?? DEFAULT_SETTINGS.idleThresholdMin),
    lateResponseThresholdH:      Number(body?.lateResponseH      ?? DEFAULT_SETTINGS.lateResponseThresholdH),
    callsWithoutResultThreshold: Number(body?.callsThreshold     ?? DEFAULT_SETTINGS.callsWithoutResultThreshold),
  };
  const findings = await runAllAnalyses(settings);
  const sev = findings.some(f => f.severity === "critical")  ? "critical"
            : findings.some(f => f.severity === "important") ? "important"
            : findings.some(f => f.severity === "warning")   ? "warning"
            : "info";

  const result = await pool.query(
    `INSERT INTO ai_reports (report_type, severity, findings) VALUES ($1, $2, $3) RETURNING id`,
    ["manual", sev, JSON.stringify(findings)]
  );
  res.json({ id: result.rows[0]?.id, findings, severity: sev, count: findings.length });
});

/** POST /ai/reports/:id/read — mark one as read */
router.post("/ai/reports/:id/read", requirePermission("view_ai_control"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  await pool.query(`UPDATE ai_reports SET is_read = true WHERE id = $1`, [id]);
  res.json({ success: true });
});

/** POST /ai/reports/read-all — mark all as read */
router.post("/ai/reports/read-all", requirePermission("view_ai_control"), async (_req, res): Promise<void> => {
  await pool.query(`UPDATE ai_reports SET is_read = true`);
  res.json({ success: true });
});

// ── AI SETTINGS ─────────────────────────────────────────────────────────────

const AI_KEYS = [
  "ai_scheduler_enabled",
  "ai_idle_threshold_min",
  "ai_late_response_threshold_h",
  "ai_calls_without_result_threshold",
  "ai_critical_alert_interval_min",
  "ai_3h_interval_h",
  "ai_midday_hour",
  "ai_eod_hour",
  "ai_weekly_day",
  "ai_weekly_hour",
];

const AI_DEFAULTS: Record<string, string> = {
  ai_scheduler_enabled:               "true",
  ai_idle_threshold_min:              String(DEFAULT_SETTINGS.idleThresholdMin),
  ai_late_response_threshold_h:       String(DEFAULT_SETTINGS.lateResponseThresholdH),
  ai_calls_without_result_threshold:  String(DEFAULT_SETTINGS.callsWithoutResultThreshold),
  ai_critical_alert_interval_min:     "10",
  ai_3h_interval_h:                   "3",
  ai_midday_hour:                     "12",
  ai_eod_hour:                        "20",
  ai_weekly_day:                      "1",
  ai_weekly_hour:                     "8",
};

router.get("/ai/settings", requireAnyPermission("view_ai_control", "manage_ai_control"), async (_req, res): Promise<void> => {
  const result = await pool.query(`SELECT key, value FROM settings WHERE key = ANY($1)`, [AI_KEYS]);
  const out = { ...AI_DEFAULTS };
  for (const r of result.rows) out[r.key] = r.value;
  res.json(out);
});

router.put("/ai/settings", requirePermission("manage_ai_control"), async (req, res): Promise<void> => {
  const body = req.body as Record<string, string>;
  for (const key of AI_KEYS) {
    if (key in body) {
      await pool.query(
        `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
        [key, String(body[key])]
      );
    }
  }
  res.json({ success: true });
});

// ── NOTIFICATION PREFERENCES (admin-managed, employees cannot self-edit) ─────

const DEFAULT_NOTIF_SETTINGS = {
  enabled: true,
  pref: "during_shift",
  push: true,
  tasks: true,
  newStudents: true,
  followups: true,
  checklist: true,
  ai: true,
  sound: true,
  reminderIntervalMin: 60,
};

function mergedSettings(raw: unknown) {
  return { ...DEFAULT_NOTIF_SETTINGS, ...(typeof raw === "object" && raw !== null ? raw : {}) };
}

/** GET /ai/notification-prefs — list all staff with full notification settings (admin/owner) */
router.get("/ai/notification-prefs", requireAnyPermission("manage_ai_control", "manage_staff"), async (_req, res): Promise<void> => {
  const result = await pool.query(
    `SELECT id, full_name, role, notification_settings FROM staff ORDER BY full_name`
  );
  const rows = result.rows.map((r: any) => ({
    id: r.id,
    fullName: r.full_name,
    role: r.role,
    settings: mergedSettings(r.notification_settings),
  }));
  res.json(rows);
});

/** PUT /ai/notification-prefs/:staffId — owner or admin sets a staff member's notification settings */
router.put("/ai/notification-prefs/:staffId", requireAnyPermission("manage_ai_control", "manage_staff"), async (req, res): Promise<void> => {
  const staffId = parseInt(req.params.staffId, 10);
  const body = req.body as Record<string, unknown>;
  const current = await pool.query(`SELECT notification_settings FROM staff WHERE id = $1`, [staffId]);
  const existing = mergedSettings(current.rows[0]?.notification_settings);
  const merged = { ...existing, ...body };
  await pool.query(`UPDATE staff SET notification_settings = $1 WHERE id = $2`, [JSON.stringify(merged), staffId]);
  res.json({ success: true, settings: merged });
});

/**
 * GET /ai/my-notification-pref — read own admin-set settings (read-only for staff).
 * Used by scheduler/push to know the policy for this staff member.
 */
router.get("/ai/my-notification-pref", async (req, res): Promise<void> => {
  const staffId = (req.session as any)?.staffId ?? (req.session as any)?.userId;
  if (!staffId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const result = await pool.query(
    `SELECT notification_settings FROM staff WHERE id = $1`, [staffId]
  );
  const settings = mergedSettings(result.rows[0]?.notification_settings);
  res.json({ settings });
});

/**
 * PUT /ai/my-notification-pref — DISABLED: employees cannot change their own settings.
 * Notification settings are managed exclusively by admin/owner.
 */
router.put("/ai/my-notification-pref", async (_req, res): Promise<void> => {
  res.status(403).json({ error: "إعدادات الإشعارات يديرها الإدارة فقط. يرجى التواصل مع المسؤول." });
});

// ── EMPLOYEE PERFORMANCE REPORTS ─────────────────────────────────────────────

/** GET /ai/staff-performance?from=YYYY-MM-DD&to=YYYY-MM-DD */
router.get("/ai/staff-performance", requireAnyPermission("view_ai_control", "manage_staff"), async (req, res): Promise<void> => {
  const defaultTo   = new Date().toISOString().slice(0, 10);
  const defaultFrom = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

  const fromDate = new Date(String(req.query.from ?? defaultFrom) + "T00:00:00Z");
  const toDate   = new Date(String(req.query.to   ?? defaultTo)   + "T23:59:59Z");

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    res.status(400).json({ error: "Invalid date range" }); return;
  }

  const data = await getStaffPerformance(fromDate, toDate);
  res.json(data);
});

export default router;
