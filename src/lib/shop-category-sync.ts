import prisma from "@/lib/db";
import {
  OTHER_SHOP_CATEGORY,
  excelTaxonomyLeafSlug,
  resolvePrimaryShopCategory,
  shouldUseStrictExcelCategories,
  type ShopCategoryDef,
} from "@/lib/shop-categories";

/**
 * Assign exclusive shopCategorySlug for every active product in an environment.
 * Returns true when any rows were updated.
 */
export async function syncEnvironmentShopCategories(
  environmentId: string,
  defs: ShopCategoryDef[]
): Promise<{ updated: number; total: number }> {
  const products = await prisma.product.findMany({
    where: {
      environmentId,
      status: "ACTIVE",
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      googleCategory: true,
      fbCategory: true,
      shopCategorySlug: true,
    },
  });

  const defSlugs = new Set(defs.map((def) => def.slug));
  const strictExcel = shouldUseStrictExcelCategories(products);

  const updates = new Map<string, string[]>();
  for (const product of products) {
    const excelSlug = excelTaxonomyLeafSlug(product);
    let nextSlug: string;

    // TFRC-style Excel: always bucket by the Excel category column, never by product name.
    if (strictExcel && excelSlug) {
      nextSlug = excelSlug;
    } else if (excelSlug && defSlugs.has(excelSlug)) {
      nextSlug = excelSlug;
    } else {
      const primary = resolvePrimaryShopCategory(
        {
          name: product.name,
          googleCategory: product.googleCategory,
          fbCategory: product.fbCategory,
        },
        defs
      );
      nextSlug = primary?.slug ?? OTHER_SHOP_CATEGORY.slug;
    }

    if (product.shopCategorySlug === nextSlug) continue;
    const ids = updates.get(nextSlug) ?? [];
    ids.push(product.id);
    updates.set(nextSlug, ids);
  }

  let updated = 0;
  for (const [slug, ids] of updates) {
    const chunkSize = 200;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const result = await prisma.product.updateMany({
        where: { id: { in: chunk } },
        data: { shopCategorySlug: slug },
      });
      updated += result.count;
    }
  }

  return { updated, total: products.length };
}

export function resolveShopCategorySlugForProduct(
  product: {
    name: string;
    googleCategory?: string | null;
    fbCategory?: string | null;
  },
  defs: ShopCategoryDef[]
): string {
  const excelSlug = excelTaxonomyLeafSlug(product);
  if (
    excelSlug &&
    (shouldUseStrictExcelCategories([product]) ||
      defs.some((d) => d.slug === excelSlug))
  ) {
    return excelSlug;
  }
  return (
    resolvePrimaryShopCategory(
      {
        name: product.name,
        googleCategory: product.googleCategory,
        fbCategory: product.fbCategory,
      },
      defs
    )?.slug ?? OTHER_SHOP_CATEGORY.slug
  );
}
