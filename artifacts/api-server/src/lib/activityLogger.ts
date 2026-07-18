import { db, activityLogsTable } from "@workspace/db";

export interface ActivityLogParams {
  action: string;
  details: string;
  performedBy?: string | null;
  studentId?: number | null;
  employeeId?: number | null;
  actionType?: string | null;
  entityType?: string | null;
  entityId?: number | null;
  oldValue?: string | null;
  newValue?: string | null;
  sessionId?: string | null;
  deviceType?: string | null;
  os?: string | null;
  browser?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function logActivity(
  action: string,
  details: string,
  performedBy?: string | null,
  studentId?: number | null,
  extra?: Partial<Omit<ActivityLogParams, "action" | "details" | "performedBy" | "studentId">>
): Promise<void> {
  await db.insert(activityLogsTable).values({
    action,
    details,
    performedBy: performedBy ?? null,
    studentId: studentId ?? null,
    ...(extra ?? {}),
  }).catch((err) => {
    console.error("[activityLogger] Failed to insert activity log:", err);
  });
}

export async function logActivityFull(params: ActivityLogParams): Promise<void> {
  await db.insert(activityLogsTable).values({
    action: params.action,
    details: params.details,
    performedBy: params.performedBy ?? null,
    studentId: params.studentId ?? null,
    employeeId: params.employeeId ?? null,
    actionType: params.actionType ?? null,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
    oldValue: params.oldValue ?? null,
    newValue: params.newValue ?? null,
    sessionId: params.sessionId ?? null,
    deviceType: params.deviceType ?? null,
    os: params.os ?? null,
    browser: params.browser ?? null,
    metadata: params.metadata ?? null,
  }).catch((err) => {
    console.error("[activityLogger] Failed to insert activity log:", err);
  });
}
