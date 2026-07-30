import { pgTable, text, serial, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const brandLogosTable = pgTable("brand_logos", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  imageUrl: text("image_url").notNull(),
  website: text("website"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBrandLogoSchema = createInsertSchema(brandLogosTable).omit({ id: true, createdAt: true });
export type InsertBrandLogo = z.infer<typeof insertBrandLogoSchema>;
export type BrandLogo = typeof brandLogosTable.$inferSelect;
