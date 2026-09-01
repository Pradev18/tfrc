"use client";

import { PaginatedProductGrid } from "@/components/store/PaginatedProductGrid";
import { useLazyVisible } from "@/hooks/useLazyVisible";
import { getEnvVisual } from "@/lib/env-visuals";
import type { StoreFilters } from "@/lib/store-catalog-filter";
import type { WhatsAppSettings } from "@/lib/whatsapp";

interface LazyCategorySectionProps {
  slug: string;
  name: string;
  productCount: number;
  environmentSlug: string;
  environmentName: string;
  filters: StoreFilters;
  whatsappSettings: WhatsAppSettings;
  siteUrl: string;
  forceVisible?: boolean;
}

export function LazyCategorySection({
  slug,
  name,
  productCount,
  environmentSlug,
  environmentName,
  filters,
  whatsappSettings,
  siteUrl,
  forceVisible = false,
}: LazyCategorySectionProps) {
  const v = getEnvVisual(environmentSlug);
  const { ref, visible } = useLazyVisible("280px");
  const isActive = forceVisible || visible;

  return (
    <section
      id={`category-${slug}`}
      ref={ref}
      className="scroll-anchor-section pb-2 pt-8 md:pt-10"
    >
      <div
        className="mb-5 flex items-end justify-between gap-4 border-b pb-3"
        style={{ borderColor: v.border }}
      >
        <div>
          <h3 className="font-display text-xl font-medium md:text-2xl" style={{ color: v.heading }}>
            {name}
          </h3>
          <p className="text-sm" style={{ color: v.muted }}>
            {productCount} products
          </p>
        </div>
      </div>

      {isActive ? (
        <PaginatedProductGrid
          environmentSlug={environmentSlug}
          environmentName={environmentName}
          filters={filters}
          whatsappSettings={whatsappSettings}
          siteUrl={siteUrl}
          shopSlug={slug}
          enabled
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="store-glass-product aspect-[3/4] animate-pulse rounded-2xl bg-white/40"
            />
          ))}
        </div>
      )}
    </section>
  );
}
