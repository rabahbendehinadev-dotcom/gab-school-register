import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { studentsTable } from "./students";

export const callResultsTable = pgTable("call_results", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  staffId: integer("staff_id").notNull(),
  staffName: text("staff_name"),
  clickedAt: timestamp("clicked_at", { withTimezone: true }).notNull().defaultNow(),
  result: text("result"),
  durationSeconds: integer("duration_seconds"),
  note: text("note"),
  nextFollowupAt: timestamp("next_followup_at", { withTimezone: true }),
  source: text("source").notNull().default("call_button"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CallResult = typeof callResultsTable.$inferSelect;
