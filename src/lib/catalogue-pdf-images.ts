const MAX_EMBED_BYTES = 400_000;
const FETCH_TIMEOUT_MS = 2500;
const CONCURRENCY = 16;
const cache = new Map<string, string>();

function toDataUri(buffer: Buffer, contentType: string): string {
  const type = contentType.split(";")[0]?.trim() || "image/jpeg";
  return `data:${type};base64,${buffer.toString("base64")}`;
}

async function fetchImageAsDataUri(url: string): Promise<string | null> {
  const cached = cache.get(url);
  if (cached) return cached;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "force-cache",
      headers: { Accept: "image/*" },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_EMBED_BYTES) return null;
    const dataUri = toDataUri(buffer, contentType);
    cache.set(url, dataUri);
    return dataUri;
  } catch {
    return null;
  }
}

export async function embedCatalogueImages(urls: Array<string | null>): Promise<Map<string, string>> {
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

export function optimizePdfImageUrl(url: string, origin: string): string {
  if (url.startsWith("data:")) return url;
  if (url.startsWith("/_next/image")) return url.startsWith("http") ? url : `${origin}${url}`;
  const encoded = encodeURIComponent(url);
  return `${origin}/_next/image?url=${encoded}&w=384&q=60`;
}
