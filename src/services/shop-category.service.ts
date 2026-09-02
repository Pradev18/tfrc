import prisma from "@/lib/db";
import { getEnvironmentIdBySlug } from "@/services/environment.service";
import {
  buildShopCategoryNameFilter,
  getEffectiveShopCategoryDefs,
  getShopCategoryDefs,
  OTHER_SHOP_CATEGORY,
  type ShopCategoryDef,
} from "@/lib/shop-categories";
import { getCachedEnvironment } from "@/lib/catalog-cache";

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

/** Count-based category index — does not load entire catalogue into memory */
export async function getShopCategories(environmentSlug: string): Promise<ShopCategoryItem[]> {
  try {
    return await getShopCategoriesFromPrisma(environmentSlug);
  } catch (error) {
    console.error("[shop-categories] prisma failed, using cache:", error);
    return getShopCategoriesFromCache(environmentSlug);
  }
}

function getShopCategoriesFromCache(environmentSlug: string): ShopCategoryItem[] {
  const cached = getCachedEnvironment(environmentSlug);
  if (!cached) return [];

  const defs = getEffectiveShopCategoryDefs(
    environmentSlug,
    cached.products.map((p) => p.name)
  );

  return defs
    .map((def) => {
      if (def.isFallback || def.slug === OTHER_SHOP_CATEGORY.slug) {
        const keywordSet = defs
          .filter((d) => !d.isFallback && d.keywords.length)
          .flatMap((d) => d.keywords.map((k) => k.toLowerCase()));
        const other = cached.products.filter(
          (p) => !keywordSet.some((kw) => p.name.toLowerCase().includes(kw))
        );
        return {
          slug: OTHER_SHOP_CATEGORY.slug,
          name: OTHER_SHOP_CATEGORY.name,
          productCount: other.length,
          imageUrl: other[0]?.images[0]?.url ?? null,
        };
      }
      const matched = cached.products.filter((p) =>
        def.keywords.some((kw) => p.name.toLowerCase().includes(kw.toLowerCase()))
      );
      if (matched.length === 0) return null;
      return {
        slug: def.slug,
        name: def.name,
        productCount: matched.length,
        imageUrl: matched[0]?.images[0]?.url ?? null,
      };
    })
    .filter(Boolean) as ShopCategoryItem[];
}

async function getShopCategoriesFromPrisma(environmentSlug: string): Promise<ShopCategoryItem[]> {
  const environmentId = await getEnvironmentIdBySlug(environmentSlug);
  if (!environmentId) return getShopCategoriesFromCache(environmentSlug);

  const baseWhere = {
    environmentId,
    status: "ACTIVE" as const,
    deletedAt: null,
  };

  let defs = await getDbShopCategoryDefs(environmentId);
  if (defs.length === 0) {
    defs = getShopCategoryDefs(environmentSlug);
  }

  if (defs.length === 0) {
    const sample = await prisma.product.findMany({
      where: baseWhere,
      select: { name: true },
      take: 3000,
      orderBy: { createdAt: "desc" },
    });
    defs = getEffectiveShopCategoryDefs(
      environmentSlug,
      sample.map((p) => p.name)
    );
  }

  if (defs.length === 0) return [];

  const dbRows = await prisma.shopCategory.findMany({
    where: { environmentId, isActive: true },
    select: { slug: true, imageUrl: true },
  });
  const imageBySlug = new Map(dbRows.map((r) => [r.slug, r.imageUrl]));

  const items: ShopCategoryItem[] = [];

  for (const def of defs) {
    const orFilter = shopCategoryOrFilter(def);
    if (orFilter.length === 0) continue;

    const [count, sample] = await Promise.all([
      prisma.product.count({ where: { ...baseWhere, OR: orFilter } }),
      prisma.product.findFirst({
        where: { ...baseWhere, OR: orFilter },
        select: {
          images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
        },
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      }),
    ]);

    if (count === 0) continue;

    items.push({
      slug: def.slug,
      name: def.name,
      productCount: count,
      imageUrl: imageBySlug.get(def.slug) ?? sample?.images[0]?.url ?? null,
    });
  }

  const otherOr = otherShopCategoryFilter(defs);
  if (otherOr.length > 0) {
    const [otherCount, otherSample] = await Promise.all([
      prisma.product.count({ where: { ...baseWhere, OR: otherOr } }),
      prisma.product.findFirst({
        where: { ...baseWhere, OR: otherOr },
        select: {
          images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    if (otherCount > 0) {
      items.push({
        slug: OTHER_SHOP_CATEGORY.slug,
        name: OTHER_SHOP_CATEGORY.name,
        productCount: otherCount,
        imageUrl: otherSample?.images[0]?.url ?? null,
      });
    }
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

export function shopCategoryOrFilter(def: ShopCategoryDef) {
  if (def.isFallback || def.slug === OTHER_SHOP_CATEGORY.slug) {
    return [];
  }
  return buildShopCategoryNameFilter([def]);
}

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
