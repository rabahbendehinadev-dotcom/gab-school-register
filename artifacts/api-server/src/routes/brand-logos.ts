import { Router, type IRouter, type Request, type Response } from "express";
import { eq, asc } from "drizzle-orm";
import { db, brandLogosTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import multer from "multer";
import { randomUUID } from "crypto";
import path from "path";
import {
  getBrandLogosDir,
  saveFile,
  deleteFile,
  streamFileToBrowser,
  guessMimeType,
} from "../lib/localFileStorage";
import "../types/session";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /jpeg|jpg|png|gif|webp|svg/.test(file.mimetype.split("/")[1]);
    cb(null, ok);
  },
});

const router: IRouter = Router();

/** Serve a brand logo image from the local uploads volume. */
router.get(/^\/brand-logos\/image\/(.+)$/, async (req, res): Promise<void> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filename = (req as any).params[0] as string;
    const filePath = path.join(getBrandLogosDir(), filename);
    await streamFileToBrowser(filePath, guessMimeType(filename), res);
  } catch {
    res.status(500).json({ error: "Failed to serve image" });
  }
});

/** Public: list active logos ordered by sortOrder */
router.get("/brand-logos", async (_req: Request, res: Response): Promise<void> => {
  try {
    const logos = await db
      .select()
      .from(brandLogosTable)
      .where(eq(brandLogosTable.isActive, true))
      .orderBy(asc(brandLogosTable.sortOrder));
    res.json(logos);
  } catch {
    res.status(500).json({ error: "Failed to fetch brand logos" });
  }
});

/** Admin: list all logos */
router.get("/brand-logos/all", requireAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const logos = await db
      .select()
      .from(brandLogosTable)
      .orderBy(asc(brandLogosTable.sortOrder));
    res.json(logos);
  } catch {
    res.status(500).json({ error: "Failed to fetch brand logos" });
  }
});

/** Admin: create a new brand logo (with image upload) */
router.post("/brand-logos", requireAuth, upload.single("image"), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, website, sortOrder, isActive } = req.body as {
      name: string;
      website?: string;
      sortOrder?: string;
      isActive?: string;
    };

    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    let imageUrl = "";
    if (req.file) {
      const ext = path.extname(req.file.originalname) || ".png";
      const filename = `${randomUUID()}${ext}`;
      await saveFile(getBrandLogosDir(), filename, req.file.buffer);
      imageUrl = `/api/brand-logos/image/${filename}`;
    } else if (req.body.imageUrl) {
      imageUrl = req.body.imageUrl as string;
    } else {
      res.status(400).json({ error: "image is required" });
      return;
    }

    const [created] = await db
      .insert(brandLogosTable)
      .values({
        name,
        imageUrl,
        website: website || null,
        sortOrder: sortOrder ? parseInt(sortOrder, 10) : 0,
        isActive: isActive === undefined ? true : isActive === "true",
      })
      .returning();

    res.status(201).json(created);
  } catch {
    res.status(500).json({ error: "Failed to create brand logo" });
  }
});

/** Admin: update a brand logo (optionally replace image) */
router.put("/brand-logos/:id", requireAuth, upload.single("image"), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const { name, website, sortOrder, isActive } = req.body as {
      name?: string;
      website?: string;
      sortOrder?: string;
      isActive?: string;
    };

    const [existing] = await db.select().from(brandLogosTable).where(eq(brandLogosTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Brand logo not found" });
      return;
    }

    let imageUrl = existing.imageUrl;
    if (req.file) {
      // Delete old file if it was uploaded locally
      if (existing.imageUrl.startsWith("/api/brand-logos/image/")) {
        const oldFilename = existing.imageUrl.replace("/api/brand-logos/image/", "");
        await deleteFile(path.join(getBrandLogosDir(), oldFilename));
      }
      const ext = path.extname(req.file.originalname) || ".png";
      const filename = `${randomUUID()}${ext}`;
      await saveFile(getBrandLogosDir(), filename, req.file.buffer);
      imageUrl = `/api/brand-logos/image/${filename}`;
    }

    const [updated] = await db
      .update(brandLogosTable)
      .set({
        name: name ?? existing.name,
        imageUrl,
        website: website !== undefined ? (website || null) : existing.website,
        sortOrder: sortOrder !== undefined ? parseInt(sortOrder, 10) : existing.sortOrder,
        isActive: isActive !== undefined ? isActive === "true" : existing.isActive,
      })
      .where(eq(brandLogosTable.id, id))
      .returning();

    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed to update brand logo" });
  }
});

/** Admin: toggle active status */
router.patch("/brand-logos/:id/toggle", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const [existing] = await db.select().from(brandLogosTable).where(eq(brandLogosTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [updated] = await db
      .update(brandLogosTable)
      .set({ isActive: !existing.isActive })
      .where(eq(brandLogosTable.id, id))
      .returning();
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed to toggle" });
  }
});

/** Admin: bulk reorder */
router.put("/brand-logos/reorder", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { items } = req.body as { items: { id: number; sortOrder: number }[] };
    if (!Array.isArray(items)) {
      res.status(400).json({ error: "items array required" });
      return;
    }
    await Promise.all(
      items.map(({ id, sortOrder }) =>
        db.update(brandLogosTable).set({ sortOrder }).where(eq(brandLogosTable.id, id))
      )
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to reorder" });
  }
});

/** Admin: delete a brand logo */
router.delete("/brand-logos/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const [existing] = await db.select().from(brandLogosTable).where(eq(brandLogosTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (existing.imageUrl.startsWith("/api/brand-logos/image/")) {
      const filename = existing.imageUrl.replace("/api/brand-logos/image/", "");
      await deleteFile(path.join(getBrandLogosDir(), filename));
    }
    await db.delete(brandLogosTable).where(eq(brandLogosTable.id, id));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete" });
  }
});

export default router;
