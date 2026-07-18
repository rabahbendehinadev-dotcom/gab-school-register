import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { staffTable } from "./staff";

export const checklistTemplatesTable = pgTable("checklist_templates", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  assignedToRole: text("assigned_to_role"),
  assignedToStaffId: integer("assigned_to_staff_id").references(() => staffTable.id, { onDelete: "set null" }),
  daysOfWeek: jsonb("days_of_week").$type<number[]>().default([0,1,2,3,4,5,6]),
  shiftType: text("shift_type"),
  trainingCycle: text("training_cycle"),
  recurrence: text("recurrence").notNull().default("daily"),
  validFrom: timestamp("valid_from", { withTimezone: true }),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  enabled: boolean("enabled").notNull().default(true),
  createdBy: integer("created_by").references(() => staffTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ChecklistTemplate = typeof checklistTemplatesTable.$inferSelect;
export type InsertChecklistTemplate = typeof checklistTemplatesTable.$inferInsert;
