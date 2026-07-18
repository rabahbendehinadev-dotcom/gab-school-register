import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { VAPID_PUBLIC_KEY } from "../lib/webPush";
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

export default router;
