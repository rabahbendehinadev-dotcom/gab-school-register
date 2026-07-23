/**
 * Local disk storage helper — replaces Replit-specific GCS object storage.
 * Files are written to UPLOADS_DIR (default: /app/uploads).
 * Mount that directory as a Docker volume to persist across container rebuilds.
 */

import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import { createReadStream } from "fs";
import type { Response } from "express";

export function getUploadsDir(): string {
  return process.env.UPLOADS_DIR || "/app/uploads";
}

export function getGalleryDir(): string {
  return path.join(getUploadsDir(), "gallery");
}

export function getReceiptsDir(): string {
  return path.join(getUploadsDir(), "receipts");
}

/** Ensure all required upload subdirectories exist (idempotent). */
export function ensureUploadDirs(): void {
  for (const dir of [getGalleryDir(), getReceiptsDir()]) {
    mkdirSync(dir, { recursive: true });
  }
}

/** Save a buffer to disk. Returns the full path written. */
export async function saveFile(dir: string, filename: string, buffer: Buffer): Promise<string> {
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

/** Delete a file from disk (silent if missing). */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore
  }
}

/** Stream a file from disk to an Express response. */
export async function streamFileToBrowser(
  filePath: string,
  contentType: string,
  res: Response,
  options: { cacheMaxAge?: number } = {}
): Promise<void> {
  if (!existsSync(filePath)) {
    res.status(404).end();
    return;
  }
  const { cacheMaxAge = 31536000 } = options;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", `public, max-age=${cacheMaxAge}`);
  const stat = await fs.stat(filePath);
  res.setHeader("Content-Length", stat.size);
  createReadStream(filePath).pipe(res);
}

/** Guess MIME type from file extension. */
export function guessMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
  };
  return map[ext] ?? "application/octet-stream";
}
