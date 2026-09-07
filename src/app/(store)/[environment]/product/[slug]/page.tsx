import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductGallery } from "@/components/public/ProductGallery";
import { ProductCard } from "@/components/public/ProductCard";
import { ProductPurchasePanel } from "@/components/public/ProductPurchasePanel";
import { ProductMobileOrderBar } from "@/components/store/ProductMobileOrderBar";
import { Breadcrumbs, breadcrumbSchema } from "@/components/public/Breadcrumbs";
import {
  getProductBySlug,
  getRelatedProducts,
  mapProductPrices,
} from "@/services/product.service";
import { resolveEnvironment } from "@/services/environment.service";
import { generateWhatsAppLinkSync, buildWhatsAppMessage } from "@/lib/whatsapp";
import { getWhatsAppSettings } from "@/lib/whatsapp.server";
import { buildProductMetadata } from "@/lib/meta-seo";
import { getSiteUrl } from "@/lib/site-config";
import { getEnvVisual, envStyle } from "@/lib/env-visuals";
import { ProductViewTracker } from "@/components/analytics/ProductViewTracker";

interface PageProps {
  params: Promise<{ environment: string; slug: string }>;
}

function looksLikeUrl(value: string) {
  return /^https?:\/\//i.test(value.trim()) || /^wa\.me\//i.test(value.trim());
}

function productDisplayName(name: string, productId: string) {
  const id = productId?.trim();
  if (!id) return name;
  const trimmed = name.trim();
  if (trimmed.endsWith(id)) {
    return trimmed.slice(0, -id.length).replace(/[\s\-_|]+$/u, "").trim() || trimmed;
  }
  return trimmed;
}

function crispDescription(shortDescription?: string | null, description?: string | null) {
  const source = (shortDescription || description || "").trim();
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
  const rows: Array<{ label: string; value: string }> = [
    { label: "Brand", value: product.brand?.name ?? "" },
    { label: "Condition", value: product.condition && product.condition !== "new" ? product.condition : "" },
    { label: "Category", value: product.category?.name ?? "" },
    { label: "Subcategory", value: product.subcategory?.name ?? "" },
    { label: "GTIN", value: product.gtin ?? "" },
    { label: "Weight", value: product.weight ?? "" },
    { label: "Dimensions", value: product.dimensions ?? "" },
    { label: "Shipping", value: product.shippingInfo ?? "" },
    { label: "Product type", value: product.googleCategory ?? "" },
    {
      label: "Tags",
      value: (product.tags ?? []).map((t) => t.tag.name).filter(Boolean).join(", "),
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
  const product = await getProductBySlug(slug, envSlug);
  const env = await resolveEnvironment(envSlug);
  if (!product || !env) return { title: "Product Not Found" };

  const { pricing } = mapProductPrices(product);
  const title = product.seoTitle ?? `${product.name} – ${pricing.displayPrice} QAR`;
  const description =
    product.seoDescription ?? product.shortDescription ?? product.description?.slice(0, 160) ?? product.name;
  const primaryImage = product.images.find((i) => i.isPrimary) ?? product.images[0];
  const inStock = product.inventory?.isInStock ?? true;

  return buildProductMetadata({
    title,
    description,
    path: `/${envSlug}/product/${product.slug}`,
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

export default async function EnvironmentProductPage({ params }: PageProps) {
  const { environment: envSlug, slug } = await params;
  const environment = await resolveEnvironment(envSlug);
  if (!environment) notFound();

  const product = await getProductBySlug(slug, envSlug);
  if (!product) notFound();

  const v = getEnvVisual(envSlug);
  const [related, waSettings] = await Promise.all([
    getRelatedProducts(product, 8, environment.id),
    getWhatsAppSettings(),
  ]);

  const { pricing } = mapProductPrices(product);
  const siteUrl = getSiteUrl();
  const inStock = product.inventory?.isInStock ?? true;
  const primaryImage = product.images.find((i) => i.isPrimary) ?? product.images[0];
  const itemCode = product.productId || product.sku || "";
  const title = productDisplayName(product.name, product.productId);
  const shortCopy = crispDescription(product.shortDescription, product.description);
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
    },
    siteUrl
  );

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: environment.config.displayName, href: `/${envSlug}` },
    { label: "Shop", href: `/${envSlug}#catalog` },
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
    image: product.images.map((i) => i.url),
    brand: product.brand ? { "@type": "Brand", name: product.brand.name } : undefined,
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/${envSlug}/product/${product.slug}`,
      priceCurrency: pricing.currency,
      price: pricing.displayPrice,
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <>
      <ProductViewTracker
        productId={product.productId}
        name={product.name}
        price={pricing.displayPrice}
        currency={pricing.currency}
      />
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
              <ProductGallery
                images={product.images}
                videos={product.videos}
                productName={title}
              />

              {product.description &&
              product.description.trim() &&
              product.description.trim() !== shortCopy ? (
                <div className="mt-8 rounded-xl border border-[#ebe8e3] bg-white p-5 md:p-6">
                  <h2 className="mb-3 font-sans text-sm font-semibold uppercase tracking-wide text-[#6b6560]">
                    Full details
                  </h2>
                  <div className="whitespace-pre-line font-sans text-sm leading-relaxed text-[#141414] md:text-base">
                    {product.description}
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
                  Item code: {itemCode}
                </p>
              ) : null}

              <div className="mt-5">
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
                />
              </div>
            </div>
          </div>

          {suggested.length > 0 ? (
            <section className="mt-12 border-t border-[#ebe8e3] pt-10">
              <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-[#9c9690]">
                Suggested for you
              </p>
              <h2 className="mt-1 font-sans text-xl font-semibold text-[#141414] md:text-2xl">
                Customers also bought
              </h2>
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
            </section>
          ) : null}
        </div>
      </div>

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
        }}
        accentColor={v.cta}
      />
    </>
  );
}
