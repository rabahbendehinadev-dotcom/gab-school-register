import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { studentsTable } from "./students";
import { staffTable } from "./staff";

export const studentOwnersTable = pgTable("student_owners", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  staffId: integer("staff_id").notNull().references(() => staffTable.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  assignedBy: integer("assigned_by"),
});

export type StudentOwner = typeof studentOwnersTable.$inferSelect;
