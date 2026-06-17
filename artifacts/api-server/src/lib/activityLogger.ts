import { db, activityLogsTable } from "@workspace/db";

export async function logActivity(
  action: string,
  details: string,
  performedBy?: string | null,
  studentId?: number | null,
) {
  await db.insert(activityLogsTable).values({
    action,
    details,
    performedBy: performedBy ?? null,
    studentId: studentId ?? null,
  });
}
