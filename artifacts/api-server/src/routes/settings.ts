import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import { requirePermission } from "../middlewares/auth";
import "../types/session";

const router: IRouter = Router();

const NEXT_COURSE_KEY = "next_course_date";

router.get("/settings/next-course", async (_req, res): Promise<void> => {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, NEXT_COURSE_KEY));
  res.json({ value: row?.value || null });
});

router.put("/settings/next-course", requirePermission("manage_notifications"), async (req, res): Promise<void> => {
  const { value } = req.body;
  if (!value || typeof value !== "string") { res.status(400).json({ error: "value is required" }); return; }
  await db.insert(settingsTable).values({ key: NEXT_COURSE_KEY, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
  res.json({ success: true, value });
});

export default router;
