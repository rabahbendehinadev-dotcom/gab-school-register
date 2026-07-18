import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";
import { staffTable } from "./staff";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  studentId: integer("student_id").references(() => studentsTable.id, { onDelete: "cascade" }),
  recipientStaffId: integer("recipient_staff_id").references(() => staffTable.id, { onDelete: "cascade" }),
  handled: boolean("handled").notNull().default(false),
  handledAt: timestamp("handled_at", { withTimezone: true }),
  handledBy: text("handled_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true, handledAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
