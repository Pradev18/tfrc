import slugify from "slugify";

export function createSlug(text: string, suffix?: string): string {
  const base = slugify(text, { lower: true, strict: true, trim: true });
  return suffix ? `${base}-${suffix}` : base;
}

export function createProductSlug(name: string, productId: string): string {
  return createSlug(name, productId);
}

export function createCategorySlug(name: string): string {
  return slugify(name, { lower: true, strict: true, trim: true });
}

export function parseCategoryPath(path: string): string[] {
  return path
    .split(">")
    .map((s) => s.trim())
    .filter(Boolean);
}
