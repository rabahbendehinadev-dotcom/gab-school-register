import { db, staffTable, rolesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { hashPassword } from "./lib/password";
import { DEFAULT_ROLES } from "./lib/permissions";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Fz8hxNc2#Mtq8Bx!";

export async function seedAdmin() {
  await seedDefaultRoles();

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

  await mapStaffRoleIds();
}

async function seedDefaultRoles() {
  for (const role of DEFAULT_ROLES) {
    await db
      .insert(rolesTable)
      .values({
        name: role.name,
        displayName: role.displayName,
        permissions: role.permissions as string[],
        isSystem: role.isSystem,
      })
      .onConflictDoNothing();
  }
  console.log("Default roles seeded");
}

async function mapStaffRoleIds() {
  await db.execute(
    sql`UPDATE staff SET role_id = (SELECT id FROM roles WHERE name = staff.role) WHERE role_id IS NULL`
  );
}
