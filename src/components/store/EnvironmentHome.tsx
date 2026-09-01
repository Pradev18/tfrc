import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/public/ProductCard";
import { StoreHero } from "@/components/store/StoreHero";
import { CategoryScroll, type ShopCategoryItem } from "@/components/store/CategoryScroll";
import { MobileStickyBar } from "@/components/store/MobileStickyBar";
import { PromoBanner } from "@/components/store/PromoBanner";
import { TodaysDealsSection } from "@/components/store/TodaysDealsSection";
import { DealsAnnouncementBar } from "@/components/store/DealsAnnouncementBar";
import { getEnvVisual, envStyle } from "@/lib/env-visuals";
import type { ParsedEnvironment } from "@/services/environment.service";
import type { ProductWithRelations } from "@/services/product.service";
import type { WhatsAppSettings } from "@/lib/whatsapp";

interface EnvironmentHomeProps {
  environment: ParsedEnvironment;
  featured: ProductWithRelations[];
  saleProducts: ProductWithRelations[];
  todaysDeals: ProductWithRelations[];
  shopCategories: ShopCategoryItem[];
  waHref: string;
  whatsappSettings: WhatsAppSettings;
  siteUrl: string;
}

export function EnvironmentHome({
  environment,
  featured,
  saleProducts,
  todaysDeals,
  shopCategories,
  waHref,
  whatsappSettings,
  siteUrl,
}: EnvironmentHomeProps) {
  const slug = environment.slug;
  const config = environment.config;
  const v = getEnvVisual(slug);
  const products = featured.length > 0 ? featured : saleProducts;

  return (
    <div style={{ ...envStyle(v), backgroundColor: v.sectionAlt }}>
      <DealsAnnouncementBar
        href={`/${slug}/catalogue?sale=true&sort=discount`}
        label={`Today's Deals at ${config.displayName} — shop discounted items`}
      />

      <StoreHero config={config} slug={slug} waHref={waHref} />

      <CategoryScroll categories={shopCategories} environmentSlug={slug} />

      <div
        className="border-y py-4"
        style={{ borderColor: v.border, backgroundColor: v.surface }}
      >
        <div className="container-pawmart flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-center">
          {[
            "Real product photos",
            "WhatsApp checkout",
            "Today's deals daily",
            "Qatar delivery",
          ].map((t) => (
            <span
              key={t}
              className="text-[11px] font-medium uppercase tracking-[0.15em]"
              style={{ color: v.muted }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <TodaysDealsSection
        products={todaysDeals}
        whatsappSettings={whatsappSettings}
        siteUrl={siteUrl}
        environmentSlug={slug}
        environmentName={config.displayName}
      />

      {saleProducts.length > 0 && (
        <PromoBanner products={saleProducts} environmentSlug={slug} title="More deals & offers" />
      )}

      {products.length > 0 && (
        <section className="store-section py-10 md:py-14" style={{ backgroundColor: v.sectionAlt }}>
          <div className="container-pawmart">
            <div className="mb-6 flex items-end justify-between border-b pb-4" style={{ borderColor: v.border }}>
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.22em]"
                  style={{ color: v.muted }}
                >
                  Best sellers
                </p>
                <h2 className="mt-1 font-display text-xl font-medium md:text-2xl" style={{ color: v.heading }}>
                  Popular products
                </h2>
              </div>
              <Link
                href={`/${slug}/catalogue`}
                className="hidden items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5 sm:inline-flex"
                style={{ color: v.ctaText, backgroundColor: v.cta }}
              >
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {products.slice(0, 10).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  whatsappSettings={whatsappSettings}
                  environmentSlug={slug}
                  environmentName={config.displayName}
                  siteUrl={siteUrl}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      <MobileStickyBar slug={slug} waHref={waHref} />
    </div>
  );
}
