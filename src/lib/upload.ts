import { mkdir, writeFile, readFile, access } from "fs/promises";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

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

function uploadDirectories(): string[] {
  const cwd = process.cwd();
  return [
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

/** Flood-fill near-black pixels connected to image edges → transparent PNG. */
async function stripEdgeBlackToPng(input: Buffer, threshold = 32): Promise<Buffer | null> {
  try {
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(input)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;
    if (channels < 4) return null;

    const visited = new Uint8Array(width * height);
    const queue: number[] = [];

    const isNearBlack = (i: number) => {
      const o = i * 4;
      const a = data[o + 3];
      if (a < 8) return true;
      return data[o] <= threshold && data[o + 1] <= threshold && data[o + 2] <= threshold;
    };

    const push = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const i = y * width + x;
      if (visited[i]) return;
      if (!isNearBlack(i)) return;
      visited[i] = 1;
      queue.push(i);
    };

    for (let x = 0; x < width; x++) {
      push(x, 0);
      push(x, height - 1);
    }
    for (let y = 0; y < height; y++) {
      push(0, y);
      push(width - 1, y);
    }

    let cleared = 0;
    while (queue.length) {
      const i = queue.pop()!;
      const o = i * 4;
      data[o] = 0;
      data[o + 1] = 0;
      data[o + 2] = 0;
      data[o + 3] = 0;
      cleared++;
      const x = i % width;
      const y = (i / width) | 0;
      push(x + 1, y);
      push(x - 1, y);
      push(x, y + 1);
      push(x, y - 1);
    }

    // Only rewrite when a meaningful edge black field was removed.
    if (cleared < width * height * 0.02) return null;

    const pad = Math.max(8, Math.round(Math.max(width, height) * 0.07));
    return sharp(data, { raw: { width, height, channels: 4 } })
      .extend({
        top: pad,
        bottom: pad,
        left: pad,
        right: pad,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

export async function saveUploadedImage(file: File): Promise<string> {
  if (file.size === 0 || file.size > MAX_BYTES) {
    throw new Error("Image must be under 5 MB");
  }

  let buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectImageType(buffer);
  if (!detected) {
    throw new Error("Only JPEG, PNG, WebP, or GIF images are allowed");
  }

  const browserMime = normalizeBrowserMime(file.type);
  // Prefer magic-byte detection. Only reject when browser clearly reports a non-image type.
  if (browserMime && !browserMime.startsWith("image/") && browserMime !== "application/octet-stream") {
    throw new Error("Only JPEG, PNG, WebP, or GIF images are allowed");
  }

  const stripped = await stripEdgeBlackToPng(buffer);
  let extension = detected.extension;
  let mime = detected.mime;
  if (stripped) {
    buffer = stripped;
    extension = "png";
    mime = "image/png";
  }

  const filename = `${randomUUID()}.${extension}`;
  let written = false;
  const errors: string[] = [];

  for (const dir of uploadDirectories()) {
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, filename), buffer);
      written = true;
    } catch (error) {
      errors.push(`${dir}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!written) {
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

  for (const dir of uploadDirectories()) {
    const fullPath = path.join(dir, safe);
    try {
      await access(fullPath, fs.constants.R_OK);
      const buffer = await readFile(fullPath);
      const detected = detectImageType(buffer);
      return {
        buffer,
        contentType:
          detected?.mime ??
          (extension === "jpg" || extension === "jpeg"
            ? "image/jpeg"
            : `image/${extension}`),
      };
    } catch {
      /* try next */
    }
  }

  return null;
}
