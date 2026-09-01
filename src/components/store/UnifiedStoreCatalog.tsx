"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Flame } from "lucide-react";
import { StickyStoreToolbar } from "@/components/store/StickyStoreToolbar";
import { PaginatedProductGrid } from "@/components/store/PaginatedProductGrid";
import { LazyCategorySection } from "@/components/store/LazyCategorySection";
import { getEnvVisual } from "@/lib/env-visuals";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { STORE_SEARCH_DEBOUNCE_MS } from "@/lib/store-constants";
import {
  DEFAULT_STORE_FILTERS,
  filtersToSearchParams,
  parseStoreFilters,
  type StoreFilters,
} from "@/lib/store-catalog-filter";
import type { WhatsAppSettings } from "@/lib/whatsapp";
import type { ShopCategoryItem } from "@/components/store/CategoryScroll";

interface Brand {
  id: string;
  name: string;
  slug: string;
}

interface UnifiedStoreCatalogProps {
  environmentSlug: string;
  environmentName: string;
  shopCategories: ShopCategoryItem[];
  brands: Brand[];
  whatsappSettings: WhatsAppSettings;
  siteUrl: string;
}

export function UnifiedStoreCatalog({
  environmentSlug,
  environmentName,
  shopCategories,
  brands,
  whatsappSettings,
  siteUrl,
}: UnifiedStoreCatalogProps) {
  const v = getEnvVisual(environmentSlug);
  const router = useRouter();
  const searchParams = useSearchParams();
  const basePath = `/${environmentSlug}`;

  const [filters, setFilters] = useState<StoreFilters>(() =>
    parseStoreFilters(Object.fromEntries(searchParams.entries()))
  );
  const [searchInput, setSearchInput] = useState(filters.q);

  const debouncedQ = useDebouncedValue(searchInput, STORE_SEARCH_DEBOUNCE_MS);

  const apiFilters = useMemo(
    () => ({ ...filters, q: debouncedQ }),
    [filters, debouncedQ]
  );

  useEffect(() => {
    setFilters(parseStoreFilters(Object.fromEntries(searchParams.entries())));
  }, [searchParams]);

  useEffect(() => {
    setSearchInput(filters.q);
  }, [filters.q]);

  useEffect(() => {
    if (debouncedQ === filters.q) return;
    setFilters((prev) => {
      const next = { ...prev, q: debouncedQ };
      const qs = filtersToSearchParams(next).toString();
      router.replace(qs ? `${basePath}?${qs}#catalog` : `${basePath}#catalog`, { scroll: false });
      return next;
    });
  }, [debouncedQ, filters.q, basePath, router]);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    requestAnimationFrame(() => {
      document.querySelector(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [searchParams]);

  const syncFilters = useCallback(
    (patch: Partial<StoreFilters>) => {
      setFilters((prev) => {
        const next = { ...prev, ...patch };
        if ("q" in patch && patch.q !== undefined) setSearchInput(patch.q);
        const qs = filtersToSearchParams(next).toString();
        router.replace(qs ? `${basePath}?${qs}#catalog` : `${basePath}#catalog`, { scroll: false });
        return next;
      });
    },
    [basePath, router]
  );

  const clearFilters = useCallback(() => {
    setSearchInput("");
    setFilters(DEFAULT_STORE_FILTERS);
    router.replace(`${basePath}#catalog`, { scroll: false });
  }, [basePath, router]);

  const isFilteredView = Boolean(
    apiFilters.q || apiFilters.brand || apiFilters.inStock
  );

  const visibleCategories = useMemo(() => {
    if (isFilteredView) return [];
    if (apiFilters.shop) {
      return shopCategories.filter((c) => c.slug === apiFilters.shop);
    }
    return shopCategories;
  }, [isFilteredView, apiFilters.shop, shopCategories]);

  const totalProducts = shopCategories.reduce((n, c) => n + c.productCount, 0);

  return (
    <section id="catalog" className="store-section scroll-anchor-catalog pb-6 pt-2 md:pb-24">
      <div className="container-pawmart">
        <div className="mb-2 md:mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: v.muted }}>
            Full catalogue
          </p>
          <h2 className="mt-1 font-display text-2xl font-medium md:text-3xl" style={{ color: v.heading }}>
            Browse & order
          </h2>
        </div>

        <StickyStoreToolbar
          environmentSlug={environmentSlug}
          shopCategories={shopCategories}
          brands={brands}
          filters={apiFilters}
          searchInput={searchInput}
          onSearchInputChange={setSearchInput}
          onFiltersChange={syncFilters}
          onClear={clearFilters}
          totalLabel={`${totalProducts.toLocaleString()} products · ${shopCategories.length} categories`}
        />

        {isFilteredView ? (
          <div className="mt-8">
            <PaginatedProductGrid
              environmentSlug={environmentSlug}
              environmentName={environmentName}
              filters={apiFilters}
              whatsappSettings={whatsappSettings}
              siteUrl={siteUrl}
              emptyMessage="No products match your search or filters"
            />
          </div>
        ) : (
          <>
            <div id="deals" className="scroll-anchor-section mt-8">
              <div className="mb-5 flex items-center gap-2.5">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: v.accent }}
                >
                  <Flame className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-display text-xl font-medium md:text-2xl" style={{ color: v.heading }}>
                    Today&apos;s Deals
                  </h3>
                  <p className="text-sm" style={{ color: v.muted }}>
                    All discounted products · load more as you browse
                  </p>
                </div>
              </div>
              <PaginatedProductGrid
                environmentSlug={environmentSlug}
                environmentName={environmentName}
                filters={apiFilters}
                whatsappSettings={whatsappSettings}
                siteUrl={siteUrl}
                onSaleOnly
              />
            </div>

            {visibleCategories.map((cat) => (
              <LazyCategorySection
                key={cat.slug}
                slug={cat.slug}
                name={cat.name}
                productCount={cat.productCount}
                environmentSlug={environmentSlug}
                environmentName={environmentName}
                filters={apiFilters}
                whatsappSettings={whatsappSettings}
                siteUrl={siteUrl}
                forceVisible={Boolean(apiFilters.shop)}
              />
            ))}
          </>
        )}
      </div>
    </section>
  );
}
