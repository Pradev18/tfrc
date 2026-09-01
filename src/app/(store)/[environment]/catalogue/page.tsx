import { Suspense } from "react";

import type { Metadata } from "next";

import { notFound } from "next/navigation";

import { ProductCard } from "@/components/public/ProductCard";

import { Breadcrumbs } from "@/components/public/Breadcrumbs";

import { CatalogueFilters } from "@/components/public/CatalogueFilters";

import { CatalogueToolbar } from "@/components/public/CatalogueToolbar";
import { SaleFilterChips } from "@/components/public/SaleFilterChips";

import { getProducts } from "@/services/product.service";

import { getShopCategories } from "@/services/shop-category.service";
import { getShopCategoryDef } from "@/lib/shop-categories";

import { resolveEnvironment } from "@/services/environment.service";

import { getWhatsAppSettings } from "@/lib/whatsapp";

import { buildPageMetadata } from "@/lib/meta-seo";

import { getEnvVisual, envStyle } from "@/lib/env-visuals";

import prisma from "@/lib/db";



interface PageProps {

  params: Promise<{ environment: string }>;

  searchParams: Promise<Record<string, string | undefined>>;

}



export async function generateMetadata({ params }: PageProps): Promise<Metadata> {

  const { environment: slug } = await params;

  const env = await resolveEnvironment(slug);

  if (!env) return { title: "Shop" };

  return buildPageMetadata({

    title: `Shop | ${env.config.displayName}`,

    description: env.seoParsed.description,

    path: `/${slug}/catalogue`,

  });

}



export default async function EnvironmentCataloguePage({ params, searchParams }: PageProps) {

  const { environment: slug } = await params;

  const environment = await resolveEnvironment(slug);

  if (!environment) notFound();



  const v = getEnvVisual(slug);

  const queryParams = await searchParams;

  const page = parseInt(queryParams.page ?? "1", 10);

  const sort =

    (queryParams.sort as "featured" | "newest" | "price_asc" | "price_desc" | "discount" | "name") ??

    "newest";



  const shopSlug = queryParams.shop;
  const activeShop = shopSlug ? getShopCategoryDef(slug, shopSlug) : undefined;

  const { items, total, totalPages } = await getProducts({
    search: queryParams.q,
    categorySlug: queryParams.category,
    shopCategorySlug: shopSlug,
    brandSlug: queryParams.brand,
    environmentSlug: slug,
    onSale: queryParams.sale === "true",
    inStock: queryParams.inStock === "true",
    sort,
    page,
    limit: 24,
  });



  const brandIds = await prisma.product.findMany({

    where: { environmentId: environment.id, status: "ACTIVE" },

    select: { brandId: true },

    distinct: ["brandId"],

  });

  const brands = await prisma.brand.findMany({

    where: {

      isActive: true,

      id: { in: brandIds.map((b) => b.brandId).filter(Boolean) as string[] },

    },

    orderBy: { name: "asc" },

  });



  const [shopCategories, waSettings] = await Promise.all([
    getShopCategories(slug),
    getWhatsAppSettings(),
  ]);



  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";



  return (

    <div style={{ ...envStyle(v), backgroundColor: "#f5f3f0" }} className="min-h-[60vh]">

      <div className="container-pawmart py-6 md:py-10">

        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: environment.config.displayName, href: `/${slug}` },
            ...(activeShop
              ? [{ label: "Shop", href: `/${slug}/catalogue` }, { label: activeShop.name }]
              : [{ label: "All products" }]),
          ]}
        />

        <h1 className="mt-4 text-2xl font-bold md:text-3xl" style={{ color: v.heading }}>
          {activeShop ? activeShop.name : environment.config.displayName}
        </h1>
        {activeShop && (
          <p className="mt-1 text-sm" style={{ color: v.muted }}>
            {total} products in {activeShop.name}
          </p>
        )}



        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:gap-8">

          <aside className="lg:w-56 lg:shrink-0 xl:w-64">

            <Suspense

              fallback={

                <div className="h-40 animate-pulse rounded-xl bg-white" />

              }

            >

              <CatalogueFilters
                shopCategories={shopCategories}
                brands={brands}
                environmentSlug={slug}
              />

            </Suspense>

          </aside>



          <div className="min-w-0 flex-1">

            <SaleFilterChips
              environmentSlug={slug}
              activeSale={queryParams.sale === "true"}
            />

            <CatalogueToolbar

              totalItems={total}

              currentSort={sort}

              environmentSlug={slug}

              queryParams={queryParams}

            />



            {items.length === 0 ? (

              <div className="rounded-xl border border-[#ebe8e3] bg-white p-12 text-center">

                <p className="text-lg text-[#141414]">No products found</p>

                <p className="mt-2 text-sm text-[#6b6560]">Try a different search or filter.</p>

              </div>

            ) : (

              <>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">

                  {items.map((product) => (

                    <ProductCard

                      key={product.id}

                      product={product}

                      whatsappSettings={waSettings}

                      environmentSlug={slug}

                      environmentName={environment.config.displayName}

                      siteUrl={siteUrl}

                    />

                  ))}

                </div>



                {totalPages > 1 && (

                  <div className="mt-10 flex justify-center gap-2">

                    {Array.from({ length: totalPages }, (_, i) => i + 1)

                      .slice(Math.max(0, page - 3), page + 2)

                      .map((p) => (

                        <a

                          key={p}

                          href={`/${slug}/catalogue?${new URLSearchParams({ ...queryParams, page: String(p) } as Record<string, string>).toString()}`}

                          className="flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-medium transition-colors"

                          style={

                            p === page

                              ? { backgroundColor: v.cta, color: v.ctaText, borderColor: v.cta }

                              : { borderColor: v.border, color: v.heading, backgroundColor: "#fff" }

                          }

                        >

                          {p}

                        </a>

                      ))}

                  </div>

                )}

              </>

            )}

          </div>

        </div>

      </div>

    </div>

  );

}


