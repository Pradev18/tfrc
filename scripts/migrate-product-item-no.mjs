/**
 * Idempotent itemNo backfill (Postgres or legacy SQLite).
 * Schema columns come from `prisma db push` — this only fills null itemNo values.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function backfillItemNumbers() {
  const envs = await prisma.environment.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, slug: true },
  });

  for (const env of envs) {
    const products = await prisma.product.findMany({
      where: { environmentId: env.id, status: "ACTIVE", deletedAt: null },
      select: { id: true, itemNo: true, productId: true },
    });
    if (products.length === 0) continue;
    const missing = products.filter((p) => p.itemNo == null);
    if (missing.length === 0) continue;

    if (missing.length === products.length) {
      const ordered = [...products].sort((a, b) =>
        String(a.productId).localeCompare(String(b.productId), undefined, {
          numeric: true,
          sensitivity: "base",
        })
      );
      for (let i = 0; i < ordered.length; i++) {
        await prisma.product.update({
          where: { id: ordered[i].id },
          data: { itemNo: i + 1 },
        });
      }
      console.log(
        `[db] Backfilled itemNo 1…${ordered.length} for ${env.slug}`
      );
      continue;
    }

    const maxExisting = products.reduce(
      (max, p) => (p.itemNo != null && p.itemNo > max ? p.itemNo : max),
      0
    );
    let next = maxExisting + 1;
    for (const product of missing) {
      await prisma.product.update({
        where: { id: product.id },
        data: { itemNo: next },
      });
      next += 1;
    }
    console.log(
      `[db] Filled ${missing.length} missing itemNo values for ${env.slug}`
    );
  }
}

try {
  await backfillItemNumbers();
  console.log("[db] Product.itemNo backfill complete");
} catch (error) {
  console.warn("[db] itemNo migration warning:", error?.message ?? error);
} finally {
  await prisma.$disconnect();
}
