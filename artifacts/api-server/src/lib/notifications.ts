import { db, notificationsTable } from "@workspace/db";

export async function createNotification(
  type: string,
  title: string,
  message: string,
  studentId?: number | null,
) {
  await db.insert(notificationsTable).values({
    type,
    title,
    message,
    studentId: studentId ?? null,
  });
}
