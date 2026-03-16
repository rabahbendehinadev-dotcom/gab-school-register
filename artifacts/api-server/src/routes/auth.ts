import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, staffTable } from "@workspace/db";
import { LoginBody, LoginResponse, GetMeResponse } from "@workspace/api-zod";
import { verifyPassword } from "../lib/password";
import { logActivity } from "../lib/activityLogger";
import "../types/session";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [staff] = await db
    .select()
    .from(staffTable)
    .where(eq(staffTable.username, parsed.data.username));

  if (!staff || !verifyPassword(parsed.data.password, staff.passwordHash)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  req.session.staffId = staff.id;
  req.session.role = staff.role;
  req.session.fullName = staff.fullName;

  await logActivity("login", `${staff.fullName} logged in`, staff.fullName);

  res.json(
    LoginResponse.parse({
      id: staff.id,
      username: staff.username,
      fullName: staff.fullName,
      role: staff.role,
      createdAt: staff.createdAt,
    })
  );
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const name = req.session.fullName;
  req.session.destroy(() => {});
  if (name) {
    await logActivity("logout", `${name} logged out`, name);
  }
  res.json({ status: "ok" });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const staffId = req.session.staffId;
  if (!staffId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [staff] = await db
    .select()
    .from(staffTable)
    .where(eq(staffTable.id, staffId));

  if (!staff) {
    res.status(401).json({ error: "Staff not found" });
    return;
  }

  res.json(
    GetMeResponse.parse({
      id: staff.id,
      username: staff.username,
      fullName: staff.fullName,
      role: staff.role,
      createdAt: staff.createdAt,
    })
  );
});

export default router;
