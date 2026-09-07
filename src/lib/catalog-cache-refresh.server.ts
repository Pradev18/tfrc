import prisma from "@/lib/db";
import { saveCatalogCache, type CatalogCache } from "@/lib/catalog-cache";

export async function refreshCatalogCacheFromDatabase(): Promise<void> {
  const environments = await prisma.environment.findMany({
    where: { status: "ACTIVE" },
    orderBy: { sortOrder: "asc" },
  });

  const cache: CatalogCache = {
    generatedAt: new Date().toISOString(),
    environments: {},
  };

  for (const environment of environments) {
    const [products, brands] = await Promise.all([
      prisma.product.findMany({
        where: {
          environmentId: environment.id,
          status: "ACTIVE",
          deletedAt: null,
        },
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          productId: true,
          name: true,
          slug: true,
          sku: true,
          description: true,
          shortDescription: true,
          isFeatured: true,
          variantGroupKey: true,
          variantLabel: true,
          isVariantPrimary: true,
          createdAt: true,
          images: {
            orderBy: { sortOrder: "asc" },
            take: 2,
            select: { url: true, sortOrder: true, isPrimary: true },
          },
          prices: {
            select: {
              type: true,
              amount: true,
              currency: true,
              saleStart: true,
              saleEnd: true,
            },
          },
          brand: { select: { id: true, name: true, slug: true } },
          inventory: { select: { isInStock: true } },
        },
      }),
      prisma.brand.findMany({
        where: {
          isActive: true,
          products: {
            some: {
              environmentId: environment.id,
              status: "ACTIVE",
              deletedAt: null,
            },
          },
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true },
      }),
    ]);

    cache.environments[environment.slug] = {
      id: environment.id,
      name: environment.name,
      slug: environment.slug,
      tagline: environment.tagline,
      description: environment.description,
      logoUrl: environment.logoUrl,
      icon: environment.icon,
      theme: environment.theme,
      seo: environment.seo,
      settings: environment.settings,
      departmentSource: environment.departmentSource,
      brands,
      products: products.map((product) => ({
        ...product,
        createdAt: product.createdAt.toISOString(),
        prices: product.prices.map((price) => ({
          ...price,
          saleStart: price.saleStart?.toISOString() ?? null,
          saleEnd: price.saleEnd?.toISOString() ?? null,
        })),
      })),
    };
  }

  saveCatalogCache(cache);
}

export async function refreshCatalogCacheSafely(): Promise<void> {
  try {
    await refreshCatalogCacheFromDatabase();
  } catch (error) {
    console.error("[catalog-cache] Runtime refresh failed:", error);
  }
}
