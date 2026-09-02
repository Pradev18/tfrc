"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { announceSiteDataUpdate } from "@/components/LiveDataRefresh";
import { CatalogueImportForm } from "@/components/admin/CatalogueImportForm";

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
}

export function ManageCataloguePanel({ catalogueId, catalogueName }: ManageCataloguePanelProps) {
  const [tab, setTab] = useState<"products" | "categories" | "import">("products");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(15);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<
    { id: string; name: string; slug: string; keywords: string[]; sortOrder: number }[]
  >([]);
  const [message, setMessage] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPaginate = total > pageSize;
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      `/api/admin/catalogues/${catalogueId}/products?q=${encodeURIComponent(q)}&page=${page}&limit=${pageSize}`
    );
    const data = await res.json();
    const nextTotal = data.total ?? 0;
    const nextTotalPages = Math.max(1, Math.ceil(nextTotal / pageSize));
    setProducts(data.products ?? []);
    setTotal(nextTotal);
    if (page > nextTotalPages) {
      setPage(nextTotalPages);
    }
    setLoading(false);
  }, [catalogueId, q, page, pageSize]);

  const loadCategories = useCallback(async () => {
    const res = await fetch(`/api/admin/catalogues/${catalogueId}/categories`);
    const data = await res.json();
    setCategories(data.categories ?? []);
  }, [catalogueId]);

  useEffect(() => {
    if (tab === "products") loadProducts();
    if (tab === "categories") loadCategories();
  }, [tab, loadProducts, loadCategories]);

  function searchProducts() {
    setPage(1);
    // loadProducts runs via effect when page is already 1; force reload otherwise
    if (page === 1) loadProducts();
  }

  async function saveProduct(product: ProductRow, patch: Record<string, unknown>) {
    const res = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      setMessage("Product updated");
      announceSiteDataUpdate();
      loadProducts();
    }
  }

  async function deleteProduct(id: string) {
    if (!confirm("Archive this product?")) return;
    const response = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    if (response.ok) {
      announceSiteDataUpdate();
      if (products.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        loadProducts();
      }
    }
  }

  async function regenerateCategories() {
    setLoading(true);
    const res = await fetch(`/api/admin/catalogues/${catalogueId}/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "regenerate" }),
    });
    const data = await res.json();
    setMessage(`Regenerated ${data.regenerated ?? 0} categories`);
    if (res.ok) announceSiteDataUpdate();
    loadCategories();
    setLoading(false);
  }

  const tabs = [
    { id: "products" as const, label: `Products (${total})` },
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

      {tab === "products" && (
        <div>
          <div className="mb-4 flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") searchProducts();
              }}
              placeholder="Search products…"
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
            />
            <button type="button" onClick={searchProducts} className="btn-primary px-4 py-2 text-sm">
              Search
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-text-muted">Loading…</p>
          ) : products.length === 0 ? (
            <p className="text-sm text-text-muted">No products yet. Import an Excel file.</p>
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
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-muted sm:h-14 sm:w-14">
                        {p.images[0] ? (
                          <Image src={p.images[0].url} alt="" fill className="object-cover" />
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
                        <select
                          defaultValue={p.status}
                          className="rounded border border-border px-2 py-1 text-xs"
                          onChange={(e) => saveProduct(p, { status: e.target.value })}
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="INACTIVE">Inactive</option>
                          <option value="DRAFT">Draft</option>
                        </select>
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
                  <label className="sr-only" htmlFor="admin-product-page-size">
                    Products per page
                  </label>
                  <select
                    id="admin-product-page-size"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]);
                      setPage(1);
                    }}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>

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
              <div key={cat.id} className="rounded-xl border border-border bg-surface p-4">
                <p className="font-medium">{cat.name}</p>
                <p className="mt-1 text-xs text-text-muted">{cat.keywords.join(", ")}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "import" && (
        <div className="max-w-2xl">
          <CatalogueImportForm
            catalogueId={catalogueId}
            catalogueName={catalogueName}
            onImported={() => {
              setMessage("Catalogue replaced successfully");
              setPage(1);
              if (page === 1) loadProducts();
              loadCategories();
            }}
          />
        </div>
      )}
    </div>
  );
}
