import prisma from "@/lib/db";
import { getEnvironmentIdBySlug } from "@/services/environment.service";
import {
  getEffectiveShopCategoryDefs,
  getShopCategoryDefs,
  OTHER_SHOP_CATEGORY,
  resolvePrimaryShopCategory,
  type ShopCategoryDef,
} from "@/lib/shop-categories";
import { getCachedEnvironment } from "@/lib/catalog-cache";
import { cache } from "react";

export interface ShopCategoryItem {
  slug: string;
  name: string;
  productCount: number;
  imageUrl: string | null;
}

async function getDbShopCategoryDefs(environmentId: string): Promise<ShopCategoryDef[]> {
  const rows = await prisma.shopCategory.findMany({
    where: { environmentId, isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  if (rows.length === 0) return [];

  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    keywords: parseKeywords(row.keywords),
    sortOrder: row.sortOrder,
    imageUrl: row.imageUrl,
  }));
}

export async function getShopCategoryDefsForEnvironment(
  environmentId: string,
  environmentSlug: string
): Promise<ShopCategoryDef[]> {
  const dbDefinitions = await getDbShopCategoryDefs(environmentId);
  return dbDefinitions.length > 0 ? dbDefinitions : getShopCategoryDefs(environmentSlug);
}

function parseKeywords(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** Count-based category index — exclusive primary category only */
export const getShopCategories = cache(async function getShopCategories(
  environmentSlug: string
): Promise<ShopCategoryItem[]> {
  // Storefront hot path: prefer file cache so SQLite is never on the critical path.
  const fromCache = getShopCategoriesFromCache(environmentSlug);
  if (fromCache.length > 0) return fromCache;

  try {
    return await getShopCategoriesFromPrisma(environmentSlug);
  } catch (error) {
    console.error("[shop-categories] prisma failed, using cache:", error);
    return fromCache;
  }
});

function getShopCategoriesFromCache(environmentSlug: string): ShopCategoryItem[] {
  const cached = getCachedEnvironment(environmentSlug);
  if (!cached) return [];

  const defs = getEffectiveShopCategoryDefs(
    environmentSlug,
    cached.products.map((p) => p.name)
  );

  const buckets = new Map<string, typeof cached.products>();
  for (const def of defs) buckets.set(def.slug, []);
  buckets.set(OTHER_SHOP_CATEGORY.slug, []);

  for (const product of cached.products) {
    const primary = resolvePrimaryShopCategory({ name: product.name }, defs);
    const slug = primary?.slug ?? OTHER_SHOP_CATEGORY.slug;
    buckets.get(slug)!.push(product);
  }

  const items: ShopCategoryItem[] = defs
    .map((def) => {
      const matched = buckets.get(def.slug) ?? [];
      if (matched.length === 0) return null;
      return {
        slug: def.slug,
        name: def.name,
        productCount: matched.length,
        imageUrl: matched[0]?.images[0]?.url ?? null,
      };
    })
    .filter(Boolean) as ShopCategoryItem[];

  const other = buckets.get(OTHER_SHOP_CATEGORY.slug) ?? [];
  if (other.length > 0) {
    items.push({
      slug: OTHER_SHOP_CATEGORY.slug,
      name: OTHER_SHOP_CATEGORY.name,
      productCount: other.length,
      imageUrl: other[0]?.images[0]?.url ?? null,
    });
  }

  return items;
}

async function getShopCategoriesFromPrisma(environmentSlug: string): Promise<ShopCategoryItem[]> {
  const environmentId = await getEnvironmentIdBySlug(environmentSlug);
  if (!environmentId) return getShopCategoriesFromCache(environmentSlug);

  const baseWhere = {
    environmentId,
    status: "ACTIVE" as const,
    deletedAt: null,
    isVariantPrimary: true,
  };

  let defs = await getDbShopCategoryDefs(environmentId);
  if (defs.length === 0) {
    defs = getShopCategoryDefs(environmentSlug);
  }

  const totalActive = await prisma.product.count({ where: baseWhere });
  const uncategorized = await prisma.product.count({
    where: {
      ...baseWhere,
      OR: [{ shopCategorySlug: null }, { shopCategorySlug: OTHER_SHOP_CATEGORY.slug }],
    },
  });

  // Public storefront must stay read-only. Never generate/sync categories on GET —
  // those writes lock SQLite and crash /pawmart under load. Admin/import own healing.
  const mostlyUncategorized =
    totalActive > 0 && uncategorized / totalActive >= 0.45;

  if (mostlyUncategorized || defs.length === 0) {
    const fromCache = getShopCategoriesFromCache(environmentSlug);
    if (fromCache.length > 0) return fromCache;

    // In-memory name bucketing only (no DB writes).
    const sample = await prisma.product.findMany({
      where: baseWhere,
      select: {
        name: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      },
      take: 5000,
      orderBy: { createdAt: "desc" },
    });
    if (sample.length === 0) return [];

    const derivedDefs = getEffectiveShopCategoryDefs(
      environmentSlug,
      sample.map((p) => p.name)
    );
    const pack = derivedDefs.length > 0 ? derivedDefs : defs;
    if (pack.length === 0) return [];

    const buckets = new Map<string, typeof sample>();
    for (const def of pack) buckets.set(def.slug, []);
    buckets.set(OTHER_SHOP_CATEGORY.slug, []);

    for (const product of sample) {
      const primary = resolvePrimaryShopCategory({ name: product.name }, pack);
      const slug = primary?.slug ?? OTHER_SHOP_CATEGORY.slug;
      buckets.get(slug)!.push(product);
    }

    const items: ShopCategoryItem[] = pack
      .map((def) => {
        const matched = buckets.get(def.slug) ?? [];
        if (matched.length === 0) return null;
        return {
          slug: def.slug,
          name: def.name,
          productCount: matched.length,
          imageUrl: matched[0]?.images[0]?.url ?? null,
        };
      })
      .filter(Boolean) as ShopCategoryItem[];

    const other = buckets.get(OTHER_SHOP_CATEGORY.slug) ?? [];
    if (other.length > 0) {
      items.push({
        slug: OTHER_SHOP_CATEGORY.slug,
        name: OTHER_SHOP_CATEGORY.name,
        productCount: other.length,
        imageUrl: other[0]?.images[0]?.url ?? null,
      });
    }
    return items;
  }

  if (defs.length === 0) return [];

  const counts = await prisma.product.groupBy({
    by: ["shopCategorySlug"],
    where: baseWhere,
    _count: { _all: true },
  });

  const countBySlug = new Map<string, number>();
  let nullCount = 0;
  for (const row of counts) {
    if (row.shopCategorySlug == null) {
      nullCount += row._count._all;
      continue;
    }
    countBySlug.set(row.shopCategorySlug, row._count._all);
  }
  if (nullCount > 0) {
    countBySlug.set(
      OTHER_SHOP_CATEGORY.slug,
      (countBySlug.get(OTHER_SHOP_CATEGORY.slug) ?? 0) + nullCount
    );
  }

  const dbRows = await prisma.shopCategory.findMany({
    where: { environmentId, isActive: true },
    select: { slug: true, imageUrl: true },
  });
  const imageBySlug = new Map(dbRows.map((r) => [r.slug, r.imageUrl]));

  const slugsNeedingThumb = defs
    .map((d) => d.slug)
    .concat(OTHER_SHOP_CATEGORY.slug)
    .filter((slug) => (countBySlug.get(slug) ?? 0) > 0 && !imageBySlug.get(slug));

  const thumbBySlug = new Map<string, string | null>();
  await Promise.all(
    slugsNeedingThumb.map(async (slug) => {
      const product = await prisma.product.findFirst({
        where: {
          ...baseWhere,
          ...(slug === OTHER_SHOP_CATEGORY.slug
            ? {
                OR: [
                  { shopCategorySlug: OTHER_SHOP_CATEGORY.slug },
                  { shopCategorySlug: null },
                ],
              }
            : { shopCategorySlug: slug }),
        },
        select: {
          images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      thumbBySlug.set(slug, product?.images[0]?.url ?? null);
    })
  );

  const items: ShopCategoryItem[] = [];

  for (const def of defs) {
    const productCount = countBySlug.get(def.slug) ?? 0;
    if (productCount === 0) continue;
    items.push({
      slug: def.slug,
      name: def.name,
      productCount,
      imageUrl: imageBySlug.get(def.slug) ?? thumbBySlug.get(def.slug) ?? null,
    });
  }

  // Include orphan slugs (assigned but not in current defs) so storefront matches PDF.
  for (const [slug, productCount] of countBySlug) {
    if (slug === OTHER_SHOP_CATEGORY.slug) continue;
    if (defs.some((def) => def.slug === slug)) continue;
    if (productCount <= 0) continue;
    items.push({
      slug,
      name: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      productCount,
      imageUrl: imageBySlug.get(slug) ?? thumbBySlug.get(slug) ?? null,
    });
  }

  const otherCount = countBySlug.get(OTHER_SHOP_CATEGORY.slug) ?? 0;
  if (otherCount > 0) {
    items.push({
      slug: OTHER_SHOP_CATEGORY.slug,
      name: OTHER_SHOP_CATEGORY.name,
      productCount: otherCount,
      imageUrl: thumbBySlug.get(OTHER_SHOP_CATEGORY.slug) ?? null,
    });
  }

  return items.sort((a, b) => {
    if (a.slug === OTHER_SHOP_CATEGORY.slug) return 1;
    if (b.slug === OTHER_SHOP_CATEGORY.slug) return -1;
    const orderA = defs.find((d) => d.slug === a.slug)?.sortOrder ?? 99;
    const orderB = defs.find((d) => d.slug === b.slug)?.sortOrder ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return b.productCount - a.productCount;
  });
}

/** @deprecated Prefer exclusive resolvePrimaryShopCategory filtering */
export function shopCategoryOrFilter(def: ShopCategoryDef) {
  if (def.isFallback || def.slug === OTHER_SHOP_CATEGORY.slug) {
    return [];
  }
  const seen = new Set<string>();
  return def.keywords
    .filter((kw) => {
      const key = kw.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((kw) => ({ name: { contains: kw } }));
}

/** @deprecated Prefer exclusive resolvePrimaryShopCategory filtering */
export function otherShopCategoryFilter(defs: ShopCategoryDef[]) {
  const allKeywords = defs
    .filter((d) => !d.isFallback && d.keywords.length > 0)
    .flatMap((d) => d.keywords);

  const seen = new Set<string>();
  const unique = allKeywords.filter((kw) => {
    const key = kw.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length === 0) return [{ name: { not: "" } }];

  return [
    {
      AND: unique.map((kw) => ({
        NOT: { name: { contains: kw } },
      })),
    },
  ];
}
