import webpush from "web-push";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  ?? "BHfwf1HjWZUFZT8v5lajqWKho01uvJq_ltl_7l705E5EJ-pFF2gyNr8LQSY7ZazNUVY-FSpAH3cMe6gDcYHtle8";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "Yb1J5q6IxKPGXZWHybTmXBXpVIsK2SqATWWNfN9ztNY";
const VAPID_SUBJECT     = process.env.VAPID_SUBJECT     ?? "mailto:admin@gab-school.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export { VAPID_PUBLIC_KEY };

export interface PushPayload {
  title:   string;
  body:    string;
  url?:    string;
  icon?:   string;
  tag?:    string;
}

async function deliverOnce(subs: typeof pushSubscriptionsTable.$inferSelect[], data: string): Promise<void> {
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          data,
          { TTL: 60 * 60 * 24 }
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.delete(pushSubscriptionsTable)
            .where(eq(pushSubscriptionsTable.endpoint, sub.endpoint))
            .catch(() => {});
        }
      }
    })
  );
}

/**
 * Send push to all admin subscribers.
 * repeatTimes: total number of times to ring (default 3), each 8 s apart.
 * Uses same `tag` + renotify=true in the SW so only ONE banner stays on screen
 * while the alert sound plays repeatTimes times.
 */
export async function sendPushToAdmins(payload: PushPayload, repeatTimes = 3): Promise<void> {
  return sendPushToRole("admin", payload, repeatTimes);
}

/**
 * Send push to all subscribers of a given role.
 * role: "admin" | "team_leader" | "staff" | etc.
 */
export async function sendPushToRole(role: string, payload: PushPayload, repeatTimes = 1): Promise<void> {
  const subs = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.role, role));

  if (subs.length === 0) return;

  const data = JSON.stringify(payload);

  await deliverOnce(subs, data);

  for (let i = 1; i < repeatTimes; i++) {
    const delay = i * 8_000;
    setTimeout(() => deliverOnce(subs, data).catch(() => {}), delay);
  }
}
