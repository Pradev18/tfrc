"use client";

import { Flame, Search, SlidersHorizontal, X } from "lucide-react";
import { getEnvVisual } from "@/lib/env-visuals";
import type { StoreFilters } from "@/lib/store-catalog-filter";
import type { ShopCategoryItem } from "@/components/store/CategoryScroll";

interface Brand {
  id: string;
  name: string;
  slug: string;
}

interface StickyStoreToolbarProps {
  environmentSlug: string;
  shopCategories: ShopCategoryItem[];
  brands: Brand[];
  filters: StoreFilters;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onFiltersChange: (patch: Partial<StoreFilters>) => void;
  onClear: () => void;
  totalLabel?: string;
}

const chipClass =
  "inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full px-3.5 text-xs font-semibold sm:min-h-[36px] sm:px-3 sm:py-2";

export function StickyStoreToolbar({
  environmentSlug,
  shopCategories,
  brands,
  filters,
  searchInput,
  onSearchInputChange,
  onFiltersChange,
  onClear,
  totalLabel,
}: StickyStoreToolbarProps) {
  const v = getEnvVisual(environmentSlug);
  const hasActiveFilters = Boolean(
    filters.q || filters.shop || filters.brand || filters.sale || filters.inStock
  );

  return (
    <div className="store-sticky-toolbar pb-3 pt-2 md:pb-4">
      <div className="glass-panel-elevated rounded-2xl p-3 shadow-lg sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: v.muted }}
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => onSearchInputChange(e.target.value)}
              placeholder="Search products..."
              className="w-full min-h-[44px] rounded-full border border-white/80 bg-white/80 py-2.5 pl-10 pr-4 text-base sm:text-sm backdrop-blur-sm focus:border-[#141414]/20 focus:outline-none focus:ring-2 focus:ring-[#141414]/10"
              aria-label="Search products"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={() => {
                document.getElementById("deals")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={`${chipClass} gap-1 border border-white/70 bg-white/70`}
              style={{ color: v.heading }}
            >
              <Flame className="h-3.5 w-3.5" />
              Deals
            </button>

            <button
              type="button"
              onClick={() => onFiltersChange({ inStock: !filters.inStock })}
              className={`${chipClass} ${filters.inStock ? "text-white" : "border border-white/70 bg-white/70"}`}
              style={filters.inStock ? { backgroundColor: v.cta } : { color: v.heading }}
            >
              In stock
            </button>

            <select
              value={filters.brand ?? ""}
              onChange={(e) => onFiltersChange({ brand: e.target.value || null })}
              className={`${chipClass} w-full border border-white/70 bg-white/70 sm:max-w-[9rem] focus:outline-none`}
              style={{ color: v.heading }}
            >
              <option value="">All brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>

            <select
              value={filters.sort}
              onChange={(e) =>
                onFiltersChange({ sort: e.target.value as StoreFilters["sort"] })
              }
              className={`${chipClass} w-full border border-white/70 bg-white/70 focus:outline-none`}
              style={{ color: v.heading }}
            >
              <option value="newest">Newest</option>
              <option value="featured">Featured</option>
              <option value="price_asc">Price ↑</option>
              <option value="price_desc">Price ↓</option>
              <option value="discount">Discount</option>
              <option value="name">A–Z</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={onClear}
                className={`${chipClass} col-span-2 gap-1 text-[#9c9690] hover:text-[#141414] sm:col-span-1`}
              >
                <X className="h-3.5 w-3.5" />
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <SlidersHorizontal className="hidden h-3.5 w-3.5 shrink-0 sm:block" style={{ color: v.muted }} />
          <div className="scrollbar-hide -mx-1 flex flex-1 gap-2 overflow-x-auto px-1 pb-1">
            <button
              type="button"
              onClick={() => onFiltersChange({ shop: null })}
              className={`${chipClass} ${!filters.shop ? "text-white" : "bg-white/70 text-[#6b6560]"}`}
              style={!filters.shop ? { backgroundColor: v.cta } : undefined}
            >
              All
            </button>
            {shopCategories.map((cat) => (
              <button
                key={cat.slug}
                type="button"
                onClick={() => {
                  const next = filters.shop === cat.slug ? null : cat.slug;
                  onFiltersChange({ shop: next });
                  if (next) {
                    requestAnimationFrame(() => {
                      document
                        .getElementById(`category-${cat.slug}`)
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    });
                  }
                }}
                className={`${chipClass} whitespace-nowrap ${
                  filters.shop === cat.slug ? "text-white" : "bg-white/70"
                }`}
                style={
                  filters.shop === cat.slug
                    ? { backgroundColor: v.cta }
                    : { color: v.heading }
                }
              >
                {cat.name} ({cat.productCount})
              </button>
            ))}
          </div>
        </div>

        {totalLabel && (
          <p className="mt-2 text-[11px] font-medium sm:text-xs" style={{ color: v.muted }}>
            {totalLabel}
          </p>
        )}
      </div>
    </div>
  );
}
