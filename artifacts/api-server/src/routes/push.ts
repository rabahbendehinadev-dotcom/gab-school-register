import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { VAPID_PUBLIC_KEY, sendPushToRole } from "../lib/webPush";
import { logActivityFull } from "../lib/activityLogger";
import "../types/session";

const router: IRouter = Router();

router.get("/push/vapid-public-key", (_req, res): void => {
  res.json({ key: VAPID_PUBLIC_KEY });
});

router.post("/push/subscribe", requireAuth, async (req, res): Promise<void> => {
  const { endpoint, keys } = req.body ?? {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: "Invalid subscription object" });
    return;
  }

  await db
    .insert(pushSubscriptionsTable)
    .values({
      endpoint,
      p256dh:  keys.p256dh,
      auth:    keys.auth,
      role:    req.session.role ?? "staff",
      staffId: req.session.staffId ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: { p256dh: keys.p256dh, auth: keys.auth, role: req.session.role ?? "staff", staffId: req.session.staffId ?? null },
    });

  res.sendStatus(201);
});

router.delete("/push/subscribe", requireAuth, async (req, res): Promise<void> => {
  const { endpoint } = req.body ?? {};
  if (!endpoint) { res.status(400).json({ error: "Missing endpoint" }); return; }
  await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, endpoint));
  res.sendStatus(204);
});

/**
 * POST /push/report-denied — called by the client when browser notification
 * permission is detected as "denied". Logs to activity log and alerts owner.
 */
router.post("/push/report-denied", requireAuth, async (req, res): Promise<void> => {
  const staffId  = req.session.staffId ? Number(req.session.staffId) : null;
  const staffName = (req.session as any).name ?? (req.session as any).fullName ?? "موظف";
  const { reason } = (req.body ?? {}) as { reason?: string };

  await logActivityFull({
    action:     "push_notifications_disabled",
    details:    `الموظف "${staffName}" قام بتعطيل إشعارات المتصفح${reason ? ` (${reason})` : ""}`,
    performedBy: staffName,
    employeeId:  staffId,
    actionType:  "security",
    entityType:  "staff",
    entityId:    staffId,
  });

  try {
    await sendPushToRole("owner", {
      title: "⚠️ تعطيل الإشعارات",
      body:  `الموظف "${staffName}" قام بتعطيل إشعارات المتصفح`,
      url:   "/gab-c7x2p/activity",
    });
  } catch {
    // non-critical — log was already written
  }

  res.json({ success: true });
});

export default router;
