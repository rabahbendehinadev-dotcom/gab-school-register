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
import { requireRole } from "../middlewares/auth";
import { logActivity } from "../lib/activityLogger";
import { objectStorageClient } from "../lib/objectStorage";
import "../types/session";
import multer from "multer";
import { randomUUID } from "crypto";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ok = allowed.test(file.mimetype.split("/")[1]);
    cb(null, ok);
  },
});

function getBucketId(): string {
  const id = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!id) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  return id;
}

async function uploadToGCS(buffer: Buffer, mimetype: string, originalname: string): Promise<string> {
  const bucketId = getBucketId();
  const bucket = objectStorageClient.bucket(bucketId);
  const ext = originalname.split(".").pop() || "jpg";
  const objectName = `gallery/${randomUUID()}.${ext}`;
  const file = bucket.file(objectName);

  await file.save(buffer, {
    metadata: { contentType: mimetype },
  });

  return `/api/gallery/image/${objectName}`;
}

async function deleteFromGCS(url: string): Promise<void> {
  try {
    const prefix = "/api/gallery/image/";
    if (!url.startsWith(prefix)) return;
    const objectName = url.slice(prefix.length);
    const bucketId = getBucketId();
    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(objectName);
    const [exists] = await file.exists();
    if (exists) await file.delete();
  } catch {
  }
}

const router: IRouter = Router();

router.get(/^\/gallery\/image\/(.+)$/, async (req, res): Promise<void> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const objectName: string = (req.params as any)[0] as string;
    if (!objectName) { res.status(400).end(); return; }
    const bucketId = getBucketId();
    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(objectName);
    const [exists] = await file.exists();
    if (!exists) { res.status(404).end(); return; }
    const [meta] = await file.getMetadata();
    res.setHeader("Content-Type", (meta.contentType as string) || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=31536000");
    const nodeStream = file.createReadStream();
    nodeStream.pipe(res);
  } catch {
    res.status(500).end();
  }
});

router.get("/gallery", async (_req, res): Promise<void> => {
  const images = await db
    .select()
    .from(galleryImagesTable)
    .orderBy(galleryImagesTable.sortOrder);

  res.json(ListGalleryImagesResponse.parse(images));
});

router.post("/gallery", requireRole("admin", "manager"), upload.single("image"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No image file provided" });
    return;
  }

  let url: string;
  try {
    url = await uploadToGCS(req.file.buffer, req.file.mimetype, req.file.originalname);
  } catch (err) {
    console.error("GCS upload error:", err);
    res.status(500).json({ error: "Failed to upload image to storage" });
    return;
  }

  const caption = req.body?.caption || null;
  const sortOrder = parseInt(req.body?.sortOrder || "0", 10);

  const [image] = await db
    .insert(galleryImagesTable)
    .values({ url, caption, sortOrder })
    .returning();

  const performer = req.session.fullName ?? "Unknown";
  await logActivity("image_uploaded", `Gallery image uploaded: ${req.file.originalname}`, performer);

  res.status(201).json(image);
});

router.delete("/gallery/:id", requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const params = DeleteGalleryImageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [image] = await db
    .delete(galleryImagesTable)
    .where(eq(galleryImagesTable.id, params.data.id))
    .returning();

  if (!image) {
    res.status(404).json({ error: "Image not found" });
    return;
  }

  deleteFromGCS(image.url).catch(() => {});

  const performer = req.session.fullName ?? "Unknown";
  await logActivity("image_deleted", `Gallery image deleted`, performer);

  res.sendStatus(204);
});

router.patch("/gallery/:id", requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const params = UpdateGalleryImageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateGalleryImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [image] = await db
    .update(galleryImagesTable)
    .set(parsed.data)
    .where(eq(galleryImagesTable.id, params.data.id))
    .returning();

  if (!image) {
    res.status(404).json({ error: "Image not found" });
    return;
  }

  const performer = req.session.fullName ?? "Unknown";
  await logActivity("image_updated", `Gallery image metadata updated (id: ${image.id})`, performer);

  res.json(UpdateGalleryImageResponse.parse(image));
});

export default router;
