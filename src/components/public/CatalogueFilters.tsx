"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface ShopCategory {
  slug: string;
  name: string;
  productCount?: number;
}

interface Brand {
  id: string;
  name: string;
  slug: string;
}

interface CatalogueFiltersProps {
  shopCategories: ShopCategory[];
  brands: Brand[];
  environmentSlug: string;
}

export function CatalogueFilters({ shopCategories, brands, environmentSlug }: CatalogueFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const basePath = `/${environmentSlug}/catalogue`;

  const update = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete("page");
      router.push(`${basePath}?${params.toString()}`);
    },
    [router, searchParams, basePath]
  );

  const labelClass = "mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-text-subtle";

  return (
    <div className="space-y-6 rounded-2xl border border-[#ebe8e3] bg-white p-5 md:p-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#9c9690]">Filters</p>

      <div>
        <label htmlFor="search" className={labelClass}>Search</label>
        <input
          id="search"
          type="search"
          defaultValue={searchParams.get("q") ?? ""}
          placeholder="Product name, ID..."
          className="w-full rounded-xl border border-[#ebe8e3] bg-[#faf9f7] px-3 py-2.5 text-sm focus:border-[#141414] focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              update("q", (e.target as HTMLInputElement).value || null);
            }
          }}
        />
      </div>

      <div>
        <p className={labelClass}>Category</p>
        <div className="max-h-56 space-y-0.5 overflow-y-auto">
          {shopCategories.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() =>
                update("shop", searchParams.get("shop") === cat.slug ? null : cat.slug)
              }
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                searchParams.get("shop") === cat.slug
                  ? "bg-[#141414] font-medium text-white"
                  : "text-[#6b6560] hover:bg-[#faf9f7] hover:text-[#141414]"
              }`}
            >
              <span>{cat.name}</span>
              {cat.productCount != null && (
                <span className="text-xs opacity-70">{cat.productCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className={labelClass}>Brand</p>
        <select
          value={searchParams.get("brand") ?? ""}
          onChange={(e) => update("brand", e.target.value || null)}
          className="w-full rounded-xl border border-[#ebe8e3] bg-[#faf9f7] px-3 py-2.5 text-sm focus:border-[#141414] focus:outline-none"
        >
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.slug}>{b.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2.5 border-t border-[#ebe8e3] pt-5">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={searchParams.get("sale") === "true"}
            onChange={(e) => update("sale", e.target.checked ? "true" : null)}
            className="border-border"
          />
          On sale only
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={searchParams.get("inStock") === "true"}
            onChange={(e) => update("inStock", e.target.checked ? "true" : null)}
            className="border-border"
          />
          In stock only
        </label>
      </div>

      <div>
        <p className={labelClass}>Sort</p>
        <select
          value={searchParams.get("sort") ?? "newest"}
          onChange={(e) => update("sort", e.target.value)}
          className="w-full rounded-xl border border-[#ebe8e3] bg-[#faf9f7] px-3 py-2.5 text-sm focus:border-[#141414] focus:outline-none"
        >
          <option value="newest">Newest</option>
          <option value="featured">Featured</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="discount">Biggest Discount</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      {searchParams.toString() && (
        <button
          type="button"
          onClick={() => router.push(basePath)}
          className="w-full rounded-full border border-[#ebe8e3] py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#9c9690] transition-colors hover:border-[#141414] hover:text-[#141414]"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
