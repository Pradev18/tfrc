import prisma from "../src/lib/db";
import {
  classifyProductVariants,
  compareVariantLabels,
} from "../src/lib/product-variants";

async function main() {
  const environments = await prisma.environment.findMany({
    select: { id: true, slug: true },
  });

  for (const environment of environments) {
    const products = await prisma.product.findMany({
      where: { environmentId: environment.id, deletedAt: null },
      select: { id: true, productId: true, name: true },
    });

    const classified = classifyProductVariants(products);

    const groups = new Map<string, typeof classified>();
    for (const row of classified) {
      if (!row.groupKey) continue;
      const group = groups.get(row.groupKey) ?? [];
      group.push(row);
      groups.set(row.groupKey, group);
    }
    for (const group of groups.values()) {
      group.sort((a, b) => compareVariantLabels(a.label, b.label));
    }

    let updated = 0;
    for (const row of classified) {
      const group = row.groupKey ? groups.get(row.groupKey) : undefined;
      const primaryId = group?.[0]?.id;
      await prisma.product.update({
        where: { id: row.id },
        data: {
          variantGroupKey: row.groupKey,
          variantLabel: row.label,
          isVariantPrimary: !row.groupKey || row.id === primaryId,
        },
      });
      updated += 1;
    }

    console.log(
      `[ok] ${environment.slug}: classified ${updated} products, ${groups.size} variant groups`
    );
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
