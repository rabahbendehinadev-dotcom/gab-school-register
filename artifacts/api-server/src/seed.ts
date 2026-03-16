import { db, staffTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./lib/password";

export async function seedAdmin() {
  const existing = await db
    .select()
    .from(staffTable)
    .where(eq(staffTable.username, "admin"));

  if (existing.length === 0) {
    await db.insert(staffTable).values({
      username: "admin",
      passwordHash: hashPassword("admin123"),
      fullName: "Administrator",
      role: "admin",
    });
    console.log("Default admin created: username=admin, password=admin123");
  }
}
