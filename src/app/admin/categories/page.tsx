import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db";
import { getCategoryProductCount } from "@/services/category.service";

export default async function AdminCategoriesPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const categories = await prisma.category.findMany({
    include: { parent: true },
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  const counts = await Promise.all(
    categories.map(async (c) => ({
      id: c.id,
      count: await getCategoryProductCount(c.id),
    }))
  );
  const countMap = Object.fromEntries(counts.map((c) => [c.id, c.count]));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-display text-3xl text-primary">Categories</h1>
        <span className="text-sm text-text-muted">{categories.length} categories</span>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-muted">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Slug</th>
              <th className="px-4 py-3 text-left">Parent</th>
              <th className="px-4 py-3 text-left">Products</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">View</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id} className="border-b border-border">
                <td className="px-4 py-3 font-medium">{cat.name}</td>
                <td className="px-4 py-3 text-text-muted">{cat.slug}</td>
                <td className="px-4 py-3 text-text-muted">{cat.parent?.name ?? "—"}</td>
                <td className="px-4 py-3">{countMap[cat.id] ?? 0}</td>
                <td className="px-4 py-3">{cat.isActive ? "Active" : "Inactive"}</td>
                <td className="px-4 py-3">
                  <Link href={`/catalogue/${cat.slug}`} className="text-primary hover:underline" target="_blank">
                    Public →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
