import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, settingsTable, openDayRegistrationsTable } from "@workspace/db";
import { requireRole } from "../middlewares/auth";
import { sendTelegramNotification } from "../lib/telegram";
import "../types/session";

const router: IRouter = Router();

const KEYS = {
  enabled: "open_day_enabled",
  seats: "open_day_seats",
  date: "open_day_date",
  opensAt: "open_day_opens_at",
  title: "open_day_title",
  sectionVisible: "open_day_section_visible",
};

async function getSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  return row?.value ?? null;
}

async function setSetting(key: string, value: string) {
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
}

router.get("/open-day/status", async (_req, res): Promise<void> => {
  const [enabled, seats, date, opensAt, title, sectionVisible] = await Promise.all([
    getSetting(KEYS.enabled),
    getSetting(KEYS.seats),
    getSetting(KEYS.date),
    getSetting(KEYS.opensAt),
    getSetting(KEYS.title),
    getSetting(KEYS.sectionVisible),
  ]);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(openDayRegistrationsTable);

  const totalSeats = Number(seats ?? "15");
  const registrationCount = countResult?.count ?? 0;
  const isEnabled = enabled === "true";

  res.json({
    enabled: isEnabled,
    sectionVisible: sectionVisible !== null ? sectionVisible === "true" : isEnabled,
    seats: totalSeats,
    date: date ?? null,
    opensAt: opensAt ?? null,
    title: title ?? "اليوم المفتوح",
    registrationCount,
    spotsLeft: Math.max(0, totalSeats - registrationCount),
    isFull: registrationCount >= totalSeats,
  });
});

router.get("/open-day/registrations", requireRole("admin", "manager"), async (_req, res): Promise<void> => {
  const registrations = await db
    .select()
    .from(openDayRegistrationsTable)
    .orderBy(openDayRegistrationsTable.createdAt);

  res.json(registrations);
});

router.post("/open-day/register", async (req, res): Promise<void> => {
  const { firstName, lastName, phone, whatsapp, city } = req.body;
  if (!firstName || !lastName || !phone || !city) {
    res.status(400).json({ error: "الرجاء ملء جميع الحقول المطلوبة" });
    return;
  }

  const [enabled, seats] = await Promise.all([
    getSetting(KEYS.enabled),
    getSetting(KEYS.seats),
  ]);

  if (enabled !== "true") {
    res.status(403).json({ error: "التسجيل في اليوم المفتوح غير متاح حالياً" });
    return;
  }

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(openDayRegistrationsTable);

  const totalSeats = Number(seats ?? "15");
  const registrationCount = countResult?.count ?? 0;

  if (registrationCount >= totalSeats) {
    res.status(409).json({ error: "عذراً، لقد امتلأت جميع المقاعد" });
    return;
  }

  const [reg] = await db
    .insert(openDayRegistrationsTable)
    .values({ firstName, lastName, phone, whatsapp: whatsapp || phone, city })
    .returning();

  function toIntlPhone(p: string): string {
    let c = p.replace(/\D/g, "");
    if (c.startsWith("0") && c.length === 10) c = "213" + c.slice(1);
    else if (c.startsWith("5") && c.length === 9) c = "213" + c;
    return c;
  }

  const waNumber = toIntlPhone(whatsapp || phone);
  const waText = encodeURIComponent(`مرحباً ${firstName}، تم تأكيد تسجيلك في اليوم المفتوح لـ GAB SCHOOL! سنتواصل معك قريباً بتفاصيل الموعد. 🎉`);
  const waLink = `https://wa.me/${waNumber}?text=${waText}`;
  const spotsLeft = Math.max(0, totalSeats - registrationCount - 1);

  await sendTelegramNotification([
    `🎟️ <b>تسجيل جديد في اليوم المفتوح!</b>`,
    ``,
    `👤 <b>الاسم:</b> ${firstName} ${lastName}`,
    `📞 <b>الهاتف:</b> ${phone}`,
    `💬 <b>الواتساب:</b> ${whatsapp || phone}`,
    `📍 <b>الولاية:</b> ${city}`,
    `🪑 <b>المقاعد المتبقية:</b> ${spotsLeft}`,
    ``,
    `📲 <a href="${waLink}">راسله مباشرة على واتساب</a>`,
  ].join("\n")).catch(() => {});

  res.status(201).json({ success: true, id: reg.id, spotsLeft });
});

router.put("/open-day/settings", requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const { enabled, seats, date, opensAt, title, sectionVisible } = req.body;

  const ops: Promise<void>[] = [];

  if (enabled !== undefined) {
    ops.push(setSetting(KEYS.enabled, enabled ? "true" : "false"));
    if (sectionVisible === undefined) {
      ops.push(setSetting(KEYS.sectionVisible, enabled ? "true" : "false"));
    }
  }
  if (sectionVisible !== undefined) ops.push(setSetting(KEYS.sectionVisible, sectionVisible ? "true" : "false"));
  if (seats !== undefined)   ops.push(setSetting(KEYS.seats, String(Number(seats))));
  if (date !== undefined)    ops.push(setSetting(KEYS.date, date));
  if (opensAt !== undefined) ops.push(setSetting(KEYS.opensAt, opensAt));
  if (title !== undefined)   ops.push(setSetting(KEYS.title, title));

  await Promise.all(ops);
  res.json({ success: true });
});

export default router;
