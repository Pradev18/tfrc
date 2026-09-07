"use client";

import { Flame, Search, X, LayoutGrid } from "lucide-react";
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
  onDealsSelect?: () => void;
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
  onDealsSelect,
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
      <div className="glass-panel-elevated rounded-2xl p-3 shadow-lg sm:p-4">
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
              placeholder="Search products..."
              className="w-full min-h-[44px] rounded-full border border-white/80 bg-white/80 py-2.5 pl-10 pr-4 text-base sm:text-sm backdrop-blur-sm focus:border-[#141414]/20 focus:outline-none focus:ring-2 focus:ring-[#141414]/10"
              aria-label="Search products"
            />
          </div>

          <div className="scrollbar-hide -mx-0.5 flex min-w-0 items-center gap-2 overflow-x-auto px-0.5 pb-0.5">
            <button
              type="button"
              onClick={() => {
                if (onDealsSelect) onDealsSelect();
                else
                  document
                    .getElementById("deals")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={`${chipClass} gap-1 border border-white/70 bg-white/70`}
              style={{ color: v.heading }}
            >
              <Flame className="h-3.5 w-3.5" />
              Deals
            </button>

            {activeCategorySlug && (
              <button
                type="button"
                onClick={() => onShowAllCategories?.()}
                className={`${chipClass} gap-1 border border-white/70 bg-white/70`}
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
                filters.inStock ? "text-white" : "border border-white/70 bg-white/70"
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
              className={`${chipClass} !w-auto min-w-[7rem] border-white/70 bg-white/70 sm:max-w-[9rem]`}
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
                { value: "discount", label: "Discount" },
                { value: "name", label: "A–Z" },
              ]}
              className={`${chipClass} !w-auto min-w-[6.5rem] border-white/70 bg-white/70`}
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
          <div className="mt-3 border-t border-black/[0.04] pt-3">
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
