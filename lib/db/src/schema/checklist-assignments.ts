import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { staffTable } from "./staff";
import { checklistTemplatesTable } from "./checklist-templates";
import { checklistItemsTable } from "./checklist-items";
import { studentsTable } from "./students";

export const checklistAssignmentsTable = pgTable("checklist_assignments", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").references(() => checklistTemplatesTable.id, { onDelete: "set null" }),
  itemId: integer("item_id").references(() => checklistItemsTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("normal"),
  proofRequired: boolean("proof_required").notNull().default(false),
  noteRequired: boolean("note_required").notNull().default(false),
  resultRequired: boolean("result_required").notNull().default(false),
  studentRequired: boolean("student_required").notNull().default(false),
  staffId: integer("staff_id").notNull().references(() => staffTable.id, { onDelete: "cascade" }),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("not_started"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  note: text("note"),
  proofUrl: text("proof_url"),
  result: text("result"),
  snoozeCount: integer("snooze_count").notNull().default(0),
  snoozeUntil: timestamp("snooze_until", { withTimezone: true }),
  studentId: integer("student_id").references(() => studentsTable.id, { onDelete: "set null" }),
  cancelledBy: integer("cancelled_by").references(() => staffTable.id, { onDelete: "set null" }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  reassignedFrom: integer("reassigned_from"),
  dateKey: text("date_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ChecklistAssignment = typeof checklistAssignmentsTable.$inferSelect;
export type InsertChecklistAssignment = typeof checklistAssignmentsTable.$inferInsert;
