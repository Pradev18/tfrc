/**
 * One-shot: persist exclusive shopCategorySlug for all active products.
 * Usage: npx tsx scripts/backfill-shop-category-slugs.ts
 */
import prisma from "../src/lib/db";
import { getShopCategoryDefs } from "../src/lib/shop-categories";
import { syncEnvironmentShopCategories } from "../src/lib/shop-category-sync";

async function main() {
  const environments = await prisma.environment.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, slug: true, name: true },
  });

  for (const env of environments) {
    const dbDefs = await prisma.shopCategory.findMany({
      where: { environmentId: env.id, isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    const defs =
      dbDefs.length > 0
        ? dbDefs.map((row) => ({
            slug: row.slug,
            name: row.name,
            keywords: (() => {
              try {
                const parsed = JSON.parse(row.keywords);
                return Array.isArray(parsed) ? parsed.map(String) : [];
              } catch {
                return [];
              }
            })(),
            sortOrder: row.sortOrder,
          }))
        : getShopCategoryDefs(env.slug);

    if (defs.length === 0) {
      console.log(`[skip] ${env.slug}: no category defs`);
      continue;
    }

    const result = await syncEnvironmentShopCategories(env.id, defs);
    console.log(`[ok] ${env.slug}: updated ${result.updated}/${result.total}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
