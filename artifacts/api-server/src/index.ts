import app from "./app";
import { seedAdmin } from "./seed";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
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
    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "user_sessions" ("expire")
    `);
  } finally {
    client.release();
  }
}

ensureSessionTable()
  .catch((err) => {
    console.error("FATAL: Could not ensure user_sessions table:", err);
    process.exit(1);
  })
  .then(() => ensurePushSubscriptionsTable())
  .catch((err) => {
    console.error("FATAL: Could not ensure push_subscriptions table:", err);
    process.exit(1);
  })
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
