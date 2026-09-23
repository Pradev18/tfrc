import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { breadcrumbSchema } from "@/lib/breadcrumb-schema";
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

      <div style={{ ...envStyle(getEnvVisual(envSlug)), backgroundColor: "#f5f3f0" }}>
        <div className="container-pawmart py-6 md:py-10">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-[#6b6560]">
            {breadcrumbItems.map((item, index) => (
              <span key={`${item.href ?? item.labelKey}-${index}`} className="flex items-center gap-2">
                {index > 0 ? <span aria-hidden>›</span> : null}
                {item.href ? (
                  <a href={item.href} className="hover:text-[#141414]">
                    {item.label ?? (item.labelKey === "nav.home" ? "Home" : "Shop")}
                  </a>
                ) : (
                  <span className="text-[#141414]">{item.label}</span>
                )}
              </span>
            ))}
          </nav>

          <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:gap-10 xl:grid-cols-[1fr_420px]">
            <div>
              <div className="overflow-hidden rounded-xl border border-[#ebe8e3] bg-white">
                {primaryImage?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asText(primaryImage.url)}
                    alt={title}
                    className="aspect-square h-auto w-full object-contain p-6 md:p-8"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center text-sm text-[#6b6560]">
                    Product image unavailable
                  </div>
                )}
              </div>

              {galleryImages.length > 1 ? (
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {galleryImages.slice(0, 6).map((image, index) => (
                    <div
                      key={`${image.url}-${index}`}
                      className="overflow-hidden rounded-lg border border-[#ebe8e3] bg-white"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.url}
                        alt={`${title} ${index + 1}`}
                        className="aspect-square h-auto w-full object-contain p-1"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              {fullDescription ? (
                <div className="mt-8 rounded-xl border border-[#ebe8e3] bg-white p-5 md:p-6">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#6b6560]">
                    Product details
                  </h2>
                  <div className="whitespace-pre-line text-sm leading-relaxed text-[#141414] md:text-base">
                    {fullDescription}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="lg:sticky lg:top-[var(--store-header-height)] lg:self-start">
              {product.brand?.name ? (
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#9c9690]">
                  {asText(product.brand.name)}
                </p>
              ) : null}
              <h1 className="text-xl font-semibold leading-snug text-[#141414] md:text-2xl">
                {title}
              </h1>
              {itemCode ? (
                <p className="mt-1.5 text-sm tabular-nums text-[#9c9690]">
                  Item code: {itemCode}
                </p>
              ) : null}

              <div className="mt-5 rounded-xl border border-[#ebe8e3] bg-white p-5">
                {pricing.isOnSale && pricing.sale != null ? (
                  <div className="flex items-baseline gap-3">
                    <span className="text-2xl font-semibold text-[#141414]">
                      {pricing.currency} {pricing.sale.toFixed(2)}
                    </span>
                    <span className="text-sm text-[#9c9690] line-through">
                      {pricing.currency} {pricing.regular.toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <p className="text-2xl font-semibold text-[#141414]">
                    {pricing.currency} {pricing.displayPrice.toFixed(2)}
                  </p>
                )}

                {sizeVariants.length > 1 ? (
                  <div className="mt-5">
                    <p className="mb-2 text-sm font-semibold text-[#141414]">Choose size</p>
                    <div className="flex flex-wrap gap-2">
                      {sizeVariants.map((variant) => (
                        <a
                          key={variant.id}
                          href={`${productPath(envSlug, variant.slug)}?sizeSelected=1`}
                          className={`rounded-full border px-4 py-2 text-sm font-medium ${
                            variant.slug === product.slug
                              ? "border-[#141414] bg-[#141414] text-white"
                              : "border-[#d4cfc8] bg-white text-[#141414]"
                          }`}
                        >
                          {variant.label}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                <a
                  href={whatsappHref}
                  className="mt-6 flex min-h-[48px] items-center justify-center rounded-full bg-[#128c47] px-6 text-sm font-semibold text-white"
                >
                  Order on WhatsApp
                </a>
              </div>

              {specs.length > 0 ? (
                <dl className="mt-5 divide-y divide-[#ebe8e3] rounded-xl border border-[#ebe8e3] bg-white px-5">
                  {specs.map((spec) => (
                    <div key={spec.labelKey} className="grid grid-cols-[120px_1fr] gap-3 py-3 text-sm">
                      <dt className="text-[#6b6560]">{spec.label}</dt>
                      <dd className="font-medium text-[#141414]">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          </div>

          {suggested.length > 0 ? (
            <section className="mt-12 border-t border-[#ebe8e3] pt-10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9c9690]">
                Suggested products
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[#141414] md:text-2xl">
                Customers also bought
              </h2>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {suggested.map((card) => {
                  const image = Array.isArray(card.images) ? card.images[0] : undefined;
                  const cardPrices = Array.isArray(card.prices) ? card.prices : [];
                  const regular = cardPrices.find((price) => price.type === "REGULAR");
                  const sale = cardPrices.find((price) => price.type === "SALE");
                  const amount = sale?.amount ?? regular?.amount ?? 0;
                  return (
                    <a
                      key={asText(card.id)}
                      href={productPath(envSlug, asText(card.slug))}
                      className="overflow-hidden rounded-xl border border-[#ebe8e3] bg-white"
                    >
                      <div className="aspect-square overflow-hidden bg-white">
                        {image?.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={asText(image.url)}
                            alt={asText(card.name)}
                            className="h-full w-full object-contain p-3"
                            loading="lazy"
                          />
                        ) : null}
                      </div>
                      <div className="border-t border-[#ebe8e3] p-3">
                        <p className="line-clamp-2 text-sm font-semibold text-[#141414]">
                          {productDisplayName(asText(card.name), asText(card.productId))}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-[#141414]">
                          {asText(sale?.currency ?? regular?.currency, "QAR")}{" "}
                          {asNumber(amount).toFixed(2)}
                        </p>
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
