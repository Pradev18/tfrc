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
import { normalizeWhatsAppSettings } from "@/lib/whatsapp";
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

function asText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  return String(value);
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function productDisplayName(name: string, productId: string) {
  const id = asText(productId).trim();
  const trimmed = asText(name, "Product").trim() || "Product";
  if (!id) return trimmed;
  if (trimmed.endsWith(id)) {
    return trimmed.slice(0, -id.length).replace(/[\s\-_|]+$/u, "").trim() || trimmed;
  }
  return trimmed;
}

function crispDescription(shortDescription?: string | null, description?: string | null) {
  const source = asText(shortDescription || description).trim();
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
    { labelKey: "product.specs.brand", label: "Brand", value: asText(product.brand?.name) },
    {
      labelKey: "product.specs.condition",
      label: "Condition",
      value:
        product.condition && product.condition !== "new"
          ? asText(product.condition)
          : "",
    },
    {
      labelKey: "product.specs.category",
      label: "Category",
      value: asText(product.category?.name),
    },
    {
      labelKey: "product.specs.subcategory",
      label: "Subcategory",
      value: asText(product.subcategory?.name),
    },
    { labelKey: "product.specs.gtin", label: "GTIN", value: asText(product.gtin) },
    { labelKey: "product.specs.weight", label: "Weight", value: asText(product.weight) },
    {
      labelKey: "product.specs.dimensions",
      label: "Dimensions",
      value: asText(product.dimensions),
    },
    {
      labelKey: "product.specs.shipping",
      label: "Shipping",
      value: asText(product.shippingInfo),
    },
    {
      labelKey: "product.specs.productType",
      label: "Product type",
      value: asText(product.googleCategory),
    },
    {
      labelKey: "product.specs.tags",
      label: "Tags",
      value: (product.tags ?? [])
        .map((t) => asText(t?.tag?.name))
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

/** RSC → client props must be JSON-safe. Prisma Decimal / Date / class instances crash the PDP. */
function toClientCardProduct(product: {
  id: string;
  productId: string;
  sku?: string | null;
  name: string;
  slug: string;
  shortDescription?: string | null;
  description?: string | null;
  variantLabel?: string | null;
  variantGroupKey?: string | null;
  isVariantPrimary?: boolean | null;
  images?: Array<{
    url: string;
    altText?: string | null;
    isPrimary?: boolean;
    sortOrder?: number;
  }> | null;
  videos?: Array<{ url?: string; sortOrder?: number } | { id: string }> | null;
  prices?: Array<{
    type: string;
    amount: unknown;
    currency: string;
    saleStart?: unknown;
    saleEnd?: unknown;
  }> | null;
  brand?: { id: string; name: string; slug: string } | null;
  inventory?: { isInStock?: boolean | null } | null;
}) {
  return {
    id: asText(product.id),
    productId: asText(product.productId),
    sku: product.sku ? asText(product.sku) : null,
    name: asText(product.name, "Product"),
    slug: asText(product.slug),
    shortDescription: product.shortDescription
      ? asText(product.shortDescription)
      : null,
    description: product.description ? asText(product.description) : null,
    variantLabel: product.variantLabel ? asText(product.variantLabel) : null,
    variantGroupKey: product.variantGroupKey
      ? asText(product.variantGroupKey)
      : null,
    isVariantPrimary: product.isVariantPrimary !== false,
    images: (product.images ?? []).map((image, index) => ({
      url: asText(image.url),
      altText: asText(image.altText),
      isPrimary: Boolean(image.isPrimary ?? index === 0),
      sortOrder: asNumber(image.sortOrder, index),
    })),
    videos: (product.videos ?? [])
      .map((video, index) => ({
        url: asText((video as { url?: string }).url),
        sortOrder: asNumber((video as { sortOrder?: number }).sortOrder, index),
      }))
      .filter((video) => Boolean(video.url)),
    prices: (product.prices ?? []).map((price) => ({
      type: asText(price.type),
      amount: asNumber(price.amount),
      currency: asText(price.currency, "QAR"),
      saleStart: null,
      saleEnd: null,
    })),
    brand: product.brand
      ? {
          id: asText(product.brand.id),
          name: asText(product.brand.name),
          slug: asText(product.brand.slug),
        }
      : null,
    inventory: product.inventory
      ? { isInStock: product.inventory.isInStock !== false }
      : null,
    sizeVariants: [],
  };
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, current) => {
      if (typeof current === "bigint") return current.toString();
      if (typeof current === "number" && !Number.isFinite(current)) return null;
      if (current instanceof Date) {
        return Number.isFinite(current.getTime()) ? current.toISOString() : null;
      }
      return current;
    });
  } catch {
    return "{}";
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { environment: envSlug, slug } = await params;
  const product = await getProductBySlug(slug, envSlug).catch(() => null);
  const env = await resolveEnvironment(envSlug).catch(() => null);
  if (!product || !env) return { title: "Product Not Found" };

  const { pricing } = mapProductPrices(product);
  const title = product.seoTitle ?? `${product.name} – ${pricing.displayPrice} QAR`;
  const description =
    product.seoDescription ??
    product.shortDescription ??
    asText(product.description).slice(0, 160) ??
    product.name;
  const primaryImage =
    product.images?.find((i) => i.isPrimary) ?? product.images?.[0];
  const inStock = product.inventory?.isInStock ?? true;

  return buildProductMetadata({
    title,
    description,
    path: productPath(envSlug, product.slug),
    image: primaryImage?.url,
    imageAlt: product.name,
    price: asNumber(pricing.displayPrice),
    currency: asText(pricing.currency, "QAR"),
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
  const mapped = mapProductPrices(product);
  const pricing = {
    regular: asNumber(mapped.pricing.regular),
    sale:
      mapped.pricing.sale == null ? null : asNumber(mapped.pricing.sale),
    currency: asText(mapped.pricing.currency, "QAR"),
    isOnSale: Boolean(mapped.pricing.isOnSale),
    discountPercent:
      mapped.pricing.discountPercent == null
        ? null
        : asNumber(mapped.pricing.discountPercent),
    displayPrice: asNumber(mapped.pricing.displayPrice),
  };
  const siteUrl = getSiteUrl();
  const inStock = product.inventory?.isInStock ?? true;
  const primaryImage =
    product.images?.find((i) => i.isPrimary) ?? product.images?.[0];
  const itemCode = asText(product.productId || product.sku);
  const title = productDisplayName(product.name, product.productId);
  const shortCopy = crispDescription(product.shortDescription, product.description);
  const fullDescription = asText(product.description).trim();
  const specs = (() => {
    try {
      return buildProductSpecs(product);
    } catch (error) {
      console.error("[product-page] specifications skipped:", slug, error);
      return [];
    }
  })();

  const suggested = related
    .filter((p) => p.id !== product.id && p.productId !== product.productId)
    .map((p) => toClientCardProduct(p));

  const galleryImages = (product.images ?? []).map((image, index) => ({
    url: asText(image.url),
    altText:
      "altText" in image
        ? asText((image as { altText?: string | null }).altText)
        : "alt" in image
          ? asText((image as { alt?: string | null }).alt)
          : null,
    isPrimary: Boolean(
      "isPrimary" in image
        ? (image as { isPrimary?: boolean }).isPrimary
        : index === 0
    ),
  }));
  const galleryVideos = (product.videos ?? [])
    .map((video) => ({ url: asText((video as { url?: string }).url) }))
    .filter((video) => Boolean(video.url));

  const sizeVariants = variants.map((variant) => {
    const variantPricing = mapProductPrices(variant).pricing;
    return {
      id: asText(variant.id),
      productId: asText(variant.productId),
      slug: asText(variant.slug),
      name: productDisplayName(variant.name, variant.productId),
      label:
        productDisplayName(variant.name, variant.productId) ||
        asText(variant.variantLabel) ||
        asText(variant.name),
      inStock: variant.inventory?.isInStock ?? true,
      price: asNumber(variantPricing.displayPrice),
      currency: asText(variantPricing.currency, "QAR"),
      imageUrl: asText(
        (
          variant.images?.find((image) => image.isPrimary) ??
          variant.images?.[0]
        )?.url
      ) || undefined,
    };
  });

  const productUrl = `${siteUrl}${productPath(envSlug, product.slug)}`;
  const whatsappMessage = [
    waSettings.defaultGreeting,
    "",
    `I would like to order ${title}.`,
    itemCode ? `Item: ${itemCode}` : "",
    `Price: ${pricing.currency} ${pricing.displayPrice.toFixed(2)}`,
    productUrl,
  ]
    .filter(Boolean)
    .join("\n");
  const whatsappPhone =
    asText(waSettings.phoneNumber).replace(/\D/g, "") || "97455049229";
  const whatsappHref = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(
    whatsappMessage
  )}`;

  const categoryName = asText(product.category?.name);
  const breadcrumbItems = [
    { labelKey: "nav.home", href: "/" },
    { label: asText(environment.config.displayName), href: `/${envSlug}` },
    { labelKey: "store.shop", href: `/${envSlug}#catalog` },
    ...(categoryName
      ? [
          {
            label: categoryName,
            href: `/${envSlug}?q=${encodeURIComponent(categoryName)}#catalog`,
          },
        ]
      : []),
    { label: title },
  ];

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: asText(product.name),
    description: asText(product.description),
    sku: asText(product.sku),
    image: galleryImages.map((i) => i.url).filter(Boolean),
    brand: product.brand
      ? { "@type": "Brand", name: asText(product.brand.name) }
      : undefined,
    offers: {
      "@type": "Offer",
      url: productUrl,
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
          productId={asText(product.productId)}
          name={asText(product.name)}
          price={pricing.displayPrice}
          currency={pricing.currency}
        />
      </ProductWidgetBoundary>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJson(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJson(breadcrumbSchema(breadcrumbItems, siteUrl)),
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
                  images={galleryImages}
                  videos={galleryVideos}
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
              {product.brand?.name ? (
                <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-wider text-[#9c9690]">
                  {asText(product.brand.name)}
                </p>
              ) : null}
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
                    dbId={asText(product.id)}
                    productId={asText(product.productId)}
                    slug={asText(product.slug)}
                    name={asText(product.name)}
                    itemCode={itemCode}
                    shortDescription={shortCopy}
                    specs={specs}
                    pricing={pricing}
                    inStock={inStock}
                    imageUrl={primaryImage?.url ? asText(primaryImage.url) : undefined}
                    environmentSlug={envSlug}
                    environmentName={asText(environment.config.displayName)}
                    whatsappSettings={waSettings}
                    siteUrl={siteUrl}
                    accentColor={v.cta}
                    sizeVariants={sizeVariants}
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
                  {suggested.map((card) => (
                    <ProductCard
                      key={card.id}
                      product={card as never}
                      whatsappSettings={waSettings}
                      environmentSlug={envSlug}
                      environmentName={asText(environment.config.displayName)}
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

      {(sizeVariants.length === 0 || query.sizeSelected === "1") && (
        <ProductWidgetBoundary name="mobile-order-bar">
          <ProductMobileOrderBar
            whatsappSettings={waSettings}
            siteUrl={siteUrl}
            singleProductWaHref={whatsappHref}
            singleProductInquiry={{
              eventType: "PRODUCT_WHATSAPP",
              environmentSlug: envSlug,
              environmentName: asText(environment.config.displayName),
              itemCount: 1,
              estimatedTotal: pricing.displayPrice,
              currency: pricing.currency,
              whatsappUrl: whatsappHref,
              whatsappMessage,
              items: [
                {
                  productId: asText(product.productId),
                  productName: asText(product.name),
                  slug: asText(product.slug),
                  price: pricing.displayPrice,
                  currency: pricing.currency,
                  environmentSlug: envSlug,
                  environmentName: asText(environment.config.displayName),
                  quantity: 1,
                  size: product.variantLabel
                    ? asText(product.variantLabel)
                    : undefined,
                },
              ],
            }}
            product={{
              id: asText(product.id),
              productId: asText(product.productId),
              slug: asText(product.slug),
              name: asText(product.name),
              price: pricing.displayPrice,
              currency: pricing.currency,
              imageUrl: primaryImage?.url
                ? asText(primaryImage.url)
                : undefined,
              environmentSlug: envSlug,
              environmentName: asText(environment.config.displayName),
              variantLabel: product.variantLabel
                ? asText(product.variantLabel)
                : null,
            }}
            accentColor={v.cta}
          />
        </ProductWidgetBoundary>
      )}
    </>
  );
}
