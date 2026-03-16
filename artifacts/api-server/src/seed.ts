import { db, staffTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./lib/password";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Fz8hxNc2#Mtq8Bx!";

export async function seedAdmin() {
  const existing = await db
    .select()
    .from(staffTable)
    .where(eq(staffTable.username, "admin"));

  if (existing.length === 0) {
    await db.insert(staffTable).values({
      username: "admin",
      passwordHash: hashPassword(ADMIN_PASSWORD),
      fullName: "Administrator",
      role: "admin",
    });
    console.log("Default admin created: username=admin");
  } else {
    await db
      .update(staffTable)
      .set({ passwordHash: hashPassword(ADMIN_PASSWORD) })
      .where(eq(staffTable.username, "admin"));
    console.log("Admin password updated");
  }
}
