import { Suspense } from "react";
import { StoreHero } from "@/components/store/StoreHero";
import { CategoryScroll, type ShopCategoryItem } from "@/components/store/CategoryScroll";
import { MobileStickyBar } from "@/components/store/MobileStickyBar";
import { DealsAnnouncementBar } from "@/components/store/DealsAnnouncementBar";
import { StorePageBackdrop } from "@/components/store/StorePageBackdrop";
import { UnifiedStoreCatalog } from "@/components/store/UnifiedStoreCatalog";
import { getEnvVisual, envStyle } from "@/lib/env-visuals";
import type { ParsedEnvironment } from "@/services/environment.service";
import type { WhatsAppSettings } from "@/lib/whatsapp";

interface Brand {
  id: string;
  name: string;
  slug: string;
}

interface EnvironmentHomeProps {
  environment: ParsedEnvironment;
  shopCategories: ShopCategoryItem[];
  brands: Brand[];
  waHref: string;
  whatsappSettings: WhatsAppSettings;
  siteUrl: string;
}

function CatalogFallback() {
  return (
    <div className="container-pawmart py-16">
      <div className="glass-panel h-48 animate-pulse rounded-2xl" />
    </div>
  );
}

const CATEGORY_SECTION_TITLES: Record<string, string> = {
  pawmart: "Shop pet essentials",
  hardware: "Shop tools & hardware",
  household: "Shop kitchen & home",
};

export function EnvironmentHome({
  environment,
  shopCategories,
  brands,
  waHref,
  whatsappSettings,
  siteUrl,
}: EnvironmentHomeProps) {
  const slug = environment.slug;
  const config = environment.config;
  const v = getEnvVisual(slug);

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ ...envStyle(v), backgroundColor: "transparent" }}>
      <StorePageBackdrop slug={slug} />

      <DealsAnnouncementBar
        href={`/${slug}#deals`}
        label={`Today's Deals at ${config.displayName} — all on this page`}
        environmentSlug={slug}
      />

      <StoreHero config={config} slug={slug} waHref={waHref} logoUrl={environment.logoUrl} />

      <CategoryScroll
        categories={shopCategories}
        environmentSlug={slug}
        title={CATEGORY_SECTION_TITLES[slug] ?? "Shop by category"}
      />

      <Suspense fallback={<CatalogFallback />}>
        <UnifiedStoreCatalog
          environmentSlug={slug}
          environmentName={config.displayName}
          shopCategories={shopCategories}
          brands={brands}
          whatsappSettings={whatsappSettings}
          siteUrl={siteUrl}
        />
      </Suspense>

      <MobileStickyBar
        slug={slug}
        environmentName={environment.config.displayName}
        whatsappSettings={whatsappSettings}
        siteUrl={siteUrl}
      />
    </div>
  );
}
