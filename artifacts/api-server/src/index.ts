import app from "./app";
import { seedAdmin } from "./seed";
import { pool } from "@workspace/db";
import { startChecklistScheduler } from "./lib/checklistScheduler";
import { startAiScheduler } from "./lib/aiScheduler";

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
    await client.query(`ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "staff_id" integer REFERENCES "staff"("id") ON DELETE CASCADE`);
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
    await client.query(`ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "shift_type" text`);
  } finally {
    client.release();
  }
}

async function ensureChecklistTables(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "checklist_templates" (
        "id"                   serial PRIMARY KEY,
        "title"                text NOT NULL,
        "description"          text,
        "assigned_to_role"     text,
        "assigned_to_staff_id" integer REFERENCES "staff"("id") ON DELETE SET NULL,
        "days_of_week"         jsonb DEFAULT '[0,1,2,3,4,5,6]',
        "shift_type"           text,
        "recurrence"           text NOT NULL DEFAULT 'daily',
        "enabled"              boolean NOT NULL DEFAULT true,
        "created_by"           integer REFERENCES "staff"("id") ON DELETE SET NULL,
        "created_at"           timestamptz NOT NULL DEFAULT now(),
        "updated_at"           timestamptz NOT NULL DEFAULT now()
      )
    `);
    // Idempotent column additions for checklist_templates
    await client.query(`ALTER TABLE "checklist_templates" ADD COLUMN IF NOT EXISTS "valid_from"      timestamptz`);
    await client.query(`ALTER TABLE "checklist_templates" ADD COLUMN IF NOT EXISTS "valid_until"     timestamptz`);
    await client.query(`ALTER TABLE "checklist_templates" ADD COLUMN IF NOT EXISTS "training_cycle"  text`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "checklist_items" (
        "id"             serial PRIMARY KEY,
        "template_id"    integer NOT NULL REFERENCES "checklist_templates"("id") ON DELETE CASCADE,
        "title"          text NOT NULL,
        "description"    text,
        "priority"       text NOT NULL DEFAULT 'normal',
        "proof_required" boolean NOT NULL DEFAULT false,
        "note_required"  boolean NOT NULL DEFAULT false,
        "offset_minutes" integer NOT NULL DEFAULT 0,
        "sort_order"     integer NOT NULL DEFAULT 0,
        "created_at"     timestamptz NOT NULL DEFAULT now()
      )
    `);
    // Idempotent column additions for checklist_items
    await client.query(`ALTER TABLE "checklist_items" ADD COLUMN IF NOT EXISTS "result_required"  boolean NOT NULL DEFAULT false`);
    await client.query(`ALTER TABLE "checklist_items" ADD COLUMN IF NOT EXISTS "student_required" boolean NOT NULL DEFAULT false`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "checklist_assignments" (
        "id"               serial PRIMARY KEY,
        "template_id"      integer REFERENCES "checklist_templates"("id") ON DELETE SET NULL,
        "item_id"          integer REFERENCES "checklist_items"("id") ON DELETE SET NULL,
        "title"            text NOT NULL,
        "description"      text,
        "priority"         text NOT NULL DEFAULT 'normal',
        "proof_required"   boolean NOT NULL DEFAULT false,
        "note_required"    boolean NOT NULL DEFAULT false,
        "staff_id"         integer NOT NULL REFERENCES "staff"("id") ON DELETE CASCADE,
        "due_at"           timestamptz NOT NULL,
        "status"           text NOT NULL DEFAULT 'not_started',
        "started_at"       timestamptz,
        "completed_at"     timestamptz,
        "note"             text,
        "proof_url"        text,
        "result"           text,
        "snooze_count"     integer NOT NULL DEFAULT 0,
        "snooze_until"     timestamptz,
        "student_id"       integer REFERENCES "students"("id") ON DELETE SET NULL,
        "cancelled_by"     integer REFERENCES "staff"("id") ON DELETE SET NULL,
        "cancelled_at"     timestamptz,
        "reassigned_from"  integer,
        "date_key"         text,
        "created_at"       timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS "idx_checklist_assignments_staff_date" ON "checklist_assignments" ("staff_id", "date_key")`);
    await client.query(`CREATE INDEX IF NOT EXISTS "idx_checklist_assignments_status" ON "checklist_assignments" ("status")`);
    // Idempotent column additions for checklist_assignments
    await client.query(`ALTER TABLE "checklist_assignments" ADD COLUMN IF NOT EXISTS "result_required"  boolean NOT NULL DEFAULT false`);
    await client.query(`ALTER TABLE "checklist_assignments" ADD COLUMN IF NOT EXISTS "student_required" boolean NOT NULL DEFAULT false`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "escalation_log" (
        "id"                serial PRIMARY KEY,
        "assignment_id"     integer NOT NULL REFERENCES "checklist_assignments"("id") ON DELETE CASCADE,
        "level"             integer NOT NULL,
        "notified_staff_id" integer REFERENCES "staff"("id") ON DELETE SET NULL,
        "note"              text,
        "notified_at"       timestamptz NOT NULL DEFAULT now()
      )
    `);
    // Idempotent column additions for notifications
    await client.query(`ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "recipient_staff_id" integer REFERENCES "staff"("id") ON DELETE CASCADE`);
  } finally {
    client.release();
  }
}

async function ensureAiTables(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "ai_reports" (
        "id"           serial PRIMARY KEY,
        "report_type"  text NOT NULL DEFAULT 'manual',
        "severity"     text NOT NULL DEFAULT 'info',
        "findings"     jsonb NOT NULL DEFAULT '[]',
        "is_read"      boolean NOT NULL DEFAULT false,
        "generated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS "idx_ai_reports_severity"     ON "ai_reports" ("severity")`);
    await client.query(`CREATE INDEX IF NOT EXISTS "idx_ai_reports_generated_at" ON "ai_reports" ("generated_at" DESC)`);
    // notification preference column on staff
    await client.query(`ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "notification_pref" text DEFAULT 'during_shift'`);
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
  .then(() => ensureChecklistTables())
  .then(() => ensureAiTables())
  .then(() => seedAdmin())
  .then(() => {
    startChecklistScheduler();
    startAiScheduler();
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("Startup error:", err);
    process.exit(1);
  });
