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
  emptyMessage?: string;
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="store-glass-product aspect-[3/4] animate-pulse rounded-2xl bg-white/50" />
      ))}
    </div>
  );
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
  emptyMessage = "No products found",
}: PaginatedProductGridProps) {
  const v = getEnvVisual(environmentSlug);
  const { items, total, loading, loadingMore, error, loadMore, page, totalPages } =
    useStoreProductFeed(environmentSlug, filters, {
      shopSlug,
      onSaleOnly,
      enabled,
    });
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || page >= totalPages) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading && !loadingMore) loadMore();
      },
      { rootMargin: "500px 0px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMore, loading, loadingMore, page, totalPages]);

  if (!enabled) return null;

  if (loading && items.length === 0) {
    return <ProductGridSkeleton />;
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
        {items.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            whatsappSettings={whatsappSettings}
            environmentSlug={environmentSlug}
            environmentName={environmentName}
            siteUrl={siteUrl}
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
            {loadingMore ? "Loading…" : `Load more (${items.length} of ${total})`}
          </button>
          <p className="text-xs" style={{ color: v.muted }}>
            More products load automatically as you scroll
          </p>
        </div>
      )}
    </>
  );
}
