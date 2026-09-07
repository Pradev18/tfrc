import prisma from "../src/lib/db";
import {
  compareVariantLabels,
  deriveProductVariantIdentity,
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

    const rows = products.map((product) => ({
      ...product,
      identity: deriveProductVariantIdentity({
        title: product.name,
        productId: product.productId,
      }),
    }));
    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      if (!row.identity.groupKey) continue;
      const group = groups.get(row.identity.groupKey) ?? [];
      group.push(row);
      groups.set(row.identity.groupKey, group);
    }
    for (const group of groups.values()) {
      group.sort((a, b) =>
        compareVariantLabels(a.identity.label, b.identity.label)
      );
    }

    let updated = 0;
    for (const row of rows) {
      const group = row.identity.groupKey
        ? groups.get(row.identity.groupKey)
        : undefined;
      const primaryId = group?.[0]?.id;
      await prisma.product.update({
        where: { id: row.id },
        data: {
          variantGroupKey: row.identity.groupKey,
          variantLabel: row.identity.label,
          isVariantPrimary: !row.identity.groupKey || row.id === primaryId,
        },
      });
      updated += 1;
    }

    console.log(`[ok] ${environment.slug}: classified ${updated} products, ${groups.size} variant groups`);
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
