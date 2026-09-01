import type { Environment } from "@prisma/client";
import {
  ENVIRONMENT_CONFIGS,
  getEnvironmentConfig,
  type EnvironmentConfig,
  type EnvironmentSEO,
  type EnvironmentTheme,
} from "@/lib/environments";
import { CATEGORY_HERO_IMAGES } from "@/lib/category-images";
import { ENV_VISUALS, type EnvVisual } from "@/lib/env-visuals";

export interface EnvironmentSettings {
  ctaLabel?: string;
  heroHeadline?: string;
  visuals?: Partial<EnvVisual>;
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const DEFAULT_THEME: EnvironmentTheme = {
  primary: "#1b4332",
  primaryLight: "#2d6a4f",
  secondary: "#40916c",
  accent: "#40916c",
  background: "#fafcf9",
  surface: "#ffffff",
};

const DEFAULT_SEO: EnvironmentSEO = {
  title: "",
  description: "",
  keywords: [],
};

/** Build runtime config purely from DB row, with optional legacy fallback */
export function buildConfigFromEnvironment(env: Environment): EnvironmentConfig {
  const legacy = getEnvironmentConfig(env.slug);
  const settings = parseJson<EnvironmentSettings>(env.settings, {});
  const theme = parseJson<EnvironmentTheme>(env.theme, legacy?.theme ?? DEFAULT_THEME);
  const seo = parseJson<EnvironmentSEO>(env.seo, legacy?.seo ?? DEFAULT_SEO);

  return {
    slug: env.slug,
    name: env.name,
    displayName: env.name,
    tagline: env.tagline ?? legacy?.tagline ?? "",
    description: env.description ?? legacy?.description ?? "",
    icon: env.icon ?? legacy?.icon ?? "✦",
    departmentSource: env.departmentSource ?? legacy?.departmentSource ?? env.name,
    ctaLabel: settings.ctaLabel ?? legacy?.ctaLabel ?? `Explore ${env.name}`,
    heroHeadline: settings.heroHeadline ?? legacy?.heroHeadline ?? env.tagline ?? "",
    theme,
    seo: {
      title: seo.title || `${env.name} | TFRC Qatar`,
      description: seo.description || env.description || "",
      keywords: seo.keywords?.length ? seo.keywords : [env.name.toLowerCase(), "qatar"],
    },
  };
}

export function getEnvironmentVisuals(env: Environment): EnvVisual {
  const settings = parseJson<EnvironmentSettings>(env.settings, {});
  const base = ENV_VISUALS[env.slug] ?? ENV_VISUALS.pawmart;
  return { ...base, ...settings.visuals };
}

export function getEnvironmentCardImage(env: Environment): string {
  return env.logoUrl ?? CATEGORY_HERO_IMAGES[env.slug] ?? "";
}

export function getAllLegacySlugs(): string[] {
  return ENVIRONMENT_CONFIGS.map((e) => e.slug);
}
