import { Suspense } from "react";
import type { ShopCategoryItem } from "@/components/store/CategoryScroll";
import { MobileStickyBar } from "@/components/store/MobileStickyBar";
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
  totalProducts: number;
}

export function EnvironmentHome({
  environment,
  shopCategories,
  brands,
  whatsappSettings,
  siteUrl,
  totalProducts,
}: EnvironmentHomeProps) {
  const slug = environment.slug;
  const config = environment.config;
  const v = getEnvVisual(slug);

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${config.displayName} Catalogue | TFRC Qatar`,
    description: config.description,
    url: `${siteUrl}/${slug}`,
    isPartOf: {
      "@type": "WebSite",
      name: "TFRC Vita Nova",
      url: siteUrl,
    },
    about: {
      "@type": "Organization",
      name: "TFRC",
      url: siteUrl,
    },
    numberOfItems: totalProducts,
    hasPart: shopCategories.map((category) => ({
      "@type": "CollectionPage",
      name: category.name,
      url: `${siteUrl}/${slug}#category-${category.slug}`,
    })),
  };

  return (
    <div className="relative min-h-screen overflow-x-clip" style={{ ...envStyle(v), backgroundColor: "transparent" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <StorePageBackdrop slug={slug} />

      <Suspense fallback={null}>
        <UnifiedStoreCatalog
          environmentSlug={slug}
          environmentName={config.displayName}
          shopCategories={shopCategories}
          brands={brands}
          whatsappSettings={whatsappSettings}
          siteUrl={siteUrl}
          totalProducts={totalProducts}
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
