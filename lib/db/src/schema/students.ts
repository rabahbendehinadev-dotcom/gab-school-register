import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { groupsTable } from "./groups";

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),
  whatsapp: text("whatsapp").notNull(),
  city: text("city").notNull(),
  trainingType: text("training_type").notNull().default("physical"),
  housingNeeded: boolean("housing_needed").notNull().default(false),
  experienceLevel: text("experience_level").notNull(),
  note: text("note"),
  contactReason: text("contact_reason"),
  depositPaid: boolean("deposit_paid").notNull().default(false),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  receiptUrl: text("receipt_url"),
  stage: text("stage").notNull().default("new"),
  groupId: integer("group_id").references(() => groupsTable.id, { onDelete: "set null" }),
  source: text("source").notNull().default("website"),
  agreedPrice: integer("agreed_price"),
  nextFollowupAt: timestamp("next_followup_at", { withTimezone: true }),
  lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
  contactAttempts: integer("contact_attempts").notNull().default(0),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertStudentSchema = createInsertSchema(studentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;
