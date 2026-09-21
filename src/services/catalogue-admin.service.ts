import prisma from "@/lib/db";
import { slugify } from "@/lib/slugify";
import { buildConfigFromEnvironment, getEnvironmentCardImage } from "@/lib/environment-config";
import { type ShopCategoryDef } from "@/lib/shop-categories";
import { removeCachedEnvironment } from "@/lib/catalog-cache";
import type { EnvironmentStatus } from "@prisma/client";
import { isCatalogueLockedFromSettings } from "@/lib/catalogue-lock";

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
      _count: {
        select: {
          // Match admin product totals (ignore soft-deleted).
          products: { where: { deletedAt: null } },
          shopCategories: { where: { isActive: true } },
        },
      },
    },
  });

  const envIds = envs.map((env) => env.id);
  // Manage tab also shows categories inferred from product.shopCategorySlug
  // (even when ShopCategory rows are missing). Cards must use the same logic.
  const slugGroups =
    envIds.length === 0
      ? []
      : await prisma.product.groupBy({
          by: ["environmentId", "shopCategorySlug"],
          where: {
            environmentId: { in: envIds },
            deletedAt: null,
            NOT: { shopCategorySlug: null },
          },
          _count: { _all: true },
        });

  const usedBucketsByEnv = new Map<string, number>();
  for (const group of slugGroups) {
    if (!group.shopCategorySlug || group._count._all <= 0) continue;
    usedBucketsByEnv.set(
      group.environmentId,
      (usedBucketsByEnv.get(group.environmentId) ?? 0) + 1
    );
  }

  return envs.map((env) => {
    const fromProducts = usedBucketsByEnv.get(env.id) ?? 0;
    const fromTable = env._count.shopCategories;
    return {
      ...env,
      config: buildConfigFromEnvironment(env),
      cardImage: getEnvironmentCardImage(env),
      productCount: env._count.products,
      shopCategoryCount: Math.max(fromProducts, fromTable),
      isLocked: isCatalogueLockedFromSettings(env.settings),
    };
  });
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
    isLocked: isCatalogueLockedFromSettings(env.settings),
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
  if (existing) throw new Error("A catalogue with this URL page name already exists");

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
      status: input.status ?? "INACTIVE",
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
        title: `${input.name} Catalogue Qatar | TFRC`,
        description:
          input.description?.trim() ||
          `Browse the ${input.name} catalogue by category in Qatar. Order on WhatsApp with TFRC.`,
        keywords: [
          input.name.toLowerCase(),
          "tfrc",
          "qatar",
          "online catalogue qatar",
          "whatsapp order qatar",
        ],
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

  await prisma.$transaction(async (tx) => {
    const categoryIds = (
      await tx.category.findMany({
        where: { environmentId: id },
        select: { id: true },
      })
    ).map((category) => category.id);

    // Products own prices, inventory, media, variants, tags and promotion
    // links through cascade relations, so removing them clears the full
    // catalogue inventory without leaving detached public products behind.
    await tx.product.deleteMany({ where: { environmentId: id } });

    // Category rows have a self-reference. Detach the hierarchy first so the
    // complete catalogue category tree can be removed in one operation.
    if (categoryIds.length > 0) {
      await tx.product.updateMany({
        where: { categoryId: { in: categoryIds } },
        data: { categoryId: null },
      });
      await tx.product.updateMany({
        where: { subcategoryId: { in: categoryIds } },
        data: { subcategoryId: null },
      });
      await tx.category.updateMany({
        where: { parentId: { in: categoryIds } },
        data: { parentId: null },
      });
    }
    await tx.category.deleteMany({ where: { environmentId: id } });

    await tx.shopCategory.deleteMany({ where: { environmentId: id } });
    await tx.banner.deleteMany({ where: { environmentId: id } });
    await tx.homepageSection.deleteMany({ where: { environmentId: id } });
    await tx.importJob.deleteMany({ where: { environmentId: id } });
    await tx.customerInquiry.deleteMany({ where: { environmentSlug: env.slug } });
    await tx.environment.delete({ where: { id } });

    await tx.auditLog.create({
      data: {
        userId,
        action: "DELETE",
        resource: "Environment",
        resourceId: id,
        oldValue: JSON.stringify({ name: env.name, slug: env.slug }),
      },
    });
  });

  removeCachedEnvironment(env.slug);
  return { id: env.id, name: env.name, slug: env.slug };
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

/** Seed shop categories from keyword packs (or discovery) and assign every product. */
export async function generateShopCategories(environmentId: string, slug: string) {
  const { syncEnvironmentShopCategories } = await import("@/lib/shop-category-sync");
  const { resolveCatalogueShopCategoryPack } = await import("@/lib/shop-categories");

  const env = await prisma.environment.findUnique({
    where: { id: environmentId },
    select: { name: true, slug: true, tagline: true, departmentSource: true },
  });

  const products = await prisma.product.findMany({
    where: { environmentId, status: "ACTIVE", deletedAt: null },
    select: { name: true, googleCategory: true, fbCategory: true },
  });

  const pack = resolveCatalogueShopCategoryPack({
    slug: env?.slug ?? slug,
    name: env?.name,
    tagline: env?.tagline,
    departmentSource: env?.departmentSource,
    productNames: products.map((p) => p.name),
    products,
  });

  if (pack.length === 0) return 0;

  // Replace category defs + product assignments together so storefront never
  // briefly sees empty categories mid-regenerate.
  await prisma.$transaction(async (tx) => {
    await tx.shopCategory.deleteMany({ where: { environmentId } });
    await tx.shopCategory.createMany({ data: defsToDbRows(environmentId, pack) });
  });
  await syncEnvironmentShopCategories(environmentId, pack);
  return pack.length;
}

export async function getLandingPortalsFromDb() {
  const envs = await prisma.environment.findMany({
    where: { status: "ACTIVE" },
    orderBy: { sortOrder: "asc" },
  });

  return envs
    .filter((env) => !env.slug.startsWith("replace-persist-"))
    .map((env) => {
      const image =
        getEnvironmentCardImage(env) ||
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f8f5f0"/><stop offset="1" stop-color="#e9e1d7"/></linearGradient></defs><circle cx="128" cy="128" r="116" fill="url(#g)" stroke="#8b3a8f" stroke-width="6"/><text x="128" y="145" text-anchor="middle" font-family="Arial,sans-serif" font-size="64" font-weight="700" fill="#5f2763">${env.name
            .split(/\s+/)
            .map((word) => word[0] ?? "")
            .join("")
            .slice(0, 2)
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "") || "TF"}</text></svg>`
        )}`;
      return {
        slug: env.slug,
        displayName: env.name,
        tagline: env.tagline ?? "",
        image,
      };
    });
}
