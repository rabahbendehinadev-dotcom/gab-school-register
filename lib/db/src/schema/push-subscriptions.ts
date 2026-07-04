import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id:       serial("id").primaryKey(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh:   text("p256dh").notNull(),
  auth:     text("auth").notNull(),
  role:     text("role").notNull().default("admin"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;
