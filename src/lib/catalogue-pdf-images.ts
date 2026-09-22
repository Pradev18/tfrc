import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { readUploadedImage } from "@/lib/upload";

const MAX_SOURCE_BYTES = 20_000_000;
const FETCH_TIMEOUT_MS = 12_000;
const FETCH_ATTEMPTS = 3;
const CONCURRENCY = 6;
const MEMORY_CACHE_MAX = 600;
const DISK_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

export interface CatalogueImageEmbeddingResult {
  embedded: Map<string, string>;
  failures: Map<string, string>;
}

function toDataUri(buffer: Buffer, contentType: string): string {
  const type = contentType.split(";")[0]?.trim() || "image/jpeg";
  return `data:${type};base64,${buffer.toString("base64")}`;
}

function remember(url: string, dataUri: string): string {
  cache.delete(url);
  cache.set(url, dataUri);
  while (cache.size > MEMORY_CACHE_MAX) {
    const oldest = cache.keys().next().value as string | undefined;
    if (!oldest) break;
    cache.delete(oldest);
  }
  return dataUri;
}

function imageCacheFile(url: string): string {
  const key = createHash("sha256").update(url).digest("hex");
  return path.join(process.cwd(), "data", "catalogue-image-cache", `${key}.jpg`);
}

async function readDiskCache(url: string): Promise<string | null> {
  const filename = imageCacheFile(url);
  try {
    const info = await stat(filename);
    if (Date.now() - info.mtimeMs > DISK_CACHE_TTL_MS) return null;
    const buffer = await readFile(filename);
    if (buffer.length === 0) return null;
    return toDataUri(buffer, "image/jpeg");
  } catch {
    return null;
  }
}

async function writeDiskCache(url: string, buffer: Buffer): Promise<void> {
  const filename = imageCacheFile(url);
  try {
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, buffer);
  } catch {
    // Disk caching is an optimisation; generation still succeeds from memory.
  }
}

async function normaliseForPdf(buffer: Buffer): Promise<Buffer> {
  if (buffer.length === 0) throw new Error("image is empty");
  if (buffer.length > MAX_SOURCE_BYTES) {
    throw new Error(`image exceeds ${Math.round(MAX_SOURCE_BYTES / 1_000_000)} MB`);
  }
  const sharp = (await import("sharp")).default;
  return sharp(buffer, { failOn: "error", limitInputPixels: 100_000_000 })
    .rotate()
    .resize(1200, 1200, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 84, progressive: true, mozjpeg: true })
    .toBuffer();
}

function decodeDataUri(value: string): Buffer {
  const comma = value.indexOf(",");
  if (comma < 0) throw new Error("invalid data URI");
  const metadata = value.slice(0, comma);
  const body = value.slice(comma + 1);
  return /;base64/i.test(metadata)
    ? Buffer.from(body, "base64")
    : Buffer.from(decodeURIComponent(body), "utf8");
}

/** Last-resort fallback only — never used as intentional sample content. */
function placeholderDataUri(label: string): string {
  const words = (label || "Item").trim().split(/\s+/).filter(Boolean);
  const safe = (
    words.length >= 2
      ? `${words[0]![0] ?? ""}${words[1]![0] ?? ""}`
      : (words[0] ?? "Item").slice(0, 2)
  )
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 2) || "·";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480"><rect width="480" height="480" fill="#f4f7f5"/><rect x="24" y="24" width="432" height="432" rx="36" fill="#ffffff" stroke="#d7e4dc" stroke-width="4"/><text x="240" y="268" text-anchor="middle" font-family="Arial,sans-serif" font-size="96" font-weight="700" fill="#9bb3a4">${safe}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function mediaFilenameFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url, "http://local.invalid");
    const path = parsed.pathname;
    const mediaMatch = path.match(/\/api\/media\/([^/]+)$/);
    if (mediaMatch?.[1]) return decodeURIComponent(mediaMatch[1]);
    const uploadsMatch = path.match(/\/uploads\/([^/]+)$/);
    if (uploadsMatch?.[1]) return decodeURIComponent(uploadsMatch[1]);
    return null;
  } catch {
    return null;
  }
}

async function readLocalMedia(url: string): Promise<Buffer | null> {
  const filename = mediaFilenameFromUrl(url);
  if (!filename) return null;
  const file = await readUploadedImage(filename);
  return file?.buffer ?? null;
}

async function fetchRemoteBuffer(url: string): Promise<Buffer> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: "follow",
        headers: {
          Accept: "image/jpeg,image/png,image/webp,image/gif,image/*;q=0.8",
          "User-Agent": "TFRC-Catalogue-PDF/2.0",
        },
      });
      if (!response.ok) {
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        if (!retryable) throw new Error(`image server returned HTTP ${response.status}`);
        throw new Error(`temporary image server error HTTP ${response.status}`);
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/") && !contentType.includes("octet-stream")) {
        throw new Error(`URL returned ${contentType || "non-image content"}`);
      }
      const declaredSize = Number(response.headers.get("content-length") || 0);
      if (declaredSize > MAX_SOURCE_BYTES) {
        throw new Error(`image exceeds ${Math.round(MAX_SOURCE_BYTES / 1_000_000)} MB`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > MAX_SOURCE_BYTES) {
        throw new Error(`image exceeds ${Math.round(MAX_SOURCE_BYTES / 1_000_000)} MB`);
      }
      return buffer;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const permanent =
        /HTTP 4\d\d/.test(lastError.message) &&
        !/HTTP (408|429)/.test(lastError.message);
      if (permanent || attempt === FETCH_ATTEMPTS) break;
      await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** (attempt - 1)));
    }
  }

  throw lastError ?? new Error("image download failed");
}

async function acquireImageAsDataUri(url: string): Promise<string> {
  const cached = cache.get(url);
  if (cached) return remember(url, cached);

  if (url.startsWith("data:")) {
    const normalised = await normaliseForPdf(decodeDataUri(url));
    return remember(url, toDataUri(normalised, "image/jpeg"));
  }

  const disk = await readDiskCache(url);
  if (disk) return remember(url, disk);

  // Prefer local disk for uploaded media (works without a running HTTP server).
  const local = await readLocalMedia(url);
  if (local) {
    const normalised = await normaliseForPdf(local);
    await writeDiskCache(url, normalised);
    return remember(url, toDataUri(normalised, "image/jpeg"));
  }

  const source = await fetchRemoteBuffer(url);
  const normalised = await normaliseForPdf(source);
  await writeDiskCache(url, normalised);
  return remember(url, toDataUri(normalised, "image/jpeg"));
}

async function fetchImageAsDataUri(url: string): Promise<string> {
  const existing = inFlight.get(url);
  if (existing) return existing;
  const request = acquireImageAsDataUri(url).finally(() => inFlight.delete(url));
  inFlight.set(url, request);
  return request;
}

export async function embedCatalogueImages(
  urls: Array<string | null>
): Promise<CatalogueImageEmbeddingResult> {
  const unique = [...new Set(urls.filter((url): url is string => Boolean(url)))];
  const embedded = new Map<string, string>();
  const failures = new Map<string, string>();

  for (let index = 0; index < unique.length; index += CONCURRENCY) {
    const batch = unique.slice(index, index + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (url) => {
        try {
          return [url, await fetchImageAsDataUri(url), null] as const;
        } catch (error) {
          return [
            url,
            null,
            error instanceof Error ? error.message : "image download failed",
          ] as const;
        }
      })
    );
    for (const [url, dataUri, error] of results) {
      if (dataUri) embedded.set(url, dataUri);
      else failures.set(url, error || "image download failed");
    }
    // Yield between batches so storefront/admin stay responsive during large PDFs.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return { embedded, failures };
}

export function pdfImageOrPlaceholder(
  absoluteUrl: string | null,
  embedded: Map<string, string>,
  label: string
): string {
  if (!absoluteUrl) return placeholderDataUri(label);
  const embeddedUri = embedded.get(absoluteUrl);
  if (embeddedUri) return embeddedUri;
  // Production PDFs never depend on a browser fetching an image after generation
  // starts. A failed/oversized/unsupported source resolves to a stable placeholder.
  return placeholderDataUri(label);
}

export { placeholderDataUri };
