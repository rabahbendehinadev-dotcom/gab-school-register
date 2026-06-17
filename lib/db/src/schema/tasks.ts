import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";
import { staffTable } from "./staff";

export const followupTasksTable = pgTable("followup_tasks", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").references(() => studentsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("call"),
  title: text("title").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }),
  assignedTo: integer("assigned_to").references(() => staffTable.id, { onDelete: "set null" }),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFollowupTaskSchema = createInsertSchema(followupTasksTable).omit({ id: true, createdAt: true, completedAt: true });
export type InsertFollowupTask = z.infer<typeof insertFollowupTaskSchema>;
export type FollowupTask = typeof followupTasksTable.$inferSelect;
