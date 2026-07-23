import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import router from "./routes";
import crypto from "crypto";
import { pool } from "@workspace/db";
import { ensureUploadDirs } from "./lib/localFileStorage";

// Ensure local upload directories exist on every startup
ensureUploadDirs();

const app: Express = express();

app.set("trust proxy", 1);

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

const isProduction = process.env.NODE_ENV === "production";

const PgSession = connectPgSimple(session);

const sessionSecret = process.env.SESSION_SECRET
  || (process.env.DATABASE_URL
    ? crypto.createHash("sha256").update(process.env.DATABASE_URL).digest("hex")
    : "gab-school-fallback-secret-change-me");

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use("/api", router);

// In production, serve the pre-built React frontend as static files.
// This lets a single container serve both API and frontend.
if (process.env.NODE_ENV === "production") {
  const frontendDir = process.env.FRONTEND_STATIC_DIR || "/app/public";
  app.use(express.static(frontendDir));
  // SPA fallback — serve index.html for all non-API routes
  app.get("*", (_req, res) => {
    res.sendFile("index.html", { root: frontendDir });
  });
}

export default app;
