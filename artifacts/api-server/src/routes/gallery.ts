import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, galleryImagesTable } from "@workspace/db";
import {
  ListGalleryImagesResponse,
  DeleteGalleryImageParams,
  UpdateGalleryImageParams,
  UpdateGalleryImageBody,
  UpdateGalleryImageResponse,
} from "@workspace/api-zod";
import { requirePermission } from "../middlewares/auth";
import { logActivity } from "../lib/activityLogger";
import "../types/session";
import multer from "multer";
import { randomUUID } from "crypto";
import path from "path";
import {
  getGalleryDir,
  saveFile,
  deleteFile,
  streamFileToBrowser,
  guessMimeType,
} from "../lib/localFileStorage";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ok = allowed.test(file.mimetype.split("/")[1]);
    cb(null, ok);
  },
});

const router: IRouter = Router();

/** Serve a gallery image from the local uploads volume. */
router.get(/^\/gallery\/image\/(.+)$/, async (req, res): Promise<void> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawName: string = (req.params as any)[0] as string;
    if (!rawName) { res.status(400).end(); return; }

    // The stored path may be "gallery/uuid.ext" or just "uuid.ext"
    const filename = rawName.includes("/") ? path.basename(rawName) : rawName;
    const filePath = path.join(getGalleryDir(), filename);
    const mimeType = guessMimeType(filename);

    await streamFileToBrowser(filePath, mimeType, res);
  } catch {
    res.status(500).end();
  }
});

router.get("/gallery", async (_req, res): Promise<void> => {
  const images = await db.select().from(galleryImagesTable).orderBy(galleryImagesTable.sortOrder);
  res.json(ListGalleryImagesResponse.parse(images));
});

router.post("/gallery", requirePermission("manage_notifications"), upload.single("image"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "No image file provided" }); return; }

  try {
    const ext = path.extname(req.file.originalname) || ".jpg";
    const filename = `${randomUUID()}${ext}`;
    await saveFile(getGalleryDir(), filename, req.file.buffer);

    // URL format matches the route above — compatible with existing DB entries
    const url = `/api/gallery/image/gallery/${filename}`;
    const caption = req.body?.caption || null;
    const sortOrder = parseInt(req.body?.sortOrder || "0", 10);
    const [image] = await db.insert(galleryImagesTable).values({ url, caption, sortOrder }).returning();
    const performer = req.session.fullName ?? "Unknown";
    await logActivity("image_uploaded", `صورة جديدة: ${req.file.originalname}`, performer);
    res.status(201).json(image);
  } catch (err) {
    console.error("Gallery upload error:", err);
    res.status(500).json({ error: "Failed to upload image" });
  }
});

router.delete("/gallery/:id", requirePermission("manage_notifications"), async (req, res): Promise<void> => {
  const params = DeleteGalleryImageParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [image] = await db.delete(galleryImagesTable).where(eq(galleryImagesTable.id, params.data.id)).returning();
  if (!image) { res.status(404).json({ error: "Image not found" }); return; }

  // Best-effort deletion from disk
  try {
    const prefix = "/api/gallery/image/";
    if (image.url.startsWith(prefix)) {
      const raw = image.url.slice(prefix.length);
      const filename = path.basename(raw);
      await deleteFile(path.join(getGalleryDir(), filename));
    }
  } catch { /* ignore */ }

  const performer = req.session.fullName ?? "Unknown";
  await logActivity("image_deleted", `حذف صورة من المعرض`, performer);
  res.sendStatus(204);
});

router.patch("/gallery/:id", requirePermission("manage_notifications"), async (req, res): Promise<void> => {
  const params = UpdateGalleryImageParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateGalleryImageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [image] = await db.update(galleryImagesTable).set(parsed.data).where(eq(galleryImagesTable.id, params.data.id)).returning();
  if (!image) { res.status(404).json({ error: "Image not found" }); return; }
  const performer = req.session.fullName ?? "Unknown";
  await logActivity("image_updated", `تحديث صورة في المعرض (${image.id})`, performer);
  res.json(UpdateGalleryImageResponse.parse(image));
});

export default router;
