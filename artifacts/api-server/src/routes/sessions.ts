import { Router, type IRouter } from "express";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { db, staffTable, staffSessionsTable, activityLogsTable } from "@workspace/db";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { randomUUID } from "crypto";
import { pool } from "@workspace/db";
import "../types/session";

const router: IRouter = Router();

function getAlgeriaStartOfDay(): Date {
  const now = new Date();
  const algeriaTZ = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Algiers",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const [day, month, year] = algeriaTZ.split("/");
  return new Date(`${year}-${month}-${day}T00:00:00+01:00`);
}

function getDeviceInfo(req: import("express").Request) {
  const ua = req.headers["user-agent"] ?? "";
  const deviceType = /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : "desktop";
  let os = "Unknown";
  if (/iPhone|iPad/.test(ua)) os = "iOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Win/.test(ua)) os = "Windows";
  else if (/Mac/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";
  let browser = "Unknown";
  if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua)) browser = "Safari";
  return { deviceType, os, browser };
}

router.post("/sessions/heartbeat", requireAuth, async (req, res): Promise<void> => {
  const staffId = req.session.staffId!;
  let sessionToken = req.session.sessionToken;
  if (!sessionToken) {
    sessionToken = randomUUID();
    req.session.sessionToken = sessionToken;
  }

  const { page, studentId } = req.body as { page?: string; studentId?: number };
  const { deviceType, os, browser } = getDeviceInfo(req);

  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO staff_sessions (staff_id, session_token, started_at, last_heartbeat_at, last_action_at, current_page, current_student_id, device_type, os, browser, is_active)
       VALUES ($1, $2, now(), now(), now(), $3, $4, $5, $6, $7, true)
       ON CONFLICT (session_token) DO UPDATE SET
         last_heartbeat_at = now(),
         current_page = EXCLUDED.current_page,
         current_student_id = EXCLUDED.current_student_id,
         device_type = EXCLUDED.device_type,
         os = EXCLUDED.os,
         browser = EXCLUDED.browser,
         is_active = true`,
      [staffId, sessionToken, page ?? null, studentId ?? null, deviceType, os, browser]
    );
  } finally {
    client.release();
  }

  res.json({ ok: true, sessionToken });
});

router.post("/sessions/action", requireAuth, async (req, res): Promise<void> => {
  const staffId = req.session.staffId!;
  const sessionToken = req.session.sessionToken;
  if (!sessionToken) { res.json({ ok: true }); return; }

  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE staff_sessions SET last_action_at = now() WHERE staff_id = $1 AND session_token = $2`,
      [staffId, sessionToken]
    );
  } finally {
    client.release();
  }

  res.json({ ok: true });
});

router.post("/sessions/end", requireAuth, async (req, res): Promise<void> => {
  const staffId = req.session.staffId!;
  const sessionToken = req.session.sessionToken;
  if (sessionToken) {
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE staff_sessions SET is_active = false, ended_at = now() WHERE staff_id = $1 AND session_token = $2`,
        [staffId, sessionToken]
      );
    } finally {
      client.release();
    }
  }
  res.json({ ok: true });
});

router.get("/sessions/active", requirePermission("view_team_activity"), async (_req, res): Promise<void> => {
  const startOfDay = getAlgeriaStartOfDay();
  const now = new Date();
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);
  const twoMinAgo = new Date(now.getTime() - 2 * 60 * 1000);

  const allStaff = await db
    .select({ id: staffTable.id, fullName: staffTable.fullName, role: staffTable.role, username: staffTable.username })
    .from(staffTable)
    .orderBy(staffTable.fullName);

  const activeSessions = await db
    .select()
    .from(staffSessionsTable)
    .where(gte(staffSessionsTable.lastHeartbeatAt, new Date(now.getTime() - 10 * 60 * 1000)));

  const sessionMap = new Map<number, typeof activeSessions[0]>();
  for (const s of activeSessions) {
    const existing = sessionMap.get(s.staffId);
    if (!existing || s.lastHeartbeatAt > existing.lastHeartbeatAt) {
      sessionMap.set(s.staffId, s);
    }
  }

  const todayStats = await db
    .select({
      employeeId: activityLogsTable.employeeId,
      actionType: activityLogsTable.actionType,
      cnt: sql<number>`count(*)::int`,
    })
    .from(activityLogsTable)
    .where(
      and(
        gte(activityLogsTable.createdAt, startOfDay),
        sql`${activityLogsTable.employeeId} IS NOT NULL`
      )
    )
    .groupBy(activityLogsTable.employeeId, activityLogsTable.actionType);

  const statsMap = new Map<number, Record<string, number>>();
  for (const row of todayStats) {
    if (!row.employeeId) continue;
    if (!statsMap.has(row.employeeId)) statsMap.set(row.employeeId, {});
    const stats = statsMap.get(row.employeeId)!;
    stats[row.actionType ?? "other"] = (stats[row.actionType ?? "other"] ?? 0) + row.cnt;
  }

  const result = allStaff.map((staff) => {
    const session = sessionMap.get(staff.id);
    const stats = statsMap.get(staff.id) ?? {};

    let status = "offline";
    if (session) {
      const heartbeat = new Date(session.lastHeartbeatAt);
      const lastAction = session.lastActionAt ? new Date(session.lastActionAt) : null;
      if (heartbeat >= twoMinAgo) {
        if (lastAction && lastAction >= fiveMinAgo) {
          status = "active";
        } else if (lastAction && lastAction >= fifteenMinAgo) {
          status = "idle_5";
        } else {
          status = "idle_15";
        }
      }
    }

    return {
      staffId: staff.id,
      fullName: staff.fullName,
      role: staff.role,
      status,
      lastHeartbeatAt: session?.lastHeartbeatAt ?? null,
      lastActionAt: session?.lastActionAt ?? null,
      currentPage: session?.currentPage ?? null,
      currentStudentId: session?.currentStudentId ?? null,
      deviceType: session?.deviceType ?? null,
      os: session?.os ?? null,
      browser: session?.browser ?? null,
      todayStats: {
        whatsappClicks: stats["whatsapp_click"] ?? 0,
        callClicks: stats["call_click"] ?? 0,
        notesAdded: (stats["note_added"] ?? 0) + (stats["note_edited"] ?? 0),
        stageChanges: stats["stage_changed"] ?? 0,
        totalActions: Object.values(stats).reduce((a, b) => a + b, 0),
      },
    };
  });

  res.json(result);
});

export default router;
