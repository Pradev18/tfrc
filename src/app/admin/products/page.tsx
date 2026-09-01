import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db";
import { mapProductPrices } from "@/services/product.service";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const limit = 20;
  const skip = (page - 1) * limit;

  const where = params.q
    ? {
        OR: [
          { name: { contains: params.q } },
          { productId: { contains: params.q } },
          { sku: { contains: params.q } },
        ],
      }
    : {};

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        prices: true,
        category: true,
        brand: true,
        inventory: true,
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-display text-3xl text-primary">Products</h1>
        <Link href="/admin/imports" className="btn-primary text-sm">
          Import Excel
        </Link>
      </div>

      <form className="mt-6">
        <input
          name="q"
          defaultValue={params.q}
          placeholder="Search products..."
          className="w-full max-w-md rounded-md border border-border px-3 py-2 text-sm"
        />
      </form>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-muted">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Product</th>
              <th className="px-4 py-3 text-left font-medium">ID</th>
              <th className="px-4 py-3 text-left font-medium">Category</th>
              <th className="px-4 py-3 text-left font-medium">Price</th>
              <th className="px-4 py-3 text-left font-medium">Stock</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const { pricing } = mapProductPrices(product as never);
              return (
                <tr key={product.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.images[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.images[0].url}
                          alt=""
                          className="h-10 w-10 rounded object-cover"
                        />
                      )}
                      <span className="font-medium">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{product.productId}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {product.category?.name ?? product.departmentSource ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {pricing.isOnSale ? (
                      <span>
                        <span className="text-text-muted line-through mr-1">
                          {pricing.regular.toFixed(2)}
                        </span>
                        {pricing.displayPrice.toFixed(2)} QAR
                      </span>
                    ) : (
                      <span>{pricing.displayPrice.toFixed(2)} QAR</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {product.inventory?.isInStock ? "In stock" : "Out"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      {product.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm text-text-muted">
        Showing {products.length} of {total} products
      </p>
    </div>
  );
}
