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

export const revalidate = 60;

interface PageProps {
  params: Promise<{ environment: string }>;
}

function getBrandsFromCache(slug: string) {
  const cached = getCachedEnvironment(slug);
  if (!cached) return [];

  // Enrich for the store brand strip only — does not change import/PDF/admin data.
  // Brand tile image = Brand.logoUrl (Excel brand_image) only. Never use product photos.
  return cached.brands.map((brand) => {
    const brandProducts = cached.products.filter(
      (product) => product.brand?.slug === brand.slug
    );
    const logo = brand.logoUrl?.trim() || null;
    const categoryCount = new Set(
      brandProducts
        .map((product) => product.shopCategorySlug)
        .filter((value): value is string => Boolean(value))
    ).size;

    return {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      imageUrl: logo,
      productCount: brandProducts.length,
      categoryCount: categoryCount || (brandProducts.length > 0 ? 1 : 0),
    };
  });
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

  // Prefer file cache for brands/count — never block first paint on SQLite scans.
  const brands = getBrandsFromCache(slug);
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
