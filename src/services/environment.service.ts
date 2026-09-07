import prisma from "@/lib/db";
import {
  ENVIRONMENT_CONFIGS,
  getEnvironmentConfig,
  type EnvironmentConfig,
  type EnvironmentTheme,
  type EnvironmentSEO,
} from "@/lib/environments";
import type { Environment, EnvironmentStatus } from "@prisma/client";
import { buildConfigFromEnvironment } from "@/lib/environment-config";
import { getCachedEnvironment, loadCatalogCache } from "@/lib/catalog-cache";
import { cache } from "react";

export type ParsedEnvironment = Environment & {
  config: EnvironmentConfig;
  themeParsed: EnvironmentTheme;
  seoParsed: EnvironmentSEO;
};

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function enrichEnvironment(env: Environment): ParsedEnvironment {
  const config = buildConfigFromEnvironment(env);
  return {
    ...env,
    config,
    themeParsed: parseJson(env.theme, config.theme),
    seoParsed: parseJson(env.seo, config.seo),
  };
}

function environmentFromCacheOrConfig(slug: string): ParsedEnvironment | null {
  const cached = getCachedEnvironment(slug);
  if (cached) {
    const env = {
      id: cached.id,
      name: cached.name,
      slug: cached.slug,
      description: cached.description,
      tagline: cached.tagline,
      icon: cached.icon,
      logoUrl: cached.logoUrl,
      departmentSource: cached.departmentSource,
      sortOrder: 0,
      status: "ACTIVE" as EnvironmentStatus,
      theme: cached.theme,
      seo: cached.seo,
      navigation: "[]",
      homepage: "{}",
      settings: cached.settings,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies Environment;
    return enrichEnvironment(env);
  }

  const cfg = getEnvironmentConfig(slug);
  if (!cfg) return null;

  const env = {
    id: `static-${slug}`,
    name: cfg.displayName,
    slug: cfg.slug,
    description: cfg.description,
    tagline: cfg.tagline,
    icon: cfg.icon,
    logoUrl: null,
    departmentSource: cfg.departmentSource,
    sortOrder: 0,
    status: "ACTIVE" as EnvironmentStatus,
    theme: JSON.stringify(cfg.theme),
    seo: JSON.stringify(cfg.seo),
    navigation: "[]",
    homepage: "{}",
    settings: JSON.stringify({
      heroHeadline: cfg.heroHeadline,
      ctaLabel: cfg.ctaLabel,
    }),
    createdAt: new Date(),
    updatedAt: new Date(),
  } satisfies Environment;

  return enrichEnvironment(env);
}

export const getActiveEnvironments = cache(async function getActiveEnvironments() {
  try {
    const envs = await prisma.environment.findMany({
      where: { status: "ACTIVE" },
      orderBy: { sortOrder: "asc" },
    });
    return envs.map(enrichEnvironment);
  } catch (error) {
    console.error("[env] getActiveEnvironments prisma failed:", error);
  }

  const cache = loadCatalogCache();
  if (cache) {
    return Object.keys(cache.environments)
      .map((slug) => environmentFromCacheOrConfig(slug))
      .filter(Boolean) as ParsedEnvironment[];
  }

  return ENVIRONMENT_CONFIGS.map((cfg) => environmentFromCacheOrConfig(cfg.slug)!);
});

export const getEnvironmentBySlug = cache(async function getEnvironmentBySlug(slug: string) {
  try {
    const env = await prisma.environment.findUnique({ where: { slug } });
    if (!env || env.status !== "ACTIVE") return null;
    return enrichEnvironment(env);
  } catch (error) {
    console.error("[env] getEnvironmentBySlug prisma failed:", error);
    return environmentFromCacheOrConfig(slug);
  }
});

export const getEnvironmentIdBySlug = cache(async function getEnvironmentIdBySlug(
  slug: string
): Promise<string | null> {
  try {
    const env = await prisma.environment.findUnique({
      where: { slug },
      select: { id: true, status: true },
    });
    if (!env || env.status !== "ACTIVE") return null;
    return env.id;
  } catch (error) {
    console.error("[env] getEnvironmentIdBySlug prisma failed:", error);
    return getCachedEnvironment(slug)?.id ?? null;
  }
});

export async function resolveEnvironment(slug: string) {
  return getEnvironmentBySlug(slug);
}

export async function isValidEnvironmentSlug(slug: string): Promise<boolean> {
  return Boolean(await getEnvironmentBySlug(slug));
}

export async function seedEnvironmentDefinitions() {
  for (const [index, cfg] of ENVIRONMENT_CONFIGS.entries()) {
    await prisma.environment.upsert({
      where: { slug: cfg.slug },
      create: {
        name: cfg.displayName,
        slug: cfg.slug,
        description: cfg.description,
        tagline: cfg.tagline,
        icon: cfg.icon,
        departmentSource: cfg.departmentSource,
        sortOrder: index,
        status: "ACTIVE" as EnvironmentStatus,
        theme: JSON.stringify(cfg.theme),
        seo: JSON.stringify(cfg.seo),
        navigation: JSON.stringify([]),
        homepage: JSON.stringify({}),
        settings: JSON.stringify({
          heroHeadline: cfg.heroHeadline,
          ctaLabel: cfg.ctaLabel,
        }),
      },
      update: {
        name: cfg.displayName,
        description: cfg.description,
        tagline: cfg.tagline,
        icon: cfg.icon,
        departmentSource: cfg.departmentSource,
        sortOrder: index,
        theme: JSON.stringify(cfg.theme),
        seo: JSON.stringify(cfg.seo),
      },
    });
  }
}
