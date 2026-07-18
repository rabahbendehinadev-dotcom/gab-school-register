import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, coursesTable } from "@workspace/db";
import { requirePermission } from "../middlewares/auth";
import "../types/session";

const router: IRouter = Router();

router.get("/courses", async (_req, res): Promise<void> => {
  const courses = await db.select().from(coursesTable).where(eq(coursesTable.visibleOnPage, true)).orderBy(asc(coursesTable.startDate));
  res.json(courses.filter(c => c.enabled));
});

router.get("/admin/courses", requirePermission("manage_notifications"), async (_req, res): Promise<void> => {
  const courses = await db.select().from(coursesTable).orderBy(asc(coursesTable.startDate));
  res.json(courses);
});

router.post("/admin/courses", requirePermission("manage_notifications"), async (req, res): Promise<void> => {
  const { title, startDate, seats } = req.body;
  if (!title || !startDate) { res.status(400).json({ error: "العنوان والتاريخ مطلوبان" }); return; }
  const [course] = await db.insert(coursesTable).values({ title, startDate: new Date(startDate), seats: Number(seats ?? 20) }).returning();
  res.status(201).json(course);
});

router.put("/admin/courses/:id", requirePermission("manage_notifications"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { title, startDate, seats, enabled, visibleOnPage } = req.body;
  const updates: Partial<typeof coursesTable.$inferInsert> = {};
  if (title !== undefined)         updates.title = title;
  if (startDate !== undefined)     updates.startDate = new Date(startDate);
  if (seats !== undefined)         updates.seats = Number(seats);
  if (enabled !== undefined)       updates.enabled = Boolean(enabled);
  if (visibleOnPage !== undefined) updates.visibleOnPage = Boolean(visibleOnPage);
  const [updated] = await db.update(coursesTable).set(updates).where(eq(coursesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "الدورة غير موجودة" }); return; }
  res.json(updated);
});

router.delete("/admin/courses/:id", requirePermission("manage_notifications"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [deleted] = await db.delete(coursesTable).where(eq(coursesTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "الدورة غير موجودة" }); return; }
  res.json({ success: true });
});

export default router;
