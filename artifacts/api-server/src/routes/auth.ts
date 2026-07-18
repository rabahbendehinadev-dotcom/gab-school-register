import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, staffTable, rolesTable } from "@workspace/db";
import { LoginBody, LoginResponse, GetMeResponse } from "@workspace/api-zod";
import { verifyPassword } from "../lib/password";
import { logActivity } from "../lib/activityLogger";
import { getPermissionsForRole } from "../lib/permissions";
import { randomUUID } from "crypto";
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
    res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    return;
  }

  let permissions: string[] = [];

  if (staff.roleId) {
    const [roleRecord] = await db
      .select()
      .from(rolesTable)
      .where(eq(rolesTable.id, staff.roleId));
    if (roleRecord && Array.isArray(roleRecord.permissions)) {
      permissions = roleRecord.permissions as string[];
    }
  }

  if (permissions.length === 0) {
    permissions = getPermissionsForRole(staff.role);
  }

  const sessionToken = randomUUID();

  req.session.staffId = staff.id;
  req.session.role = staff.role;
  req.session.fullName = staff.fullName;
  req.session.permissions = permissions;
  req.session.sessionToken = sessionToken;

  const loginUa = req.headers["user-agent"] ?? "";
  const loginDevice = /mobile|android|iphone|ipad/i.test(loginUa) ? "mobile" : "desktop";
  let loginOs = "Unknown";
  if (/iPhone|iPad/.test(loginUa)) loginOs = "iOS";
  else if (/Android/.test(loginUa)) loginOs = "Android";
  else if (/Win/.test(loginUa)) loginOs = "Windows";
  else if (/Mac/.test(loginUa)) loginOs = "macOS";
  else if (/Linux/.test(loginUa)) loginOs = "Linux";
  let loginBrowser = "Unknown";
  if (/Firefox\//.test(loginUa)) loginBrowser = "Firefox";
  else if (/Edg\//.test(loginUa)) loginBrowser = "Edge";
  else if (/Chrome\//.test(loginUa)) loginBrowser = "Chrome";
  else if (/Safari\//.test(loginUa)) loginBrowser = "Safari";

  await logActivity("login", `${staff.fullName} سجّل الدخول`, staff.fullName, null, {
    employeeId: staff.id,
    actionType: "login",
    entityType: "session",
    sessionId: sessionToken,
    deviceType: loginDevice,
    os: loginOs,
    browser: loginBrowser,
  });

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
  const staffId = req.session.staffId;
  const sessionToken = req.session.sessionToken;

  if (staffId && sessionToken) {
    const { pool } = await import("@workspace/db");
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE staff_sessions SET is_active = false, ended_at = now() WHERE staff_id = $1 AND session_token = $2`,
        [staffId, sessionToken]
      );
    } finally {
      client.release();
    }
  }

  req.session.destroy(() => {});

  if (name && staffId) {
    await logActivity("logout", `${name} سجّل الخروج`, name, null, {
      employeeId: staffId,
      actionType: "logout",
      entityType: "session",
      sessionId: sessionToken,
    });
  }

  res.json({ status: "ok" });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const staffId = req.session.staffId;
  if (!staffId) {
    res.status(401).json({ error: "غير مصادق" });
    return;
  }

  const [staff] = await db
    .select()
    .from(staffTable)
    .where(eq(staffTable.id, staffId));

  if (!staff) {
    res.status(401).json({ error: "الموظف غير موجود" });
    return;
  }

  const permissions: string[] = req.session.permissions ?? getPermissionsForRole(staff.role);

  res.json({
    ...GetMeResponse.parse({
      id: staff.id,
      username: staff.username,
      fullName: staff.fullName,
      role: staff.role,
      createdAt: staff.createdAt,
    }),
    permissions,
  });
});

export default router;
