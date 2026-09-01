import { notFound } from "next/navigation";

import type { Metadata } from "next";

import Image from "next/image";

import { ProductGallery } from "@/components/public/ProductGallery";

import { ProductCard } from "@/components/public/ProductCard";

import { PriceDisplay } from "@/components/public/PriceDisplay";

import { WhatsAppButton } from "@/components/public/WhatsAppButton";

import { AddToCartButton } from "@/components/public/AddToCartButton";

import { Breadcrumbs, breadcrumbSchema } from "@/components/public/Breadcrumbs";

import {

  getProductBySlug,

  getRelatedProducts,

  mapProductPrices,

} from "@/services/product.service";

import { resolveEnvironment } from "@/services/environment.service";

import { getWhatsAppSettings, generateWhatsAppLinkSync } from "@/lib/whatsapp";

import { buildProductMetadata } from "@/lib/meta-seo";

import { getSiteUrl } from "@/lib/site-config";

import { getEnvVisual, envStyle } from "@/lib/env-visuals";

import { ProductViewTracker } from "@/components/analytics/ProductViewTracker";



interface PageProps {

  params: Promise<{ environment: string; slug: string }>;

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

    getRelatedProducts(product, 4, environment.id),

    getWhatsAppSettings(),

  ]);



  const { pricing } = mapProductPrices(product);

  const siteUrl = getSiteUrl();

  const inStock = product.inventory?.isInStock ?? true;

  const primaryImage = product.images.find((i) => i.isPrimary) ?? product.images[0];



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

    },

    siteUrl

  );



  const breadcrumbItems = [

    { label: "Home", href: "/" },

    { label: environment.config.displayName, href: `/${envSlug}` },

    { label: "Shop", href: `/${envSlug}/catalogue` },

    ...(product.category

      ? [{ label: product.category.name, href: `/${envSlug}/catalogue/${product.category.slug}` }]

      : []),

    { label: product.name },

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



  const buyBox = (

    <div className="rounded-xl border border-[#ebe8e3] bg-white p-5 md:p-6">

      <PriceDisplay pricing={pricing} size="lg" />

      <div className="mt-3 flex items-center gap-2 text-sm">

        <span

          className="inline-block h-2 w-2 rounded-full"

          style={{ backgroundColor: inStock ? "#128c47" : "#c0392b" }}

        />

        <span style={{ color: inStock ? "#128c47" : "#c0392b" }}>

          {inStock ? "In stock" : "Check availability on WhatsApp"}

        </span>

      </div>

      <p className="mt-2 text-xs text-[#9c9690]">Ref: {product.productId}</p>



      <div className="mt-5 flex flex-col gap-2.5">

        <AddToCartButton

          dbId={product.id}

          productId={product.productId}

          slug={product.slug}

          name={product.name}

          price={pricing.displayPrice}

          currency={pricing.currency}

          imageUrl={primaryImage?.url}

          environmentSlug={envSlug}

          environmentName={environment.config.displayName}

          fullWidth

          size="md"

          accentColor={v.cta}

        />

        <WhatsAppButton href={whatsappHref} size="lg" fullWidth label="Order on WhatsApp" />

      </div>



      <p className="mt-4 text-xs leading-relaxed text-[#6b6560]">

        No online payment. Add to cart and send your order on WhatsApp — we confirm delivery

        personally.

      </p>

    </div>

  );



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

                productName={product.name}

              />



              {product.description && (

                <div className="mt-8 rounded-xl border border-[#ebe8e3] bg-white p-5 md:p-6">

                  <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#6b6560]">

                    Product description

                  </h2>

                  <div className="whitespace-pre-line text-sm leading-relaxed text-[#141414] md:text-base">

                    {product.description}

                  </div>

                </div>

              )}

            </div>



            <div className="lg:sticky lg:top-24 lg:self-start">

              {product.brand && (

                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#9c9690]">

                  {product.brand.name}

                </p>

              )}

              <h1 className="text-xl font-bold leading-snug text-[#141414] md:text-2xl">

                {product.name}

              </h1>

              <div className="mt-5">{buyBox}</div>



              {(product.category || product.subcategory) && (

                <div className="mt-4 flex flex-wrap gap-2">

                  {product.category && (

                    <a

                      href={`/${envSlug}/catalogue/${product.category.slug}`}

                      className="rounded-lg border border-[#ebe8e3] bg-white px-3 py-1.5 text-xs font-medium text-[#141414] hover:border-[#141414]"

                    >

                      {product.category.name}

                    </a>

                  )}

                  {product.subcategory &&

                    product.subcategory.id !== product.category?.id && (

                      <a

                        href={`/${envSlug}/catalogue/${product.subcategory.slug}`}

                        className="rounded-lg border border-[#ebe8e3] bg-white px-3 py-1.5 text-xs font-medium text-[#141414] hover:border-[#141414]"

                      >

                        {product.subcategory.name}

                      </a>

                    )}

                </div>

              )}

            </div>

          </div>



          {related.length > 0 && (

            <section className="mt-12 border-t border-[#ebe8e3] pt-10">

              <h2 className="mb-6 text-lg font-bold text-[#141414] md:text-xl">

                Customers also viewed

              </h2>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4">

                {related.map((p) => (

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

          )}

        </div>

      </div>



      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#ebe8e3] bg-white p-3 md:hidden">

        <div className="flex gap-2">

          <AddToCartButton

            dbId={product.id}

            productId={product.productId}

            slug={product.slug}

            name={product.name}

            price={pricing.displayPrice}

            currency={pricing.currency}

            imageUrl={primaryImage?.url}

            environmentSlug={envSlug}

            environmentName={environment.config.displayName}

            fullWidth

            size="md"

            accentColor={v.cta}

          />

        </div>

      </div>

      <div className="h-[4.5rem] md:hidden" />

    </>

  );

}


