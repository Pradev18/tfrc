import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/public/ProductCard";

import { Breadcrumbs } from "@/components/public/Breadcrumbs";

import { CategoryCard } from "@/components/public/CategoryCard";

import {

  getCategoryBySlug,

  getCategoryBreadcrumb,

  getCategoryCoverImage,

} from "@/services/category.service";

import { getProducts } from "@/services/product.service";

import { resolveEnvironment } from "@/services/environment.service";

import { getWhatsAppSettings } from "@/lib/whatsapp.server";
import { getSiteUrl } from "@/lib/site-config";

import { getEnvVisual, envStyle } from "@/lib/env-visuals";



interface PageProps {

  params: Promise<{ environment: string; category: string }>;

  searchParams: Promise<Record<string, string | undefined>>;

}



export async function generateMetadata({ params }: PageProps): Promise<Metadata> {

  const { environment: envSlug, category: slug } = await params;

  const category = await getCategoryBySlug(slug);

  const env = await resolveEnvironment(envSlug);

  if (!category || !env) return { title: "Category" };

  return {

    title: `${category.name} | ${env.config.displayName}`,

    description: `Shop ${category.name} at ${env.config.displayName} — TFRC Vita Nova Qatar.`,

    alternates: { canonical: `/${envSlug}/catalogue/${category.slug}` },

  };

}



export default async function EnvironmentCategoryPage({ params, searchParams }: PageProps) {

  const { environment: envSlug, category: slug } = await params;

  const environment = await resolveEnvironment(envSlug);

  if (!environment) notFound();



  const v = getEnvVisual(envSlug);

  const query = await searchParams;

  const category = await getCategoryBySlug(slug);

  if (!category) notFound();



  const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);

  const [breadcrumb, { items, totalPages }, waSettings, categoryCover] = await Promise.all([

    getCategoryBreadcrumb(slug),

    getProducts({ categorySlug: slug, environmentSlug: envSlug, page, limit: 24 }),

    getWhatsAppSettings(),

    getCategoryCoverImage(category.id),

  ]);



  const childCovers = await Promise.all(

    category.children.map(async (child) => ({

      ...child,

      imageUrl: await getCategoryCoverImage(child.id),

    }))

  );



  const siteUrl = getSiteUrl();



  return (

    <div style={{ ...envStyle(v), backgroundColor: "#f5f3f0" }}>

      <div className="container-pawmart py-6 md:py-10">

        <Breadcrumbs

          items={[

            { label: "Home", href: "/" },

            { label: environment.config.displayName, href: `/${envSlug}` },

            { label: "Shop", href: `/${envSlug}/catalogue` },

            ...breadcrumb.slice(0, -1).map((b) => ({

              label: b.name,

              href: `/${envSlug}/catalogue/${b.slug}`,

            })),

            { label: category.name },

          ]}

        />



        <div className="mt-4 flex items-start gap-5">

          {categoryCover && (

            <div className="relative hidden h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[#ebe8e3] bg-neutral-100 sm:block md:h-24 md:w-24">
              <Image
                src={categoryCover}
                alt={category.name}
                fill
                className="object-cover"
                sizes="96px"
              />
            </div>

          )}

          <div>

            <h1 className="text-2xl font-bold md:text-3xl" style={{ color: v.heading }}>

              {category.name}

            </h1>

            {category.description && (

              <p className="mt-2 max-w-2xl text-sm leading-relaxed md:text-base" style={{ color: v.body }}>

                {category.description}

              </p>

            )}

          </div>

        </div>



        {childCovers.length > 0 && (

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

            {childCovers.map((child) => (

              <CategoryCard

                key={child.id}

                name={child.name}

                slug={child.slug}

                environmentSlug={envSlug}

                imageUrl={child.imageUrl}

              />

            ))}

          </div>

        )}



        <div className="mt-8">

          {items.length === 0 ? (

            <p className="text-[#6b6560]">No products in this category yet.</p>

          ) : (

            <>

              <p className="mb-4 text-sm text-[#6b6560]">{items.length} products on this page</p>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">

                {items.map((product) => (

                  <ProductCard

                    key={product.id}

                    product={product}

                    whatsappSettings={waSettings}

                    environmentSlug={envSlug}

                    environmentName={environment.config.displayName}

                    siteUrl={siteUrl}

                  />

                ))}

              </div>

              {totalPages > 1 && (
                <nav
                  className="mt-8 flex items-center justify-center gap-3"
                  aria-label="Product pages"
                >
                  {page > 1 ? (
                    <Link
                      href={`/${envSlug}/catalogue/${slug}?page=${page - 1}`}
                      className="min-h-11 rounded-full border border-[#d8d3cc] bg-white px-5 py-3 text-sm font-semibold text-[#433f3a] hover:bg-[#f8f6f3]"
                    >
                      ← Previous
                    </Link>
                  ) : (
                    <span className="min-h-11 rounded-full border border-[#e5e1dc] px-5 py-3 text-sm text-[#aaa39b]">
                      ← Previous
                    </span>
                  )}

                  <span className="text-sm text-[#6b6560]">
                    Page {page} of {totalPages}
                  </span>

                  {page < totalPages ? (
                    <Link
                      href={`/${envSlug}/catalogue/${slug}?page=${page + 1}`}
                      className="min-h-11 rounded-full border border-[#d8d3cc] bg-white px-5 py-3 text-sm font-semibold text-[#433f3a] hover:bg-[#f8f6f3]"
                    >
                      Next →
                    </Link>
                  ) : (
                    <span className="min-h-11 rounded-full border border-[#e5e1dc] px-5 py-3 text-sm text-[#aaa39b]">
                      Next →
                    </span>
                  )}
                </nav>

              )}

            </>

          )}

        </div>

      </div>

    </div>

  );

}


