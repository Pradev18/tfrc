/**
 * Report product images come from Cloudflare R2 (Cloud Fare sheet).
 * Prefer browser-displayable rasters; .emf/.wmf/.tif cannot render in <img>/PDF.
 */

const RASTER_EXT_RE = /\.(jpe?g|png|webp|gif)(\?|#|$)/i;
const NON_DISPLAY_EXT_RE = /\.(emf|wmf|tif|tiff|bmp|pdf|svg)(\?|#|$)/i;

export function isBrowserDisplayableImageUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (NON_DISPLAY_EXT_RE.test(lower) && !RASTER_EXT_RE.test(lower)) return false;
  return RASTER_EXT_RE.test(lower);
}

function extensionScore(url: string): number {
  const lower = url.toLowerCase();
  if (/\.jpe?g(\?|#|$)/i.test(lower)) return 50;
  if (/\.png(\?|#|$)/i.test(lower)) return 40;
  if (/\.webp(\?|#|$)/i.test(lower)) return 30;
  if (/\.gif(\?|#|$)/i.test(lower)) return 20;
  // Non-displayable Windows/print formats — never win when a raster exists.
  if (/\.emf(\?|#|$)/i.test(lower)) return -100;
  if (/\.wmf(\?|#|$)/i.test(lower)) return -100;
  if (/\.tiff?(\?|#|$)/i.test(lower)) return -80;
  if (/\.bmp(\?|#|$)/i.test(lower)) return -60;
  if (/\.pdf(\?|#|$)/i.test(lower)) return -90;
  return 1;
}

/** Prefer a usable photo when Cloud Fare lists several files for one code. */
export function pickPreferredImageUrl(urls: string[]): string {
  const cleaned = urls.map((u) => String(u || "").trim()).filter(Boolean);
  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) return cleaned[0]!;

  const scored = cleaned.map((url, index) => ({
    url,
    score: extensionScore(url) * 1000 - index,
  }));
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0]!.url;
  // If the winner is still non-displayable, prefer any raster further down.
  if (!isBrowserDisplayableImageUrl(best) || extensionScore(best) < 0) {
    const raster = scored.find((s) => extensionScore(s.url) >= 20);
    if (raster) return raster.url;
  }
  return best;
}

/**
 * Alternate URLs to try when the primary image cannot display
 * (404, .emf, wrong extension, etc.).
 */
export function alternateImageUrls(primary: string): string[] {
  if (!primary) return [];
  const out: string[] = [];
  const push = (u: string) => {
    if (u && u !== primary && !out.includes(u)) out.push(u);
  };

  // Swap / append common raster extensions on the same path.
  if (RASTER_EXT_RE.test(primary) || NON_DISPLAY_EXT_RE.test(primary)) {
    for (const ext of [".jpg", ".JPG", ".jpeg", ".JPEG", ".png", ".PNG", ".webp"]) {
      push(primary.replace(RASTER_EXT_RE, `${ext}$2`).replace(NON_DISPLAY_EXT_RE, `${ext}$2`));
    }
  } else if (/\/[^/]+$/i.test(primary)) {
    for (const ext of [".jpg", ".png", ".jpeg", ".webp"]) {
      push(`${primary}${ext}`);
    }
  }

  return out;
}

/** Browser <img> src. Raster URLs stay direct; EMF/WMF go through the converter proxy. */
export function reportDisplaySrc(remoteUrl: string): string {
  if (!remoteUrl) return "";
  if (remoteUrl.startsWith("data:") || remoteUrl.startsWith("blob:")) return remoteUrl;
  if (!isBrowserDisplayableImageUrl(remoteUrl)) return toProxiedReportImageSrc(remoteUrl);
  return remoteUrl;
}

/** Same-origin display URL (keeps original link for <a href>). */
export function toProxiedReportImageSrc(remoteUrl: string): string {
  if (!remoteUrl) return "";
  if (remoteUrl.startsWith("data:") || remoteUrl.startsWith("blob:")) return remoteUrl;
  if (remoteUrl.startsWith("/api/admin/reports/image-proxy")) return remoteUrl;
  return `/api/admin/reports/image-proxy?url=${encodeURIComponent(remoteUrl)}`;
}

/** Item-code variants for Cloud Fare / inventory mismatches (leading zeros). */
export function itemCodeMatchVariants(code: string): string[] {
  const base = String(code || "").trim();
  if (!base) return [];
  const out = new Set<string>([base]);
  if (/^\d+$/.test(base)) {
    const stripped = base.replace(/^0+/, "") || "0";
    out.add(stripped);
    for (const width of [11, 12, 13, 14]) {
      if (stripped.length < width) out.add(stripped.padStart(width, "0"));
    }
  }
  return [...out];
}
