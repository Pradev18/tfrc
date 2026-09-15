/**
 * Rebuild shop categories for every active catalogue using pack inference.
 * Fixes "More to explore" dumps for newly created catalogues.
 *
 * Usage: npx tsx scripts/repair-shop-categories.ts
 *        npx tsx scripts/repair-shop-categories.ts pet-accessories
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { createRequire } from "node:module";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local"), override: true });

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
} as NodeModule;

async function main() {
  const { default: prisma } = await import("../src/lib/db");
  const { generateShopCategories } = await import("../src/services/catalogue-admin.service");
  const { OTHER_SHOP_CATEGORY } = await import("../src/lib/shop-categories");

  try {
    const arg = process.argv[2];
    const environments = await prisma.environment.findMany({
      where: arg
        ? { OR: [{ slug: arg }, { id: arg }] }
        : { status: "ACTIVE" },
      select: { id: true, slug: true, name: true },
      orderBy: { sortOrder: "asc" },
    });

    if (environments.length === 0) {
      throw new Error(arg ? `Catalogue not found: ${arg}` : "No active catalogues found");
    }

    for (const env of environments) {
      const before = await prisma.product.groupBy({
        by: ["shopCategorySlug"],
        where: {
          environmentId: env.id,
          status: "ACTIVE",
          deletedAt: null,
          isVariantPrimary: true,
        },
        _count: { _all: true },
      });

      const count = await generateShopCategories(env.id, env.slug);

      const after = await prisma.product.groupBy({
        by: ["shopCategorySlug"],
        where: {
          environmentId: env.id,
          status: "ACTIVE",
          deletedAt: null,
          isVariantPrimary: true,
        },
        _count: { _all: true },
      });

      const summarize = (
        rows: Array<{ shopCategorySlug: string | null; _count: { _all: number } }>
      ) =>
        Object.fromEntries(
          rows.map((row) => [
            row.shopCategorySlug ?? "null",
            row._count._all,
          ])
        );

      console.log(
        JSON.stringify(
          {
            catalogue: env.name,
            slug: env.slug,
            categoryDefsSeeded: count,
            before: summarize(before),
            after: summarize(after),
            otherAfter:
              after.find((row) => row.shopCategorySlug === OTHER_SHOP_CATEGORY.slug)?._count
                ._all ?? 0,
          },
          null,
          2
        )
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
