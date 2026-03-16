import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, activityLogsTable } from "@workspace/db";
import { ListActivityQueryParams, ListActivityResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/activity", requireAuth, async (req, res): Promise<void> => {
  const query = ListActivityQueryParams.safeParse(req.query);
  const limit = query.success && query.data.limit ? query.data.limit : 100;
  const offset = query.success && query.data.offset ? query.data.offset : 0;

  const logs = await db
    .select()
    .from(activityLogsTable)
    .orderBy(desc(activityLogsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(ListActivityResponse.parse(logs));
});

export default router;
