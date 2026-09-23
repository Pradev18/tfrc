import { sanitizeSlugSegment } from "@/lib/slug";

/**
 * Single-segment storefront product path. Collapses any accidental `/`
 * inside a stored slug so Next never treats it as extra route segments.
 */
export function productPath(
  environmentSlug: string,
  slug: string,
  query?: string
): string {
  const env = sanitizeSlugSegment(environmentSlug) || environmentSlug;
  const safeSlug =
    sanitizeSlugSegment(String(slug ?? "").replace(/\//g, "-")) ||
    String(slug ?? "")
      .replace(/\/+/g, "-")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
  const qs = query?.startsWith("?") ? query : query ? `?${query}` : "";
  return `/${env}/product/${safeSlug}${qs}`;
}

export function absoluteProductUrl(
  siteUrl: string,
  environmentSlug: string,
  slug: string
): string {
  const base = siteUrl.replace(/\/$/, "");
  return `${base}${productPath(environmentSlug, slug)}`;
}
