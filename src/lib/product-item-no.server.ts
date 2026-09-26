import prisma from "@/lib/db";

/**
 * Ensure every active product has an itemNo for storefront Item no ↑/↓ sorting.
 * - If Excel already set itemNo, leave those values alone.
 * - If none are set (legacy imports), assign 1…N in stable productId order.
 * - If some are set, fill gaps with max+1… without reordering existing numbers.
 *
 * Uses one bulk UPDATE (Neon) — never one query per product.
 */
export async function ensureEnvironmentItemNumbers(
  environmentId: string
): Promise<{ assigned: number; total: number }> {
  const products = await prisma.product.findMany({
    where: { environmentId, status: "ACTIVE", deletedAt: null },
    select: { id: true, itemNo: true, productId: true },
    orderBy: { productId: "asc" },
  });

  if (products.length === 0) return { assigned: 0, total: 0 };

  const missing = products.filter((product) => product.itemNo == null);
  if (missing.length === 0) return { assigned: 0, total: products.length };

  const assignments: Array<{ id: string; itemNo: number }> = [];

  if (missing.length === products.length) {
    const ordered = [...products].sort((a, b) =>
      String(a.productId).localeCompare(String(b.productId), undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
    for (let index = 0; index < ordered.length; index++) {
      assignments.push({ id: ordered[index]!.id, itemNo: index + 1 });
    }
  } else {
    const maxExisting = products.reduce(
      (max, product) =>
        product.itemNo != null && product.itemNo > max ? product.itemNo : max,
      0
    );
    let next = maxExisting + 1;
    for (const product of missing) {
      assignments.push({ id: product.id, itemNo: next });
      next += 1;
    }
  }

  const size = 500;
  for (let i = 0; i < assignments.length; i += size) {
    const chunk = assignments.slice(i, i + size);
    await prisma.$executeRawUnsafe(
      `
      UPDATE "catalog"."Product" AS p
      SET "itemNo" = v.item_no, "updatedAt" = NOW()
      FROM unnest($1::text[], $2::int[]) AS v(id, item_no)
      WHERE p.id = v.id
      `,
      chunk.map((row) => row.id),
      chunk.map((row) => row.itemNo)
    );
  }

  return { assigned: assignments.length, total: products.length };
}
