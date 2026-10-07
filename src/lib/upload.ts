import { mkdir, writeFile, readFile, access } from "fs/promises";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { persistentUploadsDir } from "@/lib/sqlite-paths";
import { isR2Configured, uploadBufferToR2 } from "@/lib/r2";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

function detectImageType(buffer: Buffer): { mime: string; extension: string } | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mime: "image/png", extension: "png" };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { mime: "image/webp", extension: "webp" };
  }
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))) {
    return { mime: "image/gif", extension: "gif" };
  }
  return null;
}

function normalizeBrowserMime(type: string): string {
  const value = (type || "").toLowerCase().trim();
  if (value === "image/jpg") return "image/jpeg";
  return value;
}

/** Persistent first — app-tree dirs are wiped on Hostinger redeploy. */
function uploadDirectories(): string[] {
  const cwd = process.cwd();
  return [
    persistentUploadsDir(cwd),
    path.join(cwd, "public", "uploads"),
    path.join(cwd, "uploads"),
    path.join(cwd, ".next", "standalone", "public", "uploads"),
    path.join(cwd, ".next", "public", "uploads"),
    path.join("/tmp", "vitanova-uploads"),
  ];
}

export function mediaPublicUrl(filename: string): string {
  return `/api/media/${encodeURIComponent(filename)}`;
}

const rememberedInDb = new Set<string>();
const MEMORY_BUDGET = 48 * 1024 * 1024;
const memoryImages = new Map<string, { buffer: Buffer; contentType: string }>();
let memoryBytes = 0;

function rememberInMemory(filename: string, contentType: string, buffer: Buffer) {
  const existing = memoryImages.get(filename);
  if (existing) {
    memoryBytes -= existing.buffer.length;
    memoryImages.delete(filename);
  }
  while (memoryBytes + buffer.length > MEMORY_BUDGET && memoryImages.size > 0) {
    const oldest = memoryImages.keys().next().value;
    if (!oldest) break;
    const item = memoryImages.get(oldest);
    memoryImages.delete(oldest);
    if (item) memoryBytes -= item.buffer.length;
  }
  if (buffer.length > MEMORY_BUDGET) return;
  memoryImages.set(filename, { buffer, contentType });
  memoryBytes += buffer.length;
}

/** Keep the file in Postgres. Hosting disk is wiped on redeploy; the database is not. */
async function rememberInDatabase(
  filename: string,
  contentType: string,
  buffer: Buffer
): Promise<boolean> {
  if (rememberedInDb.has(filename)) return true;
  try {
    const { default: prisma } = await import("@/lib/db");
    await prisma.storedMedia.upsert({
      where: { filename },
      create: {
        filename,
        contentType,
        bytes: buffer,
        byteSize: buffer.length,
      },
      update: {
        contentType,
        bytes: buffer,
        byteSize: buffer.length,
      },
    });
    rememberedInDb.add(filename);
    return true;
  } catch (error) {
    console.error("[upload] could not store image in the database:", error);
    return false;
  }
}

async function readFromDatabase(
  filename: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const { default: prisma } = await import("@/lib/db");
    const row = await prisma.storedMedia.findUnique({ where: { filename } });
    if (!row?.bytes) return null;
    rememberedInDb.add(filename);
    return {
      buffer: Buffer.from(row.bytes),
      contentType: row.contentType || "application/octet-stream",
    };
  } catch (error) {
    console.error("[upload] could not read image from the database:", error);
    return null;
  }
}

export async function saveUploadedImage(file: File): Promise<string> {
  if (file.size === 0 || file.size > MAX_BYTES) {
    throw new Error("Image must be under 5 MB");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectImageType(buffer);
  if (!detected) {
    throw new Error("Only JPEG, PNG, WebP, or GIF images are allowed");
  }

  const browserMime = normalizeBrowserMime(file.type);
  // Prefer magic-byte detection. Only reject when browser clearly reports a non-image type.
  if (browserMime && !browserMime.startsWith("image/") && browserMime !== "application/octet-stream") {
    throw new Error("Only JPEG, PNG, WebP, or GIF images are allowed");
  }

  const extension = detected.extension;
  const mime = detected.mime;
  const filename = `${randomUUID()}.${extension}`;
  rememberInMemory(filename, mime, buffer);

  const diskWrite = (async () => {
    let written = false;
    const errors: string[] = [];
    await Promise.all(
      uploadDirectories().map(async (dir) => {
        try {
          await mkdir(dir, { recursive: true });
          await writeFile(path.join(dir, filename), buffer);
          written = true;
        } catch (error) {
          errors.push(`${dir}: ${error instanceof Error ? error.message : String(error)}`);
        }
      })
    );
    return { written, errors };
  })();

  const databaseWrite = rememberInDatabase(filename, mime, buffer);
  const cloudWrite = isR2Configured()
    ? uploadBufferToR2({
        key: `uploads/${filename}`,
        body: buffer,
        contentType: mime,
      }).catch((error: unknown) => {
        console.error("[upload] Cloudflare upload failed, keeping the database copy:", error);
        return null;
      })
    : Promise.resolve(null);

  const [disk, stored, cloudUrl] = await Promise.all([diskWrite, databaseWrite, cloudWrite]);
  if (cloudUrl) return cloudUrl;

  const written = disk.written;
  const errors = disk.errors;

  if (!written && !stored) {
    // Last-resort Hostinger fallback: keep small logos inside the database URL itself.
    if (buffer.length <= 450_000) {
      return `data:${mime};base64,${buffer.toString("base64")}`;
    }
    throw new Error(
      `Could not save image on the server. ${errors[0] ?? "Upload directory is not writable."}`
    );
  }

  return mediaPublicUrl(filename);
}

export async function readUploadedImage(
  filename: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const safe = path.basename(filename);
  if (safe !== filename || safe.includes("..")) return null;
  const extension = safe.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(extension)) return null;

  const cached = memoryImages.get(safe);
  if (cached) return cached;

  for (const dir of uploadDirectories()) {
    const fullPath = path.join(dir, safe);
    try {
      await access(fullPath, fs.constants.R_OK);
      const buffer = await readFile(fullPath);
      const detected = detectImageType(buffer);
      const contentType =
        detected?.mime ??
        (extension === "jpg" || extension === "jpeg" ? "image/jpeg" : `image/${extension}`);
      rememberInMemory(safe, contentType, buffer);
      void rememberInDatabase(safe, contentType, buffer);
      return { buffer, contentType };
    } catch {
      /* try next */
    }
  }

  const fromDb = await readFromDatabase(safe);
  if (!fromDb) return null;
  rememberInMemory(safe, fromDb.contentType, fromDb.buffer);

  const cacheDir = uploadDirectories()[0];
  if (cacheDir) {
    try {
      await mkdir(cacheDir, { recursive: true });
      await writeFile(path.join(cacheDir, safe), fromDb.buffer);
    } catch {
      /* database copy is enough */
    }
  }
  return fromDb;
}
