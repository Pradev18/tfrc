import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductGallery } from "@/components/public/ProductGallery";
import { ProductCard } from "@/components/public/ProductCard";
import { ProductPurchasePanel } from "@/components/public/ProductPurchasePanel";
import { ProductWidgetBoundary } from "@/components/public/ProductWidgetBoundary";
import { ProductMobileOrderBar } from "@/components/store/ProductMobileOrderBar";
import { Breadcrumbs, breadcrumbSchema } from "@/components/public/Breadcrumbs";
import {
  getProductBySlug,
  getProductVariantFamily,
  getRelatedProducts,
  mapProductPrices,
} from "@/services/product.service";
import { resolveEnvironment } from "@/services/environment.service";
import {
  generateWhatsAppLinkSync,
  buildWhatsAppMessage,
  normalizeWhatsAppSettings,
} from "@/lib/whatsapp";
import { getWhatsAppSettings } from "@/lib/whatsapp.server";
import { buildProductMetadata } from "@/lib/meta-seo";
import { getSiteUrl } from "@/lib/site-config";
import { productPath } from "@/lib/product-url";
import { getEnvVisual, envStyle } from "@/lib/env-visuals";
import { ProductViewTracker } from "@/components/analytics/ProductViewTracker";
import { TranslatedText } from "@/components/i18n/TranslatedText";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ environment: string; slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

function looksLikeUrl(value: string) {
  return /^https?:\/\//i.test(value.trim()) || /^wa\.me\//i.test(value.trim());
}

function productDisplayName(name: string, productId: string) {
  const id = String(productId ?? "").trim();
  const trimmed = String(name ?? "Product").trim() || "Product";
  if (!id) return trimmed;
  if (trimmed.endsWith(id)) {
    return trimmed.slice(0, -id.length).replace(/[\s\-_|]+$/u, "").trim() || trimmed;
  }
  return trimmed;
}

function crispDescription(shortDescription?: string | null, description?: string | null) {
  const source = String(shortDescription || description || "").trim();
  if (!source) return null;
  const plain = source.replace(/\s+/g, " ").trim();
  if (plain.length <= 220) return plain;
  return `${plain.slice(0, 217).trim()}…`;
}

function buildProductSpecs(product: {
  condition?: string | null;
  brand?: { name: string } | null;
  category?: { name: string } | null;
  subcategory?: { name: string } | null;
  gtin?: string | null;
  weight?: string | null;
  dimensions?: string | null;
  shippingInfo?: string | null;
  googleCategory?: string | null;
  fbCategory?: string | null;
  tags?: Array<{ tag: { name: string } }>;
}) {
  const rows: Array<{ labelKey: string; label: string; value: string }> = [
    { labelKey: "product.specs.brand", label: "Brand", value: String(product.brand?.name ?? "") },
    {
      labelKey: "product.specs.condition",
      label: "Condition",
      value:
        product.condition && product.condition !== "new"
          ? String(product.condition)
          : "",
    },
    { labelKey: "product.specs.category", label: "Category", value: String(product.category?.name ?? "") },
    {
      labelKey: "product.specs.subcategory",
      label: "Subcategory",
      value: String(product.subcategory?.name ?? ""),
    },
    { labelKey: "product.specs.gtin", label: "GTIN", value: String(product.gtin ?? "") },
    { labelKey: "product.specs.weight", label: "Weight", value: String(product.weight ?? "") },
    { labelKey: "product.specs.dimensions", label: "Dimensions", value: String(product.dimensions ?? "") },
    { labelKey: "product.specs.shipping", label: "Shipping", value: String(product.shippingInfo ?? "") },
    {
      labelKey: "product.specs.productType",
      label: "Product type",
      value: String(product.googleCategory ?? ""),
    },
    {
      labelKey: "product.specs.tags",
      label: "Tags",
      value: (product.tags ?? [])
        .map((t) => String(t?.tag?.name ?? ""))
        .filter(Boolean)
        .join(", "),
    },
  ];

  return rows.filter((row) => {
    const value = row.value.trim();
    if (!value) return false;
    if (looksLikeUrl(value)) return false;
    if (row.label === "Subcategory" && value === product.category?.name) return false;
    if (row.label === "Product type" && product.fbCategory && value === product.fbCategory) {
      return true;
    }
    return true;
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { environment: envSlug, slug } = await params;
  const product = await getProductBySlug(slug, envSlug).catch(() => null);
  const env = await resolveEnvironment(envSlug).catch(() => null);
  if (!product || !env) return { title: "Product Not Found" };

  const { pricing } = mapProductPrices(product);
  const title = product.seoTitle ?? `${product.name} – ${pricing.displayPrice} QAR`;
  const description =
    product.seoDescription ?? product.shortDescription ?? product.description?.slice(0, 160) ?? product.name;
  const primaryImage =
    product.images?.find((i) => i.isPrimary) ?? product.images?.[0];
  const inStock = product.inventory?.isInStock ?? true;

  return buildProductMetadata({
    title,
    description,
    path: productPath(envSlug, product.slug),
    image: primaryImage?.url,
    imageAlt: product.name,
    price: pricing.displayPrice,
    currency: pricing.currency,
    inStock,
    brand: product.brand?.name,
    productId: product.productId,
    sku: product.sku,
  });
}

export default async function EnvironmentProductPage({ params, searchParams }: PageProps) {
  const { environment: envSlug, slug } = await params;
  const query = await searchParams;
  const environment = await resolveEnvironment(envSlug).catch(() => null);
  if (!environment) notFound();

  const product = await getProductBySlug(slug, envSlug).catch(() => null);
  if (!product) notFound();

  try {
  const v = getEnvVisual(envSlug);
  const [related, variants, waSettingsRaw] = await Promise.all([
    getRelatedProducts(product, 8, environment.id).catch(() => []),
    getProductVariantFamily(product).catch(() => []),
    getWhatsAppSettings().catch(async () => {
      const { DEFAULT_WHATSAPP_SETTINGS } = await import("@/lib/whatsapp");
      return DEFAULT_WHATSAPP_SETTINGS;
    }),
  ]);
  const waSettings = normalizeWhatsAppSettings(waSettingsRaw);

  const { pricing } = mapProductPrices(product);
  const siteUrl = getSiteUrl();
  const inStock = product.inventory?.isInStock ?? true;
  const primaryImage =
    product.images?.find((i) => i.isPrimary) ?? product.images?.[0];
  const itemCode = product.productId || product.sku || "";
  const title = productDisplayName(product.name, product.productId);
  const shortCopy = crispDescription(product.shortDescription, product.description);
  const fullDescription = String(product.description ?? "").trim();
  const specs = buildProductSpecs(product);

  const suggested = related.filter((p) => p.id !== product.id && p.productId !== product.productId);

  const whatsappHref = generateWhatsAppLinkSync(
    waSettings,
    {
      name: product.name,
      productId: product.productId,
      regularPrice: pricing.regular,
      salePrice: pricing.sale,
      currency: pricing.currency,
      slug: product.slug,
      imageUrl: primaryImage?.url,
      environmentSlug: envSlug,
      environmentName: environment.config.displayName,
      quantity: 1,
      size: product.variantLabel ?? undefined,
    },
    siteUrl
  );

  const whatsappMessage = buildWhatsAppMessage(
    waSettings,
    {
      name: product.name,
      productId: product.productId,
      regularPrice: pricing.regular,
      salePrice: pricing.sale,
      currency: pricing.currency,
      slug: product.slug,
      imageUrl: primaryImage?.url,
      environmentSlug: envSlug,
      environmentName: environment.config.displayName,
      quantity: 1,
      size: product.variantLabel ?? undefined,
    },
    siteUrl
  );

  const breadcrumbItems = [
    { labelKey: "nav.home", href: "/" },
    { label: environment.config.displayName, href: `/${envSlug}` },
    { labelKey: "store.shop", href: `/${envSlug}#catalog` },
    ...(product.category
      ? [{ label: product.category.name, href: `/${envSlug}?q=${encodeURIComponent(product.category.name)}#catalog` }]
      : []),
    { label: title },
  ];

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.sku,
    image: (product.images ?? []).map((i) => i.url),
    brand: product.brand ? { "@type": "Brand", name: product.brand.name } : undefined,
    offers: {
      "@type": "Offer",
      url: `${siteUrl}${productPath(envSlug, product.slug)}`,
      priceCurrency: pricing.currency,
      price: pricing.displayPrice,
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <>
      <ProductWidgetBoundary name="view-tracker">
        <ProductViewTracker
          productId={product.productId}
          name={product.name}
          price={pricing.displayPrice}
          currency={pricing.currency}
        />
      </ProductWidgetBoundary>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema(breadcrumbItems, siteUrl)),
        }}
      />

      <div style={{ ...envStyle(v), backgroundColor: "#f5f3f0" }}>
        <div className="container-pawmart py-6 md:py-10">
          <Breadcrumbs items={breadcrumbItems} />

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
                  images={product.images ?? []}
                  videos={product.videos ?? []}
                  productName={title}
                />
              </ProductWidgetBoundary>

              {fullDescription && fullDescription !== shortCopy ? (
                <div className="mt-8 rounded-xl border border-[#ebe8e3] bg-white p-5 md:p-6">
                  <h2 className="mb-3 font-sans text-sm font-semibold uppercase tracking-wide text-[#6b6560]">
                    <TranslatedText k="product.fullDetails" />
                  </h2>
                  <div className="whitespace-pre-line font-sans text-sm leading-relaxed text-[#141414] md:text-base">
                    {fullDescription}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="lg:sticky lg:top-[var(--store-header-height)] lg:self-start">
              {product.brand && (
                <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-wider text-[#9c9690]">
                  {product.brand.name}
                </p>
              )}
              <h1 className="font-sans text-xl font-semibold leading-snug tracking-normal text-[#141414] md:text-2xl">
                {title}
              </h1>
              {itemCode ? (
                <p className="mt-1.5 font-sans text-sm tabular-nums text-[#9c9690]">
                  <TranslatedText k="product.itemCode" vars={{ code: itemCode }} />
                </p>
              ) : null}

              <div className="mt-5">
                <ProductWidgetBoundary
                  name="purchase-panel"
                  fallback={
                    <a
                      href={whatsappHref}
                      className="flex min-h-[48px] items-center justify-center rounded-full bg-[#128c47] px-6 text-sm font-semibold text-white"
                    >
                      Order on WhatsApp
                    </a>
                  }
                >
                <ProductPurchasePanel
                  dbId={product.id}
                  productId={product.productId}
                  slug={product.slug}
                  name={product.name}
                  itemCode={itemCode}
                  shortDescription={shortCopy}
                  specs={specs}
                  pricing={pricing}
                  inStock={inStock}
                  imageUrl={primaryImage?.url}
                  environmentSlug={envSlug}
                  environmentName={environment.config.displayName}
                  whatsappSettings={waSettings}
                  siteUrl={siteUrl}
                  accentColor={v.cta}
                  sizeVariants={variants.map((variant) => ({
                    id: variant.id,
                    productId: variant.productId,
                    slug: variant.slug,
                    name: productDisplayName(variant.name, variant.productId),
                    label:
                      productDisplayName(variant.name, variant.productId) ||
                      variant.variantLabel ||
                      variant.name,
                    inStock: variant.inventory?.isInStock ?? true,
                    price: mapProductPrices(variant).pricing.displayPrice,
                    currency: mapProductPrices(variant).pricing.currency,
                    imageUrl:
                      (
                        variant.images?.find((image) => image.isPrimary) ??
                        variant.images?.[0]
                      )?.url,
                  }))}
                  initialSizeSelected={query.sizeSelected === "1"}
                />
                </ProductWidgetBoundary>
              </div>
            </div>
          </div>

          {suggested.length > 0 ? (
            <section className="mt-12 border-t border-[#ebe8e3] pt-10">
              <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-[#9c9690]">
                <TranslatedText k="product.suggested" />
              </p>
              <h2 className="mt-1 font-sans text-xl font-semibold text-[#141414] md:text-2xl">
                <TranslatedText k="product.customersAlsoBought" as="span" />
              </h2>
              <ProductWidgetBoundary name="suggested-products">
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 md:gap-4">
                  {suggested.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      whatsappSettings={waSettings}
                      environmentSlug={envSlug}
                      environmentName={environment.config.displayName}
                      siteUrl={siteUrl}
                      variant="compact"
                    />
                  ))}
                </div>
              </ProductWidgetBoundary>
            </section>
          ) : null}
        </div>
      </div>

      {(variants.length === 0 || query.sizeSelected === "1") && (
        <ProductWidgetBoundary name="mobile-order-bar">
        <ProductMobileOrderBar
        whatsappSettings={waSettings}
        siteUrl={siteUrl}
        singleProductWaHref={whatsappHref}
        singleProductInquiry={{
          eventType: "PRODUCT_WHATSAPP",
          environmentSlug: envSlug,
          environmentName: environment.config.displayName,
          itemCount: 1,
          estimatedTotal: pricing.displayPrice,
          currency: pricing.currency,
          whatsappUrl: whatsappHref,
          whatsappMessage,
          items: [
            {
              productId: product.productId,
              productName: product.name,
              slug: product.slug,
              price: pricing.displayPrice,
              currency: pricing.currency,
              environmentSlug: envSlug,
              environmentName: environment.config.displayName,
              quantity: 1,
              size: product.variantLabel ?? undefined,
            },
          ],
        }}
        product={{
          id: product.id,
          productId: product.productId,
          slug: product.slug,
          name: product.name,
          price: pricing.displayPrice,
          currency: pricing.currency,
          imageUrl: primaryImage?.url,
          environmentSlug: envSlug,
          environmentName: environment.config.displayName,
          variantLabel: product.variantLabel,
        }}
        accentColor={v.cta}
        />
        </ProductWidgetBoundary>
      )}
    </>
  );
  } catch (error) {
    console.error("[product-page] degraded render:", slug, error);
    const fallbackName = String(product.name ?? "Product");
    const fallbackImage = product.images?.[0]?.url;
    return (
      <div className="container-pawmart py-10 md:py-16">
        <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-[#ebe8e3] bg-white">
            {fallbackImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={String(fallbackImage)}
                alt={fallbackName}
                className="h-full w-full object-contain p-6"
              />
            ) : (
              <span className="text-sm text-[#6b6560]">Product image unavailable</span>
            )}
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#9c9690]">
              Item {String(product.productId ?? "")}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-[#141414]">
              {fallbackName}
            </h1>
            <a
              href={`https://wa.me/97455049229?text=${encodeURIComponent(
                `Hello, I want to order ${fallbackName} (${String(product.productId ?? "")}).`
              )}`}
              className="mt-8 flex min-h-[48px] items-center justify-center rounded-full bg-[#128c47] px-6 text-sm font-semibold text-white"
            >
              Order on WhatsApp
            </a>
            <a
              href={`/${envSlug}`}
              className="mt-3 flex min-h-[44px] items-center justify-center rounded-full border border-[#d4cfc8] px-6 text-sm font-semibold text-[#141414]"
            >
              Back to catalogue
            </a>
          </div>
        </div>
      </div>
    );
  }
}
