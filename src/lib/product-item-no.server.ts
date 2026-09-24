import prisma from "@/lib/db";

/**
 * Ensure every active product has an itemNo for storefront Item no ↑/↓ sorting.
 * - If Excel already set itemNo, leave those values alone.
 * - If none are set (legacy imports), assign 1…N in stable productId order.
 * - If some are set, fill gaps with max+1… without reordering existing numbers.
 *
 * Generic for every catalogue — no slug-specific logic.
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

  if (missing.length === products.length) {
    const ordered = [...products].sort((a, b) =>
      String(a.productId).localeCompare(String(b.productId), undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
    let assigned = 0;
    for (let index = 0; index < ordered.length; index++) {
      await prisma.product.update({
        where: { id: ordered[index]!.id },
        data: { itemNo: index + 1 },
      });
      assigned += 1;
    }
    return { assigned, total: products.length };
  }

  const maxExisting = products.reduce(
    (max, product) =>
      product.itemNo != null && product.itemNo > max ? product.itemNo : max,
    0
  );
  let next = maxExisting + 1;
  let assigned = 0;
  for (const product of missing) {
    await prisma.product.update({
      where: { id: product.id },
      data: { itemNo: next },
    });
    next += 1;
    assigned += 1;
  }
  return { assigned, total: products.length };
}
