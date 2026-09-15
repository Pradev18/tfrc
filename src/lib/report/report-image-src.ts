/**
 * Report product images come from Cloudflare R2 (and similar CDNs).
 * Direct hotlinks often fail partially in admin preview / print, so we
 * route display through a same-origin admin proxy and offer format fallbacks.
 */

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif)(\?|$)/i;

/** Prefer common product photo formats when multiple Cloud Fare rows exist. */
export function pickPreferredImageUrl(urls: string[]): string {
  if (urls.length === 0) return "";
  const scored = urls.map((url, index) => {
    const lower = url.toLowerCase();
    let score = 0;
    if (lower.includes(".jpg") || lower.includes(".jpeg")) score += 40;
    else if (lower.includes(".png")) score += 30;
    else if (lower.includes(".webp")) score += 20;
    else if (lower.includes(".gif")) score += 10;
    // Stable: earlier sheet order wins ties (Excel VLOOKUP behaviour).
    return { url, score: score * 1000 - index };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]!.url;
}

/** Alternate URLs to try when the primary image 404s (jpg ↔ png, etc.). */
export function alternateImageUrls(primary: string): string[] {
  if (!primary || !IMAGE_EXT_RE.test(primary)) return [];
  const exts = [".jpg", ".jpeg", ".png", ".webp"];
  const out: string[] = [];
  for (const ext of exts) {
    const next = primary.replace(IMAGE_EXT_RE, `${ext}$2`);
    if (next !== primary && !out.includes(next)) out.push(next);
  }
  return out;
}

/** Same-origin display URL (keeps original link for <a href>). */
export function toProxiedReportImageSrc(remoteUrl: string): string {
  if (!remoteUrl) return "";
  if (remoteUrl.startsWith("data:") || remoteUrl.startsWith("blob:")) return remoteUrl;
  if (remoteUrl.startsWith("/api/admin/reports/image-proxy")) return remoteUrl;
  return `/api/admin/reports/image-proxy?url=${encodeURIComponent(remoteUrl)}`;
}
