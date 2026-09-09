"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { announceSiteDataUpdate } from "@/components/LiveDataRefresh";
import { CatalogueImportForm } from "@/components/admin/CatalogueImportForm";
import { CatalogueImage } from "@/components/admin/CatalogueImage";
import { UiSelect } from "@/components/ui/UiSelect";
import {
  CategoryScroll,
  type ShopCategoryItem,
} from "@/components/store/CategoryScroll";
import { ALL_PRODUCTS_CATEGORY_SLUG } from "@/lib/store-category-navigation";

const PAGE_SIZE_OPTIONS = [15, 30, 50] as const;

interface ProductRow {
  id: string;
  name: string;
  productId: string;
  status: string;
  prices: { amount: number; type: string }[];
  inventory?: { quantity: number; isInStock: boolean } | null;
  images: { url: string }[];
  brand?: { name: string } | null;
}

interface ManageCataloguePanelProps {
  catalogueId: string;
  catalogueName: string;
  catalogueSlug: string;
}

interface AdminShopCategory extends ShopCategoryItem {
  id: string;
  keywords: string[];
  sortOrder: number;
}

export function ManageCataloguePanel({
  catalogueId,
  catalogueName,
  catalogueSlug,
}: ManageCataloguePanelProps) {
  const [tab, setTab] = useState<"products" | "categories" | "import">("products");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [catalogueTotal, setCatalogueTotal] = useState(0);
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [selectedCategorySlug, setSelectedCategorySlug] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(15);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<AdminShopCategory[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPaginate = total > pageSize;
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/catalogues/${catalogueId}/products?q=${encodeURIComponent(appliedQ)}&shop=${encodeURIComponent(selectedCategorySlug)}&page=${page}&limit=${pageSize}&_=${Date.now()}`,
        { cache: "no-store", headers: { "Cache-Control": "no-store" } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load products");
      const nextTotal = data.total ?? 0;
      const nextTotalPages = Math.max(1, Math.ceil(nextTotal / pageSize));
      setProducts(data.products ?? []);
      setTotal(nextTotal);
      setCatalogueTotal(data.catalogueTotal ?? nextTotal);
      if (page > nextTotalPages) {
        setPage(nextTotalPages);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load products");
    } finally {
      setLoading(false);
    }
  }, [appliedQ, catalogueId, selectedCategorySlug, page, pageSize]);

  const loadCategories = useCallback(async () => {
    const res = await fetch(`/api/admin/catalogues/${catalogueId}/categories?_=${Date.now()}`, {
      cache: "no-store",
    });
    const data = await res.json();
    setCategories(data.categories ?? []);
  }, [catalogueId]);

  useEffect(() => {
    if (tab === "products") {
      loadProducts();
      loadCategories();
    }
    if (tab === "categories") loadCategories();
  }, [tab, loadProducts, loadCategories]);

  function searchProducts() {
    const nextQuery = q.trim();
    if (nextQuery === appliedQ && page === 1) {
      void loadProducts();
      return;
    }
    setAppliedQ(nextQuery);
    setPage(1);
  }

  function selectCategory(slug: string | null) {
    setSelectedCategorySlug(
      !slug || slug === ALL_PRODUCTS_CATEGORY_SLUG ? "" : slug
    );
    setPage(1);
    setTab("products");
  }

  async function saveProduct(product: ProductRow, patch: Record<string, unknown>) {
    setError("");
    const res = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessage("Product updated — storefront refreshed");
      announceSiteDataUpdate();
      loadProducts();
    } else {
      setError((data as { error?: string }).error || "Product update failed");
    }
  }

  async function deleteProduct(id: string) {
    if (!confirm("Archive this product?")) return;
    setError("");
    const response = await fetch(`/api/admin/products/${id}`, {
      method: "DELETE",
      cache: "no-store",
    });
    if (response.ok) {
      setMessage("Product archived");
      announceSiteDataUpdate();
      if (products.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        loadProducts();
      }
    } else {
      setError("Could not archive product");
    }
  }

  async function regenerateCategories() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/admin/catalogues/${catalogueId}/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "regenerate" }),
      cache: "no-store",
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(`Regenerated ${data.regenerated ?? 0} categories`);
      announceSiteDataUpdate();
      loadCategories();
    } else {
      setError(data.error || "Could not regenerate categories");
    }
    setLoading(false);
  }

  async function downloadCataloguePdf(autoPrint = true) {
    setPdfLoading(true);
    setError("");
    try {
      const url = `/api/admin/catalogues/${catalogueId}/pdf${autoPrint ? "?print=1" : ""}`;
      const popup = window.open(url, "_blank", "noopener,noreferrer");
      if (!popup) {
        window.location.href = url;
      }
      setMessage(
        autoPrint
          ? "Catalogue PDF opened — logo, size options, and 9 product cards per page."
          : "Catalogue PDF preview opened."
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate catalogue PDF");
    } finally {
      setPdfLoading(false);
    }
  }

  const tabs = [
    { id: "products" as const, label: `Products (${catalogueTotal || total})` },
    { id: "categories" as const, label: "Shop categories" },
    { id: "import" as const, label: "Import Excel" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2 border-b border-border pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === t.id ? "bg-primary text-white" : "bg-surface-muted text-text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {tab === "products" && (
        <div>
          {categories.length > 0 && (
            <div className="mb-4 rounded-2xl border border-border bg-surface p-3 sm:p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-primary">
                    Browse products by category
                  </h3>
                  <p className="text-xs text-text-muted">
                    Click a category or use the dropdown. Every imported product remains available
                    under All products.
                  </p>
                </div>
                <UiSelect
                  value={selectedCategorySlug || ALL_PRODUCTS_CATEGORY_SLUG}
                  onValueChange={(value) => selectCategory(value)}
                  ariaLabel="Select product category"
                  options={[
                    {
                      value: ALL_PRODUCTS_CATEGORY_SLUG,
                      label: `All products (${catalogueTotal || total})`,
                    },
                    ...categories.map((category) => ({
                      value: category.slug,
                      label: `${category.name} (${category.productCount})`,
                    })),
                  ]}
                  className="min-h-[44px] w-full rounded-xl border border-border bg-white px-3 py-2 text-sm sm:w-64"
                />
              </div>
              <CategoryScroll
                categories={categories}
                environmentSlug={catalogueSlug}
                embedded
                showAllProducts
                allProductsCount={catalogueTotal || total}
                activeSlug={selectedCategorySlug || ALL_PRODUCTS_CATEGORY_SLUG}
                onSelect={selectCategory}
              />
            </div>
          )}

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") searchProducts();
              }}
              placeholder="Search products…"
              className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={searchProducts} className="btn-primary px-4 py-2 text-sm">
                Search
              </button>
              <button
                type="button"
                onClick={() => void downloadCataloguePdf(true)}
                disabled={pdfLoading || total === 0}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {pdfLoading ? "Preparing PDF…" : "Download PDF"}
              </button>
              <button
                type="button"
                onClick={() => void downloadCataloguePdf(false)}
                disabled={pdfLoading || total === 0}
                className="rounded-lg px-3 py-2 text-sm text-text-muted hover:text-primary disabled:opacity-50"
              >
                Preview
              </button>
            </div>
          </div>
          <p className="mb-4 text-xs text-text-muted">
            Print-ready A4 brochure: uploaded catalogue logo on every page, clearer product
            cards, and available sizes (S/M/L or mm sizes) listed when variants exist.
          </p>

          {loading ? (
            <p className="text-sm text-text-muted">Loading…</p>
          ) : products.length === 0 ? (
            <p className="text-sm text-text-muted">
              {catalogueTotal === 0
                ? "No products yet. Import an Excel file."
                : "No products match this category or search."}
            </p>
          ) : (
            <>
              <div className="space-y-3">
                {products.map((p) => {
                  const regular = p.prices.find((x) => x.type === "REGULAR")?.amount;
                  const sale = p.prices.find((x) => x.type === "SALE")?.amount;
                  return (
                    <div
                      key={p.id}
                      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white sm:h-14 sm:w-14">
                        {p.images[0] ? (
                          <CatalogueImage
                            src={p.images[0].url}
                            className="h-full w-full bg-white object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <input
                          defaultValue={p.name}
                          className="w-full rounded border border-transparent px-1 py-0.5 font-medium hover:border-border focus:border-border"
                          onBlur={(e) => {
                            if (e.target.value !== p.name) saveProduct(p, { name: e.target.value });
                          }}
                        />
                        <p className="text-xs text-text-muted">
                          {p.productId} · {p.brand?.name ?? "No brand"} · {p.status}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:flex-nowrap">
                        <input
                          type="number"
                          defaultValue={regular ?? ""}
                          placeholder="Price"
                          className="w-full min-w-[5rem] flex-1 rounded border border-border px-2 py-2 text-sm sm:w-20 sm:flex-none sm:py-1"
                          onBlur={(e) =>
                            saveProduct(p, { regularPrice: e.target.value || regular })
                          }
                        />
                        <input
                          type="number"
                          defaultValue={sale ?? ""}
                          placeholder="Sale"
                          className="w-full min-w-[5rem] flex-1 rounded border border-border px-2 py-2 text-sm sm:w-20 sm:flex-none sm:py-1"
                          onBlur={(e) =>
                            saveProduct(p, {
                              salePrice: e.target.value ? e.target.value : null,
                            })
                          }
                        />
                        <UiSelect
                          value={p.status}
                          options={[
                            { value: "ACTIVE", label: "Active" },
                            { value: "INACTIVE", label: "Inactive" },
                            { value: "DRAFT", label: "Draft" },
                          ]}
                          ariaLabel={`Status for ${p.name}`}
                          className="rounded border border-border px-2 py-1 text-xs"
                          onValueChange={(value) => saveProduct(p, { status: value })}
                        />
                        <button
                          type="button"
                          onClick={() => deleteProduct(p.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Archive
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm text-text-muted">
                <p>
                  Page {page} of {totalPages}
                  <span className="ml-2 text-xs">({total} products)</span>
                </p>

                <div className="flex items-center gap-2">
                  <span className="sr-only">
                    Products per page
                  </span>
                  <UiSelect
                    value={pageSize}
                    onValueChange={(value) => {
                      setPageSize(Number(value) as (typeof PAGE_SIZE_OPTIONS)[number]);
                      setPage(1);
                    }}
                    ariaLabel="Products per page"
                    options={PAGE_SIZE_OPTIONS.map((size) => ({
                      value: String(size),
                      label: String(size),
                    }))}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
                  />

                  {canPaginate && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Previous page"
                        disabled={!canGoPrev || loading}
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-text disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        aria-label="Next page"
                        disabled={!canGoNext || loading}
                        onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-text disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ›
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "categories" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-text-muted">
              Smart categories shown on {catalogueName} store home. Regenerate after imports.
            </p>
            <button
              type="button"
              onClick={regenerateCategories}
              disabled={loading}
              className="btn-primary px-4 py-2 text-sm"
            >
              Auto-generate from products
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {categories.map((cat) => (
              <button
                type="button"
                key={cat.id}
                onClick={() => selectCategory(cat.slug)}
                className="rounded-xl border border-border bg-surface p-4 text-left transition hover:border-primary/30 hover:shadow-sm"
              >
                <p className="font-medium">{cat.name}</p>
                <p className="mt-1 text-xs font-semibold text-primary">
                  {cat.productCount} products · Open products →
                </p>
                <p className="mt-1 text-xs text-text-muted">{cat.keywords.join(", ")}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "import" && (
        <div className="max-w-2xl">
          <CatalogueImportForm
            catalogueId={catalogueId}
            catalogueName={catalogueName}
            onImported={(importResult) => {
              setMessage(
                `Catalogue replaced — ${importResult.validRows} products live (created ${importResult.created}, updated ${importResult.updated}, archived ${importResult.archived})`
              );
              setPage(1);
              setQ("");
              setAppliedQ("");
              setTab("products");
              // Force reload even if page was already 1
              window.setTimeout(() => {
                void fetch(
                  `/api/admin/catalogues/${catalogueId}/products?page=1&limit=${pageSize}&_=${Date.now()}`,
                  { cache: "no-store" }
                )
                  .then((res) => res.json())
                  .then((data) => {
                    setProducts(data.products ?? []);
                    setTotal(data.total ?? 0);
                  });
                void loadCategories();
              }, 50);
            }}
          />
        </div>
      )}
    </div>
  );
}
