import slugify from "slugify";

/** Path-safe segment: never allow `/` or other URL-breaking characters. */
export function sanitizeSlugSegment(value: string): string {
  return slugify(String(value ?? ""), {
    lower: true,
    strict: true,
    trim: true,
  });
}

export function createSlug(text: string, suffix?: string): string {
  const base = sanitizeSlugSegment(text);
  if (!suffix) return base;
  const safeSuffix = sanitizeSlugSegment(suffix);
  return safeSuffix ? `${base}-${safeSuffix}` : base;
}

export function createProductSlug(name: string, productId: string): string {
  return createSlug(name, productId);
}

export function createCategorySlug(name: string): string {
  return sanitizeSlugSegment(name);
}

export function parseCategoryPath(path: string): string[] {
  return path
    .split(">")
    .map((s) => s.trim())
    .filter(Boolean);
}
