import { notFound } from "next/navigation";
import { resolveEnvironment } from "@/services/environment.service";
import { getShopCategories } from "@/services/shop-category.service";
import { getWhatsAppSettings } from "@/lib/whatsapp.server";
import { EnvironmentHome } from "@/components/store/EnvironmentHome";
import { getSiteUrl } from "@/lib/site-config";
import { getCachedEnvironment } from "@/lib/catalog-cache";
import { getProducts } from "@/services/product.service";
import { STORE_PAGE_SIZE } from "@/lib/store-constants";
import type { InitialStoreFeed } from "@/hooks/useStoreProductFeed";
import { brandsForStrip } from "@/lib/brand-strip";
import prisma from "@/lib/db";

export const revalidate = 30;

interface PageProps {
  params: Promise<{ environment: string }>;
}

/**
 * Brand strip for every catalogue — from Neon (same as admin).
 * Real brand names → cards (logo if set, else letter). No usable brands → hide strip.
 */
async function getBrandsForStoreStrip(slug: string) {
  const cached = getCachedEnvironment(slug);
  const environmentId =
    cached?.id ??
    (
      await prisma.environment.findFirst({
        where: { slug },
        select: { id: true },
      })
    )?.id;
  if (!environmentId) return [];

  const brands = await prisma.brand.findMany({
    where: {
      isActive: true,
      products: {
        some: {
          environmentId,
          status: "ACTIVE",
          deletedAt: null,
        },
      },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, logoUrl: true },
  });

  return brandsForStrip(
    brands.map((brand) => {
      const brandProducts =
        cached?.products.filter((product) => product.brand?.slug === brand.slug) ??
        [];
      const categoryCount = new Set(
        brandProducts
          .map((product) => product.shopCategorySlug)
          .filter((value): value is string => Boolean(value))
      ).size;

      return {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        imageUrl: brand.logoUrl?.trim() || null,
        productCount: brandProducts.length || undefined,
        categoryCount: categoryCount || (brandProducts.length > 0 ? 1 : 0),
      };
    })
  );
}

function getActiveProductCountFromCache(slug: string) {
  return getCachedEnvironment(slug)?.products.length ?? 0;
}

export default async function EnvironmentHomePage({ params }: PageProps) {
  const { environment: slug } = await params;
  const environment = await resolveEnvironment(slug);
  if (!environment) notFound();

  const [shopCategories, waSettings] = await Promise.all([
    getShopCategories(slug),
    getWhatsAppSettings(),
  ]);

  const brands = await getBrandsForStoreStrip(slug);
  const totalProducts =
    getActiveProductCountFromCache(slug) ||
    shopCategories.reduce((sum, category) => sum + category.productCount, 0);

  const firstCategory = shopCategories[0];
  let initialFeed: InitialStoreFeed | null = null;
  if (firstCategory) {
    try {
      const result = await getProducts({
        environmentSlug: slug,
        shopCategorySlug: firstCategory.slug,
        page: 1,
        limit: STORE_PAGE_SIZE,
        listMode: true,
        sort: "serial_no_asc",
      });
      initialFeed = {
        shopSlug: firstCategory.slug,
        items: result.items,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      };
    } catch (error) {
      console.error("[store] initial feed failed:", error);
    }
  }

  const waHref = `https://wa.me/${waSettings.phoneNumber}?text=${encodeURIComponent(waSettings.defaultGreeting)}`;

  return (
    <EnvironmentHome
      environment={environment}
      shopCategories={shopCategories}
      brands={brands}
      waHref={waHref}
      whatsappSettings={waSettings}
      siteUrl={getSiteUrl()}
      totalProducts={totalProducts}
      initialFeed={initialFeed}
    />
  );
}
