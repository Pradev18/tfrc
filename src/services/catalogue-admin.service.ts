import prisma from "@/lib/db";
import { slugify } from "@/lib/slugify";
import { buildConfigFromEnvironment, getEnvironmentCardImage } from "@/lib/environment-config";
import { discoverShopCategoriesFromProducts, type ShopCategoryDef } from "@/lib/shop-categories";
import { SHOP_CATEGORIES } from "@/lib/shop-categories";
import type { EnvironmentStatus } from "@prisma/client";

export interface CreateCatalogueInput {
  name: string;
  slug?: string;
  tagline?: string;
  description?: string;
  logoUrl?: string;
  icon?: string;
  departmentSource?: string;
  heroHeadline?: string;
  status?: EnvironmentStatus;
}

export interface UpdateCatalogueInput extends Partial<CreateCatalogueInput> {
  sortOrder?: number;
  theme?: Record<string, string>;
  seo?: { title?: string; description?: string; keywords?: string[] };
  visuals?: Record<string, string>;
}

export async function listCatalogues(includeInactive = true) {
  const envs = await prisma.environment.findMany({
    where: includeInactive ? undefined : { status: "ACTIVE" },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { products: true, shopCategories: true } },
    },
  });

  return envs.map((env) => ({
    ...env,
    config: buildConfigFromEnvironment(env),
    cardImage: getEnvironmentCardImage(env),
    productCount: env._count.products,
    shopCategoryCount: env._count.shopCategories,
  }));
}

export async function getCatalogueById(id: string) {
  const env = await prisma.environment.findUnique({
    where: { id },
    include: {
      shopCategories: { orderBy: { sortOrder: "asc" } },
      _count: { select: { products: true } },
    },
  });
  if (!env) return null;
  return {
    ...env,
    config: buildConfigFromEnvironment(env),
    cardImage: getEnvironmentCardImage(env),
  };
}

export async function getCatalogueBySlug(slug: string) {
  const env = await prisma.environment.findUnique({ where: { slug } });
  if (!env) return null;
  return { ...env, config: buildConfigFromEnvironment(env) };
}

export async function createCatalogue(input: CreateCatalogueInput, userId?: string) {
  const slug = input.slug ? slugify(input.slug) : slugify(input.name);
  const existing = await prisma.environment.findUnique({ where: { slug } });
  if (existing) throw new Error("A catalogue with this URL slug already exists");

  const maxOrder = await prisma.environment.aggregate({ _max: { sortOrder: true } });
  const settings = JSON.stringify({
    heroHeadline: input.heroHeadline ?? input.tagline ?? input.name,
    ctaLabel: `Explore ${input.name}`,
  });

  const env = await prisma.environment.create({
    data: {
      name: input.name.trim(),
      slug,
      tagline: input.tagline?.trim() || null,
      description: input.description?.trim() || null,
      logoUrl: input.logoUrl || null,
      icon: input.icon || "✦",
      departmentSource: input.departmentSource?.trim() || input.name.trim(),
      status: input.status ?? "ACTIVE",
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      theme: JSON.stringify({
        primary: "#0f172a",
        primaryLight: "#1e293b",
        secondary: "#64748b",
        accent: "#3b82f6",
        background: "#f8fafc",
        surface: "#ffffff",
      }),
      seo: JSON.stringify({
        title: `${input.name} | TFRC Qatar`,
        description: input.description ?? `Shop ${input.name} in Qatar. Order on WhatsApp.`,
        keywords: [input.name.toLowerCase(), "qatar", "tfrc"],
      }),
      settings,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "CREATE",
      resource: "Environment",
      resourceId: env.id,
      newValue: JSON.stringify({ slug: env.slug, name: env.name }),
    },
  });

  return env;
}

export async function updateCatalogue(id: string, input: UpdateCatalogueInput, userId?: string) {
  const current = await prisma.environment.findUnique({ where: { id } });
  if (!current) throw new Error("Catalogue not found");

  const currentSettings = JSON.parse(current.settings || "{}") as Record<string, unknown>;
  const nextSettings = {
    ...currentSettings,
    ...(input.heroHeadline !== undefined ? { heroHeadline: input.heroHeadline } : {}),
    ...(input.visuals ? { visuals: { ...(currentSettings.visuals as object), ...input.visuals } } : {}),
  };

  const env = await prisma.environment.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.slug !== undefined ? { slug: slugify(input.slug) } : {}),
      ...(input.tagline !== undefined ? { tagline: input.tagline.trim() || null } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl || null } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.departmentSource !== undefined ? { departmentSource: input.departmentSource } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.theme ? { theme: JSON.stringify(input.theme) } : {}),
      ...(input.seo ? { seo: JSON.stringify(input.seo) } : {}),
      settings: JSON.stringify(nextSettings),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "UPDATE",
      resource: "Environment",
      resourceId: id,
      newValue: JSON.stringify(input),
    },
  });

  return env;
}

export async function deleteCatalogue(id: string, userId?: string) {
  const env = await prisma.environment.findUnique({ where: { id } });
  if (!env) throw new Error("Catalogue not found");

  await prisma.environment.update({
    where: { id },
    data: { status: "INACTIVE" },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "DEACTIVATE",
      resource: "Environment",
      resourceId: id,
    },
  });
}

function defsToDbRows(environmentId: string, defs: ShopCategoryDef[]) {
  return defs.map((def, i) => ({
    environmentId,
    slug: def.slug,
    name: def.name,
    keywords: JSON.stringify(def.keywords),
    sortOrder: def.sortOrder ?? i + 1,
    isActive: true,
  }));
}

/** Seed shop categories from hardcoded defs or auto-discover from product names */
export async function generateShopCategories(environmentId: string, slug: string) {
  const hardcoded = SHOP_CATEGORIES[slug];
  if (hardcoded?.length) {
    await prisma.shopCategory.deleteMany({ where: { environmentId } });
    await prisma.shopCategory.createMany({ data: defsToDbRows(environmentId, hardcoded) });
    return hardcoded.length;
  }

  const products = await prisma.product.findMany({
    where: { environmentId, status: "ACTIVE", deletedAt: null },
    select: { name: true },
    take: 5000,
  });

  const discovered = discoverShopCategoriesFromProducts(products.map((p) => p.name));
  if (discovered.length === 0) return 0;

  await prisma.shopCategory.deleteMany({ where: { environmentId } });
  await prisma.shopCategory.createMany({ data: defsToDbRows(environmentId, discovered) });
  return discovered.length;
}

export async function getLandingPortalsFromDb() {
  const envs = await prisma.environment.findMany({
    where: { status: "ACTIVE" },
    orderBy: { sortOrder: "asc" },
  });

  return envs
    .map((env) => ({
      slug: env.slug,
      displayName: env.name,
      tagline: env.tagline ?? "",
      image: getEnvironmentCardImage(env),
    }))
    .filter((p) => Boolean(p.image) || Boolean(p.displayName));
}
