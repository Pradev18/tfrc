"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StickyStoreToolbar } from "@/components/store/StickyStoreToolbar";
import { PaginatedProductGrid } from "@/components/store/PaginatedProductGrid";
import { LazyCategorySection } from "@/components/store/LazyCategorySection";
import { getEnvVisual } from "@/lib/env-visuals";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { STORE_SEARCH_DEBOUNCE_MS } from "@/lib/store-constants";
import {
  DEFAULT_STORE_FILTERS,
  filtersToSearchParams,
  isSerialNoSort,
  parseStoreFilters,
  type StoreFilters,
} from "@/lib/store-catalog-filter";
import type { WhatsAppSettings } from "@/lib/whatsapp";
import type { ShopCategoryItem } from "@/components/store/CategoryScroll";
import type { StoreBrandItem } from "@/components/store/BrandScroll";
import {
  prefetchStoreFeed,
  seedStoreFeedCache,
  type InitialStoreFeed,
} from "@/hooks/useStoreProductFeed";
import {
  ALL_PRODUCTS_CATEGORY_SLUG,
  focusStoreCategory,
  scrollToStoreCategory,
  showAllStoreCategories,
  showAllStoreProducts,
  STORE_ALL_PRODUCTS_EVENT,
  STORE_CATEGORY_FOCUS_EVENT,
  STORE_SHOW_ALL_EVENT,
  syncStoreStickyOffsets,
} from "@/lib/store-category-navigation";
import { useT } from "@/context/LanguageContext";

interface UnifiedStoreCatalogProps {
  environmentSlug: string;
  environmentName: string;
  shopCategories: ShopCategoryItem[];
  brands: StoreBrandItem[];
  whatsappSettings: WhatsAppSettings;
  siteUrl: string;
  totalProducts: number;
  initialFeed?: InitialStoreFeed | null;
}

export function UnifiedStoreCatalog({
  environmentSlug,
  environmentName,
  shopCategories,
  brands,
  whatsappSettings,
  siteUrl,
  totalProducts,
  initialFeed = null,
}: UnifiedStoreCatalogProps) {
  const t = useT();
  const v = getEnvVisual(environmentSlug);
  const searchParams = useSearchParams();
  const basePath = `/${environmentSlug}`;

  const [filters, setFilters] = useState<StoreFilters>(() =>
    parseStoreFilters(Object.fromEntries(searchParams.entries()))
  );
  const filtersRef = useRef(filters);
  const [searchInput, setSearchInput] = useState(filters.q);
  const [focusedCategorySlug, setFocusedCategorySlug] = useState<string | null>(
    () => parseStoreFilters(Object.fromEntries(searchParams.entries())).shop
  );
  const [showAllProducts, setShowAllProducts] = useState(() => {
    const parsed = parseStoreFilters(Object.fromEntries(searchParams.entries()));
    if (parsed.shop) return false;
    return isSerialNoSort(parsed.sort);
  });

  const debouncedQ = useDebouncedValue(searchInput, STORE_SEARCH_DEBOUNCE_MS);

  const apiFilters = useMemo(
    () => ({
      ...filters,
      q: debouncedQ,
      shop: focusedCategorySlug ?? filters.shop,
    }),
    [filters, debouncedQ, focusedCategorySlug]
  );

  useEffect(() => {
    const next = parseStoreFilters(Object.fromEntries(searchParams.entries()));
    filtersRef.current = next;
    setFilters(next);
    if (next.shop) {
      setFocusedCategorySlug(next.shop);
      setShowAllProducts(false);
    }
  }, [searchParams]);

  useEffect(() => {
    setSearchInput(filters.q);
  }, [filters.q]);

  useEffect(() => {
    if (debouncedQ === filtersRef.current.q) return;
    const next = { ...filtersRef.current, q: debouncedQ };
    filtersRef.current = next;
    startTransition(() => setFilters(next));
    const qs = filtersToSearchParams(next).toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${basePath}?${qs}#catalog` : `${basePath}#catalog`
    );
  }, [debouncedQ, basePath]);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const categorySlug = hash.startsWith("#category-")
      ? hash.slice("#category-".length)
      : null;
    if (categorySlug && shopCategories.some((category) => category.slug === categorySlug)) {
      setFocusedCategorySlug(categorySlug);
      setShowAllProducts(false);
      const next = { ...filtersRef.current, shop: categorySlug };
      filtersRef.current = next;
      setFilters(next);
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.querySelector(hash)?.scrollIntoView({ behavior: "auto", block: "start" });
        syncStoreStickyOffsets();
      });
    });
  }, [shopCategories]);

  useEffect(() => {
    function onFocus(event: Event) {
      const slug = (event as CustomEvent<{ slug?: string }>).detail?.slug;
      if (!slug) return;
      setShowAllProducts(false);
      setFocusedCategorySlug(slug);
      const next = { ...filtersRef.current, shop: slug };
      filtersRef.current = next;
      startTransition(() => setFilters(next));
      const qs = filtersToSearchParams(next).toString();
      window.history.replaceState(
        null,
        "",
        qs ? `${basePath}?${qs}#category-${slug}` : `${basePath}#category-${slug}`
      );
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToStoreCategory(slug));
      });
    }
    function onShowAll() {
      setFocusedCategorySlug(null);
      setShowAllProducts(false);
      const next = { ...filtersRef.current, shop: null };
      filtersRef.current = next;
      startTransition(() => setFilters(next));
      const qs = filtersToSearchParams(next).toString();
      window.history.replaceState(
        null,
        "",
        qs ? `${basePath}?${qs}#catalog` : `${basePath}#catalog`
      );
      requestAnimationFrame(() => {
        document.getElementById("catalog")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
    function onAllProducts() {
      setFocusedCategorySlug(null);
      setShowAllProducts(true);
      // All products means the full catalogue — clear any active brand filter.
      const next = { ...filtersRef.current, shop: null, brand: null };
      filtersRef.current = next;
      setFilters(next);
      const qs = filtersToSearchParams(next).toString();
      window.history.replaceState(
        null,
        "",
        qs ? `${basePath}?${qs}#catalog` : `${basePath}#catalog`
      );
      requestAnimationFrame(() => {
        document.getElementById("catalog")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
    window.addEventListener(STORE_CATEGORY_FOCUS_EVENT, onFocus);
    window.addEventListener(STORE_SHOW_ALL_EVENT, onShowAll);
    window.addEventListener(STORE_ALL_PRODUCTS_EVENT, onAllProducts);
    return () => {
      window.removeEventListener(STORE_CATEGORY_FOCUS_EVENT, onFocus);
      window.removeEventListener(STORE_SHOW_ALL_EVENT, onShowAll);
      window.removeEventListener(STORE_ALL_PRODUCTS_EVENT, onAllProducts);
    };
  }, [basePath]);

  const syncFilters = useCallback(
    (patch: Partial<StoreFilters>) => {
      const next = { ...filtersRef.current, ...patch };
      const serialSort = isSerialNoSort(next.sort);
      // Brand picks should stay on the All products list so the heading updates.
      if ("brand" in patch && patch.brand) {
        setFocusedCategorySlug(null);
        setShowAllProducts(true);
        next.shop = null;
      } else if ("shop" in patch) {
        const shopSlug = patch.shop ?? null;
        setFocusedCategorySlug(shopSlug);
        setShowAllProducts(!shopSlug && serialSort);
      } else if (serialSort && !next.shop) {
        setFocusedCategorySlug(null);
        setShowAllProducts(true);
      }
      filtersRef.current = next;
      if ("q" in patch && patch.q !== undefined) setSearchInput(patch.q);
      const qs = filtersToSearchParams(next).toString();
      const hash = next.shop ? `#category-${next.shop}` : "#catalog";
      const href = qs ? `${basePath}?${qs}${hash}` : `${basePath}${hash}`;
      // Sync filter state immediately so the heading/count update on the same tap.
      // history.replaceState avoids a full App Router RSC refetch (was making brand taps laggy).
      setFilters(next);
      window.history.replaceState(null, "", href);
    },
    [basePath]
  );

  const prefetchBrand = useCallback(
    (brandSlug: string) => {
      prefetchStoreFeed(
        environmentSlug,
        { ...filtersRef.current, brand: brandSlug, shop: null },
        { includeVariants: true }
      );
    },
    [environmentSlug]
  );

  const clearFilters = useCallback(() => {
    setSearchInput("");
    setFocusedCategorySlug(null);
    setShowAllProducts(false);
    filtersRef.current = DEFAULT_STORE_FILTERS;
    startTransition(() => {
      setFilters(DEFAULT_STORE_FILTERS);
    });
    window.history.replaceState(null, "", `${basePath}#catalog`);
  }, [basePath]);

  // Brand filter must keep the category strip + pills usable.
  // Only search / stock / sale collapse into a results-only layout.
  const hidesBrowseStrips = Boolean(
    apiFilters.q || apiFilters.inStock || apiFilters.sale
  );
  const isFilteredView = hidesBrowseStrips;

  useEffect(() => {
    syncStoreStickyOffsets();
    const onResize = () => syncStoreStickyOffsets();
    window.addEventListener("resize", onResize);
    const timer = window.setTimeout(syncStoreStickyOffsets, 120);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(timer);
    };
  }, [focusedCategorySlug, showAllProducts, isFilteredView, searchInput, shopCategories.length, brands.length, apiFilters.brand]);

  const visibleCategories = useMemo(() => {
    if (isFilteredView || showAllProducts) return [];
    return focusedCategorySlug
      ? shopCategories.filter((category) => category.slug === focusedCategorySlug)
      : shopCategories;
  }, [focusedCategorySlug, isFilteredView, shopCategories, showAllProducts]);

  const selectCategory = useCallback((slug: string) => {
    setShowAllProducts(false);
    focusStoreCategory(slug);
  }, []);

  const selectAllProducts = useCallback(() => {
    showAllStoreProducts();
  }, []);

  useEffect(() => {
    if (initialFeed?.items.length) {
      seedStoreFeedCache(environmentSlug, { ...DEFAULT_STORE_FILTERS, shop: null }, initialFeed);
    }
  }, [environmentSlug, initialFeed]);

  useEffect(() => {
    if (isFilteredView) return;
    if (showAllProducts) {
      const timer = window.setTimeout(() => {
        prefetchStoreFeed(environmentSlug, { ...apiFilters, shop: null }, {
          includeVariants: true,
        });
      }, 200);
      return () => window.clearTimeout(timer);
    }
    // Prefetch only the next category — avoid hammering SQLite with 3 parallel feeds.
    const preferred = focusedCategorySlug
      ? shopCategories.filter((category) => category.slug === focusedCategorySlug)
      : shopCategories.slice(0, 1);
    const nextCategory = focusedCategorySlug
      ? null
      : shopCategories[1];
    const timers = [
      ...preferred.map((category) =>
        window.setTimeout(() => {
          if (initialFeed?.shopSlug === category.slug) return;
          prefetchStoreFeed(environmentSlug, { ...apiFilters, shop: null }, {
            shopSlug: category.slug,
          });
        }, 80)
      ),
      ...(nextCategory
        ? [
            window.setTimeout(() => {
              prefetchStoreFeed(environmentSlug, { ...apiFilters, shop: null }, {
                shopSlug: nextCategory.slug,
              });
            }, 400),
          ]
        : []),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [
    apiFilters,
    environmentSlug,
    focusedCategorySlug,
    initialFeed,
    isFilteredView,
    shopCategories,
    showAllProducts,
  ]);

  const activeCategorySlug = showAllProducts
    ? ALL_PRODUCTS_CATEGORY_SLUG
    : focusedCategorySlug;

  const activeBrand = useMemo(
    () => brands.find((brand) => brand.slug === apiFilters.brand) ?? null,
    [brands, apiFilters.brand]
  );
  const browseTitle = activeBrand?.name ?? t("store.allProducts");
  const browseProductCount = activeBrand?.productCount ?? totalProducts;
  const browseCategoryCount = activeBrand?.categoryCount ?? shopCategories.length;
  const browseSummary = t("store.productsCategories", {
    products: browseProductCount.toLocaleString(),
    categories: browseCategoryCount,
  });

  return (
    <section id="catalog" className="store-section scroll-anchor-catalog pb-6 pt-3 md:pb-24 md:pt-5">
      <div className="container-pawmart">
        <div className="mb-3 md:mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: v.muted }}>
            {t("store.fullCatalogue", { name: environmentName })}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl" style={{ color: v.heading }}>
            {t("store.catalogueTitle", { name: environmentName })}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed md:text-[15px]" style={{ color: v.body }}>
            {t("store.browseHint")}
          </p>
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
          activeCategorySlug={activeCategorySlug}
          onCategorySelect={selectCategory}
          onShowAllCategories={() => showAllStoreCategories()}
          onAllProductsSelect={selectAllProducts}
          totalProducts={totalProducts}
          totalLabel={browseSummary}
          showCategories={!hidesBrowseStrips}
          showBrands={!hidesBrowseStrips}
          onBrandPrefetch={prefetchBrand}
        />

        {isFilteredView ? (
          <div className="mt-6 md:mt-8">
            {activeBrand ? (
              <div className="mb-4">
                <h2 className="text-lg font-semibold tracking-tight" style={{ color: v.heading }}>
                  {browseTitle}
                </h2>
                <p className="mt-1 text-sm" style={{ color: v.muted }}>
                  {browseSummary}
                </p>
              </div>
            ) : null}
            <PaginatedProductGrid
              environmentSlug={environmentSlug}
              environmentName={environmentName}
              filters={apiFilters}
              shopSlug={apiFilters.shop ?? undefined}
              whatsappSettings={whatsappSettings}
              siteUrl={siteUrl}
              emptyMessage={t("store.noMatch")}
            />
          </div>
        ) : showAllProducts ? (
          <div className="mt-6 md:mt-8">
            <div className="mb-4">
              <h2 className="text-lg font-semibold tracking-tight" style={{ color: v.heading }}>
                {browseTitle}
              </h2>
              <p className="mt-1 text-sm" style={{ color: v.muted }}>
                {browseSummary}
              </p>
            </div>
            <PaginatedProductGrid
              environmentSlug={environmentSlug}
              environmentName={environmentName}
              filters={apiFilters}
              whatsappSettings={whatsappSettings}
              siteUrl={siteUrl}
              includeVariants
              emptyMessage={t("store.noMatch")}
            />
          </div>
        ) : (
          <div className="mt-2">
            {visibleCategories.map((cat, index) => (
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
                forceVisible={focusedCategorySlug === cat.slug || index === 0}
                initialFeed={
                  initialFeed?.shopSlug === cat.slug ? initialFeed : null
                }
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
