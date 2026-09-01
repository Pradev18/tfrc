import prisma from "@/lib/db";
import {
  ENVIRONMENT_CONFIGS,
  getEnvironmentConfig,
  type EnvironmentConfig,
  type EnvironmentTheme,
  type EnvironmentSEO,
} from "@/lib/environments";
import type { Environment, EnvironmentStatus } from "@prisma/client";

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
  const config = getEnvironmentConfig(env.slug) ?? ENVIRONMENT_CONFIGS[0];
  return {
    ...env,
    config,
    themeParsed: parseJson(env.theme, config.theme),
    seoParsed: parseJson(env.seo, config.seo),
  };
}

export async function getActiveEnvironments() {
  const envs = await prisma.environment.findMany({
    where: { status: "ACTIVE" },
    orderBy: { sortOrder: "asc" },
  });
  return envs.map(enrichEnvironment);
}

export async function getEnvironmentBySlug(slug: string) {
  const env = await prisma.environment.findUnique({ where: { slug } });
  if (!env || env.status !== "ACTIVE") return null;
  return enrichEnvironment(env);
}

export async function getEnvironmentIdBySlug(slug: string): Promise<string | null> {
  const env = await prisma.environment.findUnique({
    where: { slug },
    select: { id: true, status: true },
  });
  if (!env || env.status !== "ACTIVE") return null;
  return env.id;
}

export async function resolveEnvironment(slug: string) {
  return getEnvironmentBySlug(slug);
}

export function isValidEnvironmentSlug(slug: string): boolean {
  return ENVIRONMENT_CONFIGS.some((e) => e.slug === slug);
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
        settings: JSON.stringify({}),
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
