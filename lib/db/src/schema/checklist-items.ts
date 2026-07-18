import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { checklistTemplatesTable } from "./checklist-templates";

export const checklistItemsTable = pgTable("checklist_items", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => checklistTemplatesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("normal"),
  proofRequired: boolean("proof_required").notNull().default(false),
  noteRequired: boolean("note_required").notNull().default(false),
  resultRequired: boolean("result_required").notNull().default(false),
  studentRequired: boolean("student_required").notNull().default(false),
  offsetMinutes: integer("offset_minutes").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ChecklistItem = typeof checklistItemsTable.$inferSelect;
export type InsertChecklistItem = typeof checklistItemsTable.$inferInsert;
