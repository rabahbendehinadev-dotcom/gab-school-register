import { Router, type IRouter } from "express";
import { and, gte, sql } from "drizzle-orm";
import { db, staffTable, staffSessionsTable, activityLogsTable } from "@workspace/db";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { randomUUID } from "crypto";
import { pool } from "@workspace/db";
import "../types/session";

const router: IRouter = Router();

// Algeria timezone working hours: 8:00–18:00, Saturday through Thursday (Friday off)
const WORK_START_HOUR = 8;  // 08:00 Algeria local time
const WORK_END_HOUR   = 18; // 18:00 Algeria local time
const WORK_DAYS = [0, 1, 2, 3, 4, 6]; // Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Sat=6

function getAlgeriaDate(): { hour: number; dayOfWeek: number; startOfDay: Date } {
  const now = new Date();
  // Algeria is UTC+1 (Africa/Algiers, no DST)
  const algeriaMs = now.getTime() + 60 * 60 * 1000;
  const algeriaDate = new Date(algeriaMs);
  const hour = algeriaDate.getUTCHours();
  const dayOfWeek = algeriaDate.getUTCDay();

  // Start of today Algeria time (UTC)
  const startOfDayAlgeria = new Date(algeriaMs);
  startOfDayAlgeria.setUTCHours(0, 0, 0, 0);
  const startOfDay = new Date(startOfDayAlgeria.getTime() - 60 * 60 * 1000); // back to UTC

  return { hour, dayOfWeek, startOfDay };
}

function isWithinWorkingHours(hour: number, dayOfWeek: number): boolean {
  return WORK_DAYS.includes(dayOfWeek) && hour >= WORK_START_HOUR && hour < WORK_END_HOUR;
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
  const now = new Date();
  const { hour, dayOfWeek, startOfDay } = getAlgeriaDate();
  const withinWorkingHours = isWithinWorkingHours(hour, dayOfWeek);

  const fiveMinAgo    = new Date(now.getTime() - 5 * 60 * 1000);
  const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);
  const twoMinAgo     = new Date(now.getTime() - 2 * 60 * 1000);
  const tenMinAgo     = new Date(now.getTime() - 10 * 60 * 1000);

  const allStaff = await db
    .select({ id: staffTable.id, fullName: staffTable.fullName, role: staffTable.role, username: staffTable.username })
    .from(staffTable)
    .orderBy(staffTable.fullName);

  // Get all sessions updated in the last 10 minutes (for online status)
  const recentSessions = await db
    .select()
    .from(staffSessionsTable)
    .where(gte(staffSessionsTable.lastHeartbeatAt, tenMinAgo));

  // Get today's sessions (to determine shift_not_started vs offline vs shift_ended)
  const todaySessions = await db
    .select({ staffId: staffSessionsTable.staffId, isActive: staffSessionsTable.isActive })
    .from(staffSessionsTable)
    .where(gte(staffSessionsTable.startedAt, startOfDay));

  const recentSessionMap = new Map<number, typeof recentSessions[0]>();
  for (const s of recentSessions) {
    const existing = recentSessionMap.get(s.staffId);
    if (!existing || s.lastHeartbeatAt > existing.lastHeartbeatAt) {
      recentSessionMap.set(s.staffId, s);
    }
  }

  // For each staff, track: hadSessionToday, hadActiveSessionToday (explicitly ended)
  const todaySessionInfo = new Map<number, { hadSession: boolean; hadExplicitEnd: boolean }>();
  for (const s of todaySessions) {
    const existing = todaySessionInfo.get(s.staffId) ?? { hadSession: false, hadExplicitEnd: false };
    existing.hadSession = true;
    if (!s.isActive) existing.hadExplicitEnd = true;
    todaySessionInfo.set(s.staffId, existing);
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
    const session = recentSessionMap.get(staff.id);
    const stats = statsMap.get(staff.id) ?? {};
    const todayInfo = todaySessionInfo.get(staff.id);

    let status: string;

    if (session) {
      const heartbeat = new Date(session.lastHeartbeatAt);
      const lastAction = session.lastActionAt ? new Date(session.lastActionAt) : null;
      if (heartbeat >= twoMinAgo) {
        // Online — determine activity level
        if (lastAction && lastAction >= fiveMinAgo) {
          status = "active";
        } else if (lastAction && lastAction >= fifteenMinAgo) {
          status = "idle_5";
        } else {
          status = "idle_15";
        }
      } else {
        // Heartbeat stale — they dropped off
        status = withinWorkingHours
          ? (todayInfo?.hadExplicitEnd ? "shift_ended" : "offline")
          : "outside_shift";
      }
    } else {
      // No recent session at all
      if (!withinWorkingHours) {
        status = "outside_shift";
      } else if (!todayInfo?.hadSession) {
        status = "shift_not_started";
      } else if (todayInfo?.hadExplicitEnd) {
        status = "shift_ended";
      } else {
        status = "offline";
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
        tasksCompleted: stats["task_completed"] ?? 0,
        totalActions: Object.values(stats).reduce((a, b) => a + b, 0),
      },
    };
  });

  res.json(result);
});

export default router;
