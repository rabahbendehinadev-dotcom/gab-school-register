import { db, activityLogsTable } from "@workspace/db";

export async function logActivity(action: string, details: string, performedBy?: string | null) {
  await db.insert(activityLogsTable).values({
    action,
    details,
    performedBy: performedBy ?? null,
  });
}
