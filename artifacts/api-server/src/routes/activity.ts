import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, activityLogsTable } from "@workspace/db";
import { ListActivityQueryParams, ListActivityResponse } from "@workspace/api-zod";
import { requirePermission } from "../middlewares/auth";
import { logActivity } from "../lib/activityLogger";
import "../types/session";

const router: IRouter = Router();

router.post("/activity/track", requirePermission("view_dashboard"), async (req, res): Promise<void> => {
  const { action, studentId, studentName } = req.body as {
    action?: string;
    studentId?: number;
    studentName?: string;
  };

  const allowed = ["call_click", "whatsapp_click", "student_viewed"];
  if (!action || !allowed.includes(action)) {
    res.status(400).json({ error: "Invalid action" });
    return;
  }

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

  const performer = req.session.fullName ?? "Unknown";
  const description = action === "call_click"
    ? `${performer} نقر على اتصال${studentName ? ` مع ${studentName}` : ""}`
    : action === "whatsapp_click"
    ? `${performer} نقر على واتساب${studentName ? ` مع ${studentName}` : ""}`
    : `${performer} فتح ملف طالب${studentName ? `: ${studentName}` : ""}`;

  await logActivity(action, description, performer, null, {
    employeeId: req.session.staffId,
    actionType: action,
    entityType: "student",
    entityId: studentId,
    sessionId: req.session.sessionToken,
    deviceType,
    os,
    browser,
  });

  res.json({ ok: true });
});

router.get("/activity", requirePermission("view_audit_logs"), async (req, res): Promise<void> => {
  const query = ListActivityQueryParams.safeParse(req.query);
  const limit = query.success && query.data.limit ? query.data.limit : 100;
  const offset = query.success && query.data.offset ? query.data.offset : 0;

  const logs = await db
    .select()
    .from(activityLogsTable)
    .orderBy(desc(activityLogsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(ListActivityResponse.parse(logs));
});

export default router;
