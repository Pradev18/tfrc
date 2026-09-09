"use client";

import { Search, X, LayoutGrid } from "lucide-react";
import { getEnvVisual } from "@/lib/env-visuals";
import { CategoryScroll, type ShopCategoryItem } from "@/components/store/CategoryScroll";
import type { StoreFilters } from "@/lib/store-catalog-filter";
import { UiSelect } from "@/components/ui/UiSelect";
import { scrollToStoreCategory, ALL_PRODUCTS_CATEGORY_SLUG } from "@/lib/store-category-navigation";

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
  activeCategorySlug?: string | null;
  onCategorySelect?: (slug: string) => void;
  onShowAllCategories?: () => void;
  onAllProductsSelect?: () => void;
  totalProducts?: number;
  totalLabel?: string;
  showCategories?: boolean;
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
  activeCategorySlug = null,
  onCategorySelect,
  onShowAllCategories,
  onAllProductsSelect,
  totalProducts,
  totalLabel,
  showCategories = true,
}: StickyStoreToolbarProps) {
  const v = getEnvVisual(environmentSlug);
  const hasActiveFilters = Boolean(
    filters.q ||
      filters.shop ||
      filters.brand ||
      filters.sale ||
      filters.inStock ||
      filters.sort !== "newest" ||
      Boolean(activeCategorySlug)
  );

  return (
    <div className="store-sticky-toolbar pb-2 pt-1 sm:pb-3 sm:pt-2 md:pb-4">
      <div className="rounded-2xl border border-black/[0.06] bg-white/95 p-3 shadow-sm sm:p-4">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: v.muted }}
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => onSearchInputChange(e.target.value)}
              placeholder="Search products, brands, item codes..."
              className="w-full min-h-[44px] rounded-full border border-black/[0.08] bg-white py-2.5 pl-10 pr-4 text-base sm:text-sm focus:border-[#141414]/25 focus:outline-none focus:ring-2 focus:ring-[#141414]/10"
              aria-label="Search products"
            />
          </div>

          <div className="scrollbar-hide -mx-0.5 flex min-w-0 items-center gap-2 overflow-x-auto px-0.5 pb-0.5">
            {activeCategorySlug && (
              <button
                type="button"
                onClick={() => onShowAllCategories?.()}
                className={`${chipClass} gap-1 border border-black/[0.08] bg-white`}
                style={{ color: v.heading }}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                All categories
              </button>
            )}

            <button
              type="button"
              onClick={() => onFiltersChange({ inStock: !filters.inStock })}
              className={`${chipClass} ${
                filters.inStock ? "text-white" : "border border-black/[0.08] bg-white"
              }`}
              style={filters.inStock ? { backgroundColor: v.cta } : { color: v.heading }}
            >
              In stock
            </button>

            <UiSelect
              value={filters.brand ?? ""}
              onValueChange={(value) => onFiltersChange({ brand: value || null })}
              ariaLabel="Filter by brand"
              options={[
                { value: "", label: "All brands" },
                ...brands.map((brand) => ({ value: brand.slug, label: brand.name })),
              ]}
              className={`${chipClass} !w-auto min-w-[7rem] border-black/[0.08] bg-white sm:max-w-[9rem]`}
            />

            <UiSelect
              value={filters.sort}
              onValueChange={(value) =>
                onFiltersChange({ sort: value as StoreFilters["sort"] })
              }
              ariaLabel="Sort products"
              options={[
                { value: "newest", label: "Newest" },
                { value: "featured", label: "Featured" },
                { value: "price_asc", label: "Price ↑" },
                { value: "price_desc", label: "Price ↓" },
                { value: "name", label: "A–Z" },
              ]}
              className={`${chipClass} !w-auto min-w-[6.5rem] border-black/[0.08] bg-white`}
            />

            {hasActiveFilters && (
              <button
                type="button"
                onClick={onClear}
                className={`${chipClass} gap-1 text-[#9c9690] hover:text-[#141414]`}
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>

        {showCategories && shopCategories.length > 0 && (
          <div className="mt-3 border-t border-black/[0.05] pt-3">
            <CategoryScroll
              categories={shopCategories}
              environmentSlug={environmentSlug}
              embedded
              activeSlug={activeCategorySlug}
              showAllProducts
              allProductsCount={totalProducts}
              onSelect={(slug) => {
                if (!slug) return;
                if (slug === ALL_PRODUCTS_CATEGORY_SLUG) {
                  onAllProductsSelect?.();
                  return;
                }
                if (onCategorySelect) onCategorySelect(slug);
                else scrollToStoreCategory(slug);
              }}
            />
          </div>
        )}

        {totalLabel && (
          <p className="mt-2 text-[11px] font-medium sm:text-xs" style={{ color: v.muted }}>
            {totalLabel}
          </p>
        )}
      </div>
    </div>
  );
}
