import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const openDayRegistrationsTable = pgTable("open_day_registrations", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),
  whatsapp: text("whatsapp").notNull(),
  city: text("city").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OpenDayRegistration = typeof openDayRegistrationsTable.$inferSelect;
