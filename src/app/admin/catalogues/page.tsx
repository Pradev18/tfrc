import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listCatalogues } from "@/services/catalogue-admin.service";
import { CatalogueImage } from "@/components/admin/CatalogueImage";

export default async function CataloguesListPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const catalogues = await listCatalogues(true);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-display text-3xl text-primary">Manage catalogues</h1>
          <p className="mt-1 text-text-muted">Products, categories & imports per catalogue</p>
        </div>
        <Link href="/admin/catalogues/new" className="btn-primary px-5 py-2.5 text-sm">
          + Create catalogue
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {catalogues.map((cat) => (
          <Link
            key={cat.id}
            href={`/admin/catalogues/${cat.id}`}
            className="group rounded-xl border border-border bg-surface p-5 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start gap-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-muted">
                {cat.cardImage ? (
                  <CatalogueImage
                    src={cat.cardImage}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-2xl">{cat.icon}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-primary group-hover:underline">{cat.name}</p>
                <p className="text-xs text-text-muted">/{cat.slug}</p>
                <p className="mt-1 text-sm text-text-muted">
                  {cat.productCount} products · {cat.shopCategoryCount} categories
                </p>
                <span
                  className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    cat.status === "ACTIVE"
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {cat.status}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {catalogues.length === 0 && (
        <p className="mt-12 text-center text-text-muted">
          No catalogues yet.{" "}
          <Link href="/admin/catalogues/new" className="text-primary underline">
            Create your first
          </Link>
        </p>
      )}
    </div>
  );
}
