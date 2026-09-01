import { CATEGORY_HERO_IMAGES } from "@/lib/category-images";

export const PLATFORM_HERO_IMAGE = "/images/platform-hero.png";

export const LANDING_SHOWCASE = [
  { slug: "pawmart", label: "PawMart", image: CATEGORY_HERO_IMAGES.pawmart },
  { slug: "hardware", label: "Pro Tools", image: CATEGORY_HERO_IMAGES.hardware },
  { slug: "household", label: "Kitchen & Home", image: CATEGORY_HERO_IMAGES.household },
] as const;
