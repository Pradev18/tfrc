import { readUploadedImage } from "@/lib/upload";

const MAX_EMBED_BYTES = 4_000_000;
const FETCH_TIMEOUT_MS = 20_000;
const CONCURRENCY = 10;
const cache = new Map<string, string>();

function toDataUri(buffer: Buffer, contentType: string): string {
  const type = contentType.split(";")[0]?.trim() || "image/jpeg";
  return `data:${type};base64,${buffer.toString("base64")}`;
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

async function readLocalMediaAsDataUri(url: string): Promise<string | null> {
  const filename = mediaFilenameFromUrl(url);
  if (!filename) return null;
  const file = await readUploadedImage(filename);
  if (!file || file.buffer.length === 0 || file.buffer.length > MAX_EMBED_BYTES) {
    return null;
  }
  return toDataUri(file.buffer, file.contentType);
}

async function fetchImageAsDataUri(url: string): Promise<string | null> {
  const cached = cache.get(url);
  if (cached) return cached;

  if (url.startsWith("data:")) {
    cache.set(url, url);
    return url;
  }

  // Prefer local disk for uploaded media (works without a running HTTP server).
  const local = await readLocalMediaAsDataUri(url);
  if (local) {
    cache.set(url, local);
    return local;
  }

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent": "TFRC-Catalogue-PDF/1.0",
      },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/") && !contentType.includes("octet-stream")) {
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_EMBED_BYTES) return null;
    const dataUri = toDataUri(
      buffer,
      contentType.startsWith("image/") ? contentType : "image/jpeg"
    );
    cache.set(url, dataUri);
    return dataUri;
  } catch {
    return null;
  }
}

export async function embedCatalogueImages(
  urls: Array<string | null>
): Promise<Map<string, string>> {
  const unique = [...new Set(urls.filter((url): url is string => Boolean(url)))];
  const embedded = new Map<string, string>();

  for (let index = 0; index < unique.length; index += CONCURRENCY) {
    const batch = unique.slice(index, index + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (url) => [url, await fetchImageAsDataUri(url)] as const)
    );
    for (const [url, dataUri] of results) {
      if (dataUri) embedded.set(url, dataUri);
    }
  }

  return embedded;
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
