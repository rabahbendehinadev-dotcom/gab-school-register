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
import "../types/session";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype.split("/")[1]);
    cb(null, extOk || mimeOk);
  },
});

const router: IRouter = Router();

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

  const url = `/api/uploads/${req.file.filename}`;
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

  const filename = image.url.split("/").pop();
  if (filename) {
    const filePath = path.join(uploadDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

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
