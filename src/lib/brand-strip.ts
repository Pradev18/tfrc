/**
 * Brand browse strip rules for every catalogue (existing, new, upcoming).
 *
 * Show a card when a real brand name exists (Excel brand / import).
 * - With logoUrl (Excel brand_image or admin device upload) → show logo
 * - Without logo → letter avatar on the card (GGG → G, etc.)
 * Hide the whole strip only when no usable brand names exist at all
 * (e.g. all products are "Unknown" / empty brand).
 *
 * Deploy marker: letter-cards-v2 — Hostinger must rebuild main for G/J/K tiles.
 */

export type BrandStripCandidate = {
  name: string;
  slug: string;
  imageUrl?: string | null;
  logoUrl?: string | null;
  productCount?: number;
};

export function hasUsableBrandName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  return lower !== "unknown" && lower !== "n/a" && lower !== "-" && lower !== "null";
}

export function brandHasLogo(brand: BrandStripCandidate): boolean {
  return Boolean((brand.imageUrl ?? brand.logoUrl ?? "").trim());
}

/** Brands that appear in store + admin browse strips. */
export function brandsForStrip<T extends BrandStripCandidate>(brands: T[]): T[] {
  return brands.filter(
    (brand) =>
      hasUsableBrandName(brand.name) &&
      (brand.productCount == null || brand.productCount > 0)
  );
}

/** @deprecated Use brandsForStrip — kept for older imports. */
export const brandsForLogoStrip = brandsForStrip;
