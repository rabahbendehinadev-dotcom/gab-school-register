import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const staffSessionsTable = pgTable("staff_sessions", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull(),
  sessionToken: text("session_token").notNull().unique(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }).notNull().defaultNow(),
  lastActionAt: timestamp("last_action_at", { withTimezone: true }),
  currentPage: text("current_page"),
  currentStudentId: integer("current_student_id"),
  deviceType: text("device_type"),
  os: text("os"),
  browser: text("browser"),
  ipHash: text("ip_hash"),
  isActive: boolean("is_active").notNull().default(true),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export type StaffSession = typeof staffSessionsTable.$inferSelect;
