"use client";

import { ProductGallery } from "@/components/public/ProductGallery";
import { ProductCard } from "@/components/public/ProductCard";
import { ProductPurchasePanel } from "@/components/public/ProductPurchasePanel";
import { ProductWidgetBoundary } from "@/components/public/ProductWidgetBoundary";
import { ProductMobileOrderBar } from "@/components/store/ProductMobileOrderBar";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { ProductViewTracker } from "@/components/analytics/ProductViewTracker";
import { getEnvVisual, envStyle } from "@/lib/env-visuals";
import type { EffectivePrice } from "@/lib/pricing";
import type { WhatsAppSettings } from "@/lib/whatsapp";
import type { ProductDetailSpec } from "@/components/public/ProductPurchasePanel";

interface ProductDetailPayload {
  envSlug: string;
  environmentName: string;
  siteUrl: string;
  product: {
    id: string;
    productId: string;
    slug: string;
    name: string;
    title: string;
    itemCode: string;
    brandName?: string;
    description?: string;
    variantLabel?: string;
    inStock: boolean;
    imageUrl?: string;
  };
  pricing: EffectivePrice;
  galleryImages: Array<{ url: string; altText?: string | null; isPrimary?: boolean }>;
  galleryVideos: Array<{ url: string }>;
  specs: ProductDetailSpec[];
  sizeVariants: Array<{
    id: string;
    productId: string;
    slug: string;
    name: string;
    label: string;
    inStock: boolean;
    price: number;
    currency: string;
    imageUrl?: string;
  }>;
  suggested: Array<Record<string, unknown>>;
  whatsappSettings: WhatsAppSettings;
  whatsappHref: string;
  whatsappMessage: string;
  initialSizeSelected: boolean;
  breadcrumbItems: Array<{ label?: string; labelKey?: string; href?: string }>;
}

export function ProductDetailClient({ payloadJson }: { payloadJson: string }) {
  let data: ProductDetailPayload;
  try {
    data = JSON.parse(payloadJson) as ProductDetailPayload;
  } catch (error) {
    console.error("[product-detail] invalid payload", error);
    return null;
  }

  const v = getEnvVisual(data.envSlug);
  const p = data.product;

  return (
    <>
      <ProductWidgetBoundary name="view-tracker">
        <ProductViewTracker
          productId={p.productId}
          name={p.name}
          price={data.pricing.displayPrice}
          currency={data.pricing.currency}
        />
      </ProductWidgetBoundary>

      <div style={{ ...envStyle(v), backgroundColor: "#f5f3f0" }}>
        <div className="container-pawmart py-6 md:py-10">
          <Breadcrumbs items={data.breadcrumbItems} />

          <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_380px] lg:gap-10 xl:grid-cols-[1fr_420px]">
            <div>
              <ProductWidgetBoundary
                name="gallery"
                fallback={
                  <div className="flex aspect-square items-center justify-center rounded-xl border border-[#ebe8e3] bg-white text-sm text-[#6b6560]">
                    Product image unavailable
                  </div>
                }
              >
                <ProductGallery
                  images={data.galleryImages}
                  videos={data.galleryVideos}
                  productName={p.title}
                />
              </ProductWidgetBoundary>

              {p.description ? (
                <div className="mt-8 rounded-xl border border-[#ebe8e3] bg-white p-5 md:p-6">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#6b6560]">
                    Product details
                  </h2>
                  <div className="whitespace-pre-line text-sm leading-relaxed text-[#141414] md:text-base">
                    {p.description}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="lg:sticky lg:top-[var(--store-header-height)] lg:self-start">
              {p.brandName ? (
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#9c9690]">
                  {p.brandName}
                </p>
              ) : null}
              <h1 className="text-xl font-semibold leading-snug text-[#141414] md:text-2xl">
                {p.title}
              </h1>
              {p.itemCode ? (
                <p className="mt-1.5 text-sm tabular-nums text-[#9c9690]">
                  Item code: {p.itemCode}
                </p>
              ) : null}

              <div className="mt-5">
                <ProductWidgetBoundary
                  name="purchase-panel"
                  fallback={
                    <a
                      href={data.whatsappHref}
                      className="flex min-h-[48px] items-center justify-center rounded-full bg-[#128c47] px-6 text-sm font-semibold text-white"
                    >
                      Order on WhatsApp
                    </a>
                  }
                >
                  <ProductPurchasePanel
                    dbId={p.id}
                    productId={p.productId}
                    slug={p.slug}
                    name={p.name}
                    itemCode={p.itemCode}
                    specs={data.specs}
                    pricing={data.pricing}
                    inStock={p.inStock}
                    imageUrl={p.imageUrl}
                    environmentSlug={data.envSlug}
                    environmentName={data.environmentName}
                    whatsappSettings={data.whatsappSettings}
                    siteUrl={data.siteUrl}
                    accentColor={v.cta}
                    sizeVariants={data.sizeVariants}
                    initialSizeSelected={data.initialSizeSelected}
                  />
                </ProductWidgetBoundary>
              </div>
            </div>
          </div>

          {data.suggested.length > 0 ? (
            <section className="mt-12 border-t border-[#ebe8e3] pt-10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9c9690]">
                Suggested products
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[#141414] md:text-2xl">
                Customers also bought
              </h2>
              <ProductWidgetBoundary name="suggested-products">
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 md:gap-4">
                  {data.suggested.map((card) => (
                    <ProductCard
                      key={String(card.id)}
                      product={card as never}
                      whatsappSettings={data.whatsappSettings}
                      environmentSlug={data.envSlug}
                      environmentName={data.environmentName}
                      siteUrl={data.siteUrl}
                      variant="compact"
                    />
                  ))}
                </div>
              </ProductWidgetBoundary>
            </section>
          ) : null}
        </div>
      </div>

      {(data.sizeVariants.length === 0 || data.initialSizeSelected) && (
        <ProductWidgetBoundary name="mobile-order-bar">
          <ProductMobileOrderBar
            whatsappSettings={data.whatsappSettings}
            siteUrl={data.siteUrl}
            singleProductWaHref={data.whatsappHref}
            singleProductInquiry={{
              eventType: "PRODUCT_WHATSAPP",
              environmentSlug: data.envSlug,
              environmentName: data.environmentName,
              itemCount: 1,
              estimatedTotal: data.pricing.displayPrice,
              currency: data.pricing.currency,
              whatsappUrl: data.whatsappHref,
              whatsappMessage: data.whatsappMessage,
              items: [
                {
                  productId: p.productId,
                  productName: p.name,
                  slug: p.slug,
                  price: data.pricing.displayPrice,
                  currency: data.pricing.currency,
                  environmentSlug: data.envSlug,
                  environmentName: data.environmentName,
                  quantity: 1,
                  size: p.variantLabel,
                },
              ],
            }}
            product={{
              id: p.id,
              productId: p.productId,
              slug: p.slug,
              name: p.name,
              price: data.pricing.displayPrice,
              currency: data.pricing.currency,
              imageUrl: p.imageUrl,
              environmentSlug: data.envSlug,
              environmentName: data.environmentName,
              variantLabel: p.variantLabel ?? null,
            }}
            accentColor={v.cta}
          />
        </ProductWidgetBoundary>
      )}
    </>
  );
}
