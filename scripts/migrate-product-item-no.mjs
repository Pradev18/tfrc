/**
 * Idempotent SQLite column adds + itemNo backfill for live Hostinger DBs.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function columnExists(table, column) {
  const rows = await prisma.$queryRawUnsafe(`PRAGMA table_info(${table})`);
  return rows.some((row) => row.name === column);
}

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
  if (!(await columnExists("Product", "itemNo"))) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Product" ADD COLUMN "itemNo" INTEGER`
    );
    console.log("[db] Added Product.itemNo column");
  } else {
    console.log("[db] Product.itemNo already present");
  }

  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Product_environmentId_itemNo_idx" ON "Product"("environmentId", "itemNo")`
  );

  await backfillItemNumbers();
} catch (error) {
  console.warn("[db] itemNo migration warning:", error?.message ?? error);
} finally {
  await prisma.$disconnect();
}
