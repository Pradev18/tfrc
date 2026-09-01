import { ENVIRONMENT_CONFIGS } from "@/lib/environments";
import { CATEGORY_HERO_IMAGES } from "@/lib/category-images";

/**
 * Landing page catalogue portals.
 *
 * To add a catalogue: add env in ENVIRONMENT_CONFIGS + matching circular badge in CATEGORY_HERO_IMAGES.
 * To remove: delete from those two files — the grid auto-centres and wraps.
 * Cards stay small and uniform; layout uses `.landing-portal-grid` (auto-fit).
 */
export interface LandingPortal {
  slug: string;
  displayName: string;
  tagline: string;
  image: string;
}

export const LANDING_PORTALS: LandingPortal[] = ENVIRONMENT_CONFIGS.map((env) => ({
  slug: env.slug,
  displayName: env.displayName,
  tagline: env.tagline,
  image: CATEGORY_HERO_IMAGES[env.slug] ?? "",
})).filter((p) => Boolean(p.image));

export const PLATFORM_HERO_IMAGE = "/images/platform-hero.png";

/** @deprecated Use LANDING_PORTALS */
export const LANDING_SHOWCASE = LANDING_PORTALS.map((p) => ({
  slug: p.slug,
  label: p.displayName,
  image: p.image,
}));
