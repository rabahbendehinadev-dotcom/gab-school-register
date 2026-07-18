import app from "./app";
import { seedAdmin } from "./seed";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function ensureSessionTable(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "user_sessions" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
      ) WITH (OIDS=FALSE)
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "user_sessions" ("expire")`);
  } finally {
    client.release();
  }
}

async function ensurePushSubscriptionsTable(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "push_subscriptions" (
        "id"         serial PRIMARY KEY,
        "endpoint"   text NOT NULL UNIQUE,
        "p256dh"     text NOT NULL,
        "auth"       text NOT NULL,
        "role"       text NOT NULL DEFAULT 'admin',
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  } finally {
    client.release();
  }
}

async function ensureRolesTable(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "roles" (
        "id"           serial PRIMARY KEY,
        "name"         text NOT NULL UNIQUE,
        "display_name" text NOT NULL,
        "permissions"  jsonb NOT NULL DEFAULT '[]',
        "is_system"    boolean NOT NULL DEFAULT false,
        "created_at"   timestamptz NOT NULL DEFAULT now()
      )
    `);
  } finally {
    client.release();
  }
}

async function ensureStaffSessionsTable(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "staff_sessions" (
        "id"                serial PRIMARY KEY,
        "staff_id"          integer NOT NULL,
        "session_token"     text NOT NULL UNIQUE,
        "started_at"        timestamptz NOT NULL DEFAULT now(),
        "last_heartbeat_at" timestamptz NOT NULL DEFAULT now(),
        "last_action_at"    timestamptz,
        "current_page"      text,
        "current_student_id" integer,
        "device_type"       text,
        "os"                text,
        "browser"           text,
        "ip_hash"           text,
        "is_active"         boolean NOT NULL DEFAULT true,
        "ended_at"          timestamptz
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS "idx_staff_sessions_staff_id" ON "staff_sessions" ("staff_id")`);
    await client.query(`CREATE INDEX IF NOT EXISTS "idx_staff_sessions_heartbeat" ON "staff_sessions" ("last_heartbeat_at")`);
  } finally {
    client.release();
  }
}

async function ensureActivityLogsExtended(): Promise<void> {
  const client = await pool.connect();
  try {
    const cols: [string, string][] = [
      ["employee_id", "integer"],
      ["action_type", "text"],
      ["entity_type", "text"],
      ["entity_id", "integer"],
      ["old_value", "text"],
      ["new_value", "text"],
      ["session_id", "text"],
      ["device_type", "text"],
      ["os", "text"],
      ["browser", "text"],
      ["metadata", "jsonb"],
    ];
    for (const [col, type] of cols) {
      await client.query(`ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "${col}" ${type}`);
    }
  } finally {
    client.release();
  }
}

async function ensureStaffRoleIdColumn(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "role_id" integer`);
  } finally {
    client.release();
  }
}

ensureSessionTable()
  .then(() => ensurePushSubscriptionsTable())
  .then(() => ensureRolesTable())
  .then(() => ensureStaffSessionsTable())
  .then(() => ensureActivityLogsExtended())
  .then(() => ensureStaffRoleIdColumn())
  .then(() => seedAdmin())
  .then(() => {
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("Startup error:", err);
    process.exit(1);
  });
