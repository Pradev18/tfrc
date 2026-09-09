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
  includeVariants?: boolean;
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
  includeVariants = false,
}: LazyCategorySectionProps) {
  const v = getEnvVisual(environmentSlug);
  const { ref, visible } = useLazyVisible("64px");
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
          <h3 className="text-xl font-semibold tracking-tight md:text-2xl" style={{ color: v.heading }}>
            {name}
          </h3>
          <p className="mt-0.5 text-sm" style={{ color: v.muted }}>
            {includeVariants
              ? "All products in this category"
              : `${productCount} ${productCount === 1 ? "product" : "products"}`}
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
          includeVariants={includeVariants}
        />
      ) : (
        <div className="min-h-px" aria-hidden />
      )}
    </section>
  );
}
