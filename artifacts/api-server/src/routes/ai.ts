import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requirePermission, requireAnyPermission } from "../middlewares/auth";
import { runAllAnalyses, getStaffPerformance } from "../lib/aiControl";
import "../types/session";

const router: IRouter = Router();

// ── AI REPORTS ─────────────────────────────────────────────────────────────

/** GET /ai/reports — paginated list, filterable by severity/type/date */
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
  const result = await pool.query(
    `SELECT id, report_type, severity, findings, is_read, generated_at
     FROM ai_reports
     ${where}
     ORDER BY generated_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const countResult = await pool.query(`SELECT COUNT(*) FROM ai_reports ${where}`, params.slice(0, -2));
  res.json({ total: parseInt(countResult.rows[0].count, 10), rows: result.rows });
});

/** GET /ai/reports/:id — single report detail */
router.get("/ai/reports/:id", requirePermission("view_ai_control"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const result = await pool.query(
    `UPDATE ai_reports SET is_read = true WHERE id = $1
     RETURNING id, report_type, severity, findings, is_read, generated_at`,
    [id]
  );
  if (result.rows.length === 0) { res.status(404).json({ error: "Not found" }); return; }
  res.json(result.rows[0]);
});

/** GET /ai/alerts/active — unread alerts with severity warning/important/critical */
router.get("/ai/alerts/active", requirePermission("view_ai_control"), async (_req, res): Promise<void> => {
  const result = await pool.query(`
    SELECT id, report_type, severity, findings, is_read, generated_at
    FROM ai_reports
    WHERE severity IN ('warning','important','critical')
    ORDER BY generated_at DESC
    LIMIT 50
  `);
  res.json(result.rows);
});

/** GET /ai/alerts/unread-count — badge count for nav */
router.get("/ai/alerts/unread-count", requirePermission("view_ai_control"), async (_req, res): Promise<void> => {
  const result = await pool.query(`
    SELECT COUNT(*) FROM ai_reports
    WHERE is_read = false AND severity IN ('important','critical')
  `);
  res.json({ count: parseInt(result.rows[0].count, 10) });
});

/** POST /ai/reports/run — manual trigger (admin/owner) */
router.post("/ai/reports/run", requirePermission("view_ai_control"), async (req, res): Promise<void> => {
  const idleMin = parseInt(String(req.body?.idleMin ?? "20"), 10);
  const findings = await runAllAnalyses(idleMin);

  const sev = findings.some(f => f.severity === "critical") ? "critical"
    : findings.some(f => f.severity === "important") ? "important"
    : findings.some(f => f.severity === "warning") ? "warning"
    : "info";

  const result = await pool.query(
    `INSERT INTO ai_reports (report_type, severity, findings) VALUES ($1, $2, $3) RETURNING id`,
    ["manual", sev, JSON.stringify(findings)]
  );
  res.json({ id: result.rows[0]?.id, findings, severity: sev });
});

/** POST /ai/reports/:id/read — mark as read */
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

// ── AI SETTINGS ────────────────────────────────────────────────────────────

const AI_SETTING_KEYS = [
  "ai_scheduler_enabled",
  "ai_idle_threshold_min",
  "ai_late_response_threshold_h",
  "ai_calls_without_result_threshold",
  "ai_critical_alert_interval_min",
];

const AI_SETTING_DEFAULTS: Record<string, string> = {
  ai_scheduler_enabled: "true",
  ai_idle_threshold_min: "20",
  ai_late_response_threshold_h: "2",
  ai_calls_without_result_threshold: "3",
  ai_critical_alert_interval_min: "10",
};

router.get("/ai/settings", requireAnyPermission("view_ai_control", "manage_ai_control"), async (_req, res): Promise<void> => {
  const result = await pool.query(
    `SELECT key, value FROM settings WHERE key = ANY($1)`,
    [AI_SETTING_KEYS]
  );
  const settings = { ...AI_SETTING_DEFAULTS };
  for (const row of result.rows) settings[row.key] = row.value;
  res.json(settings);
});

router.put("/ai/settings", requirePermission("manage_ai_control"), async (req, res): Promise<void> => {
  const body = req.body as Record<string, string>;
  for (const key of AI_SETTING_KEYS) {
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

// ── EMPLOYEE PERFORMANCE REPORTS ───────────────────────────────────────────

/** GET /ai/staff-performance?from=YYYY-MM-DD&to=YYYY-MM-DD */
router.get("/ai/staff-performance", requireAnyPermission("view_ai_control", "view_reports"), async (req, res): Promise<void> => {
  const toDate   = new Date(String(req.query.to   ?? new Date().toISOString().slice(0, 10) + "T23:59:59Z"));
  const fromDate = new Date(String(req.query.from ?? new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10) + "T00:00:00Z"));

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    res.status(400).json({ error: "Invalid date range" }); return;
  }

  const data = await getStaffPerformance(fromDate, toDate);
  res.json(data);
});

export default router;
