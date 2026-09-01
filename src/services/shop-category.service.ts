import prisma from "@/lib/db";
import { getEnvironmentIdBySlug } from "@/services/environment.service";
import {
  getShopCategoryDefs,
  productMatchesShopCategory,
  type ShopCategoryDef,
} from "@/lib/shop-categories";

export interface ShopCategoryItem {
  slug: string;
  name: string;
  productCount: number;
  imageUrl: string | null;
}

export async function getShopCategories(environmentSlug: string): Promise<ShopCategoryItem[]> {
  const defs = getShopCategoryDefs(environmentSlug);
  if (defs.length === 0) return [];

  const environmentId = await getEnvironmentIdBySlug(environmentSlug);
  if (!environmentId) return [];

  const products = await prisma.product.findMany({
    where: { environmentId, status: "ACTIVE", deletedAt: null },
    select: {
      name: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
    },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
  });

  const tallies = new Map<string, { count: number; imageUrl: string | null }>();
  for (const def of defs) {
    tallies.set(def.slug, { count: 0, imageUrl: null });
  }

  for (const product of products) {
    for (const def of defs) {
      if (!productMatchesShopCategory(product.name, def)) continue;
      const entry = tallies.get(def.slug)!;
      entry.count += 1;
      if (!entry.imageUrl && product.images[0]?.url) {
        entry.imageUrl = product.images[0].url;
      }
    }
  }

  return defs
    .map((def) => {
      const entry = tallies.get(def.slug)!;
      return {
        slug: def.slug,
        name: def.name,
        productCount: entry.count,
        imageUrl: entry.imageUrl,
      };
    })
    .filter((c) => c.productCount > 0)
    .sort((a, b) => {
      const orderA = defs.find((d) => d.slug === a.slug)?.sortOrder ?? 99;
      const orderB = defs.find((d) => d.slug === b.slug)?.sortOrder ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return b.productCount - a.productCount;
    });
}

export function shopCategoryOrFilter(def: ShopCategoryDef) {
  return def.keywords.map((kw) => ({ name: { contains: kw } }));
}
