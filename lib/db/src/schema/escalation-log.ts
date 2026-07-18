import { pgTable, serial, timestamp, integer, text } from "drizzle-orm/pg-core";
import { checklistAssignmentsTable } from "./checklist-assignments";
import { staffTable } from "./staff";

export const escalationLogTable = pgTable("escalation_log", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").notNull().references(() => checklistAssignmentsTable.id, { onDelete: "cascade" }),
  level: integer("level").notNull(),
  notifiedStaffId: integer("notified_staff_id").references(() => staffTable.id, { onDelete: "set null" }),
  note: text("note"),
  notifiedAt: timestamp("notified_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EscalationLog = typeof escalationLogTable.$inferSelect;
