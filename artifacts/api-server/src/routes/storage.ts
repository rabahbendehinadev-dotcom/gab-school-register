import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth } from "../middlewares/auth";
import path from "path";
import {
  getReceiptsDir,
  streamFileToBrowser,
  guessMimeType,
} from "../lib/localFileStorage";

const router: IRouter = Router();

/**
 * Serve a receipt file from the local uploads volume.
 * URL: /api/storage/receipts/:uuid
 * File on disk: UPLOADS_DIR/receipts/:uuid
 */
router.get("/storage/receipts/:uuid", async (req: Request, res: Response) => {
  try {
    const uuid = String(req.params.uuid);
    if (!uuid || uuid.includes("/") || uuid.includes("..")) {
      res.status(400).json({ error: "Invalid receipt id" });
      return;
    }
    const filePath = path.join(getReceiptsDir(), uuid);
    const mimeType = guessMimeType(uuid) === "application/octet-stream"
      ? "application/octet-stream"
      : guessMimeType(uuid);

    await streamFileToBrowser(filePath, mimeType, res, { cacheMaxAge: 86400 });
  } catch {
    res.status(500).json({ error: "Failed to serve receipt" });
  }
});

/**
 * NOTE: The Replit-specific routes below (request-url, public-objects, objects)
 * relied on Replit Object Storage (GCS sidecar) and are disabled in production.
 * They return 501 so clients get a clear error rather than a crash.
 */

router.post("/storage/uploads/request-url", requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ error: "Direct-upload signed URLs are not supported in self-hosted mode. Upload files through the gallery or receipt endpoints instead." });
});

router.get("/storage/public-objects/*filePath", (_req: Request, res: Response) => {
  res.status(501).json({ error: "Replit object storage not available in self-hosted mode." });
});

router.get("/storage/objects/*path", requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ error: "Replit object storage not available in self-hosted mode." });
});

export default router;
