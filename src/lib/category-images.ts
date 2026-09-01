/** Marketing category brand badges — NOT used for product listings */

export const CATEGORY_HERO_IMAGES: Record<string, string> = {
  pawmart: "/images/categories/pawmart-category.jpg",
  hardware: "/images/categories/hardware-category.jpg",
  household: "/images/categories/household-category.jpg",
};

export function getCategoryHeroImage(slug: string): string | undefined {
  return CATEGORY_HERO_IMAGES[slug];
}
