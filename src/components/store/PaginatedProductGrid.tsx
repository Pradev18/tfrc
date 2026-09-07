"use client";

import { useEffect, useRef } from "react";
import { ProductCard } from "@/components/public/ProductCard";
import { useStoreProductFeed } from "@/hooks/useStoreProductFeed";
import { getEnvVisual } from "@/lib/env-visuals";
import type { StoreFilters } from "@/lib/store-catalog-filter";
import type { WhatsAppSettings } from "@/lib/whatsapp";

interface PaginatedProductGridProps {
  environmentSlug: string;
  environmentName: string;
  filters: StoreFilters;
  whatsappSettings: WhatsAppSettings;
  siteUrl: string;
  shopSlug?: string;
  onSaleOnly?: boolean;
  enabled?: boolean;
  includeVariants?: boolean;
  emptyMessage?: string;
}

export function PaginatedProductGrid({
  environmentSlug,
  environmentName,
  filters,
  whatsappSettings,
  siteUrl,
  shopSlug,
  onSaleOnly,
  enabled = true,
  includeVariants = false,
  emptyMessage = "No products found",
}: PaginatedProductGridProps) {
  const v = getEnvVisual(environmentSlug);
  const { items, total, loading, loadingMore, error, loadMore, page, totalPages } =
    useStoreProductFeed(environmentSlug, filters, {
      shopSlug,
      onSaleOnly,
      enabled,
      includeVariants,
    });
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || page >= totalPages) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading && !loadingMore) loadMore();
      },
      { rootMargin: "240px 0px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMore, loading, loadingMore, page, totalPages]);

  if (!enabled) return null;

  // page === 0 means the first request has not settled yet.
  const waitingForFirstPage = items.length === 0 && (loading || page === 0);

  if (waitingForFirstPage) {
    return (
      <div aria-busy="true" aria-live="polite">
        <p className="mb-4 text-sm font-medium" style={{ color: v.muted }}>
          Loading products…
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-2xl border border-black/[0.04] bg-white/70"
            >
              <div className="aspect-square bg-[#f3f5f4]" />
              <div className="space-y-2 p-3">
                <div className="h-3 w-20 rounded-full bg-[#e8ecea]" />
                <div className="h-3 w-28 rounded-full bg-[#eef1ef]" />
                <div className="h-3 w-16 rounded-full bg-[#e8ecea]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="glass-panel rounded-2xl py-12 text-center text-sm" style={{ color: v.muted }}>
        {error}
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <div className="glass-panel rounded-2xl py-12 text-center text-sm" style={{ color: v.muted }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            whatsappSettings={whatsappSettings}
            environmentSlug={environmentSlug}
            environmentName={environmentName}
            siteUrl={siteUrl}
            variantPreselected={includeVariants}
            eagerPrefetch={index < 2}
          />
        ))}
      </div>

      {page < totalPages && (
        <div ref={loadMoreRef} className="mt-6 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="min-h-[48px] rounded-full px-6 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ backgroundColor: v.cta }}
          >
            {`Load more (${items.length} of ${total})`}
          </button>
          <p className="text-xs" style={{ color: v.muted }}>
            More products load automatically as you scroll
          </p>
        </div>
      )}
    </>
  );
}
