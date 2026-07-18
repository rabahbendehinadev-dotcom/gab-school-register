import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { staffTable } from "./staff";

export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id:       serial("id").primaryKey(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh:   text("p256dh").notNull(),
  auth:     text("auth").notNull(),
  role:     text("role").notNull().default("admin"),
  staffId:  integer("staff_id").references(() => staffTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;
