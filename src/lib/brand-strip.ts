/**
 * Brand browse strip rules for every catalogue (existing, new, upcoming).
 * Cards appear only when a real brand name + brand_image / logoUrl exists.
 * No letter-only placeholders in the strip — hide the whole strip if none qualify.
 */

export type BrandStripCandidate = {
  name: string;
  slug: string;
  imageUrl?: string | null;
  logoUrl?: string | null;
  productCount?: number;
};

function hasUsableBrandName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  return lower !== "unknown" && lower !== "n/a" && lower !== "-";
}

function hasBrandLogo(brand: BrandStripCandidate): boolean {
  const logo = (brand.imageUrl ?? brand.logoUrl ?? "").trim();
  return Boolean(logo);
}

/** Keep only brands that should render as logo cards in store + admin browse. */
export function brandsForLogoStrip<T extends BrandStripCandidate>(brands: T[]): T[] {
  return brands.filter(
    (brand) =>
      hasUsableBrandName(brand.name) &&
      hasBrandLogo(brand) &&
      (brand.productCount == null || brand.productCount > 0)
  );
}
