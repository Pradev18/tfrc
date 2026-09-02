import prisma from "@/lib/db";
import { absoluteUrl } from "@/lib/site-config";
import { getEffectivePrice } from "@/lib/pricing";
import { getCachedEnvironment, loadCatalogCache } from "@/lib/catalog-cache";

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatMetaPrice(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

/**
 * Meta/Facebook Product Catalog feed (CSV).
 * @see https://developers.facebook.com/docs/marketing-api/catalog/reference
 */
export async function generateMetaCatalogCsv(environmentSlug?: string): Promise<string> {
  try {
    return await generateMetaCatalogCsvFromPrisma(environmentSlug);
  } catch (error) {
    console.error("[meta-catalog] prisma failed, using cache:", error);
    return generateMetaCatalogCsvFromCache(environmentSlug);
  }
}

function generateMetaCatalogCsvFromCache(environmentSlug?: string): string {
  const headers = [
    "id",
    "title",
    "description",
    "availability",
    "condition",
    "price",
    "link",
    "image_link",
    "brand",
    "google_product_category",
    "fb_product_category",
    "sale_price",
    "item_group_id",
  ];

  const slugs = environmentSlug
    ? [environmentSlug]
    : Object.keys(loadCatalogCache()?.environments ?? {});

  const rows: string[][] = [];
  for (const slug of slugs) {
    const env = getCachedEnvironment(slug);
    if (!env) continue;
    for (const product of env.products) {
      const regular = product.prices.find((p) => p.type === "REGULAR");
      const sale = product.prices.find((p) => p.type === "SALE");
      const pricing = getEffectivePrice({
        regular: regular?.amount ?? 0,
        sale: sale?.amount,
        currency: regular?.currency ?? "QAR",
        saleStart: sale?.saleStart ? new Date(sale.saleStart) : null,
        saleEnd: sale?.saleEnd ? new Date(sale.saleEnd) : null,
      });
      const primaryImage = product.images[0]?.url ?? "";
      const inStock = product.inventory?.isInStock ?? true;
      const description =
        product.shortDescription ??
        product.description?.slice(0, 5000) ??
        product.name;
      const link = absoluteUrl(`/${slug}/product/${product.slug}`);
      rows.push(
        [
          product.productId,
          product.name,
          description.replace(/\s+/g, " ").trim(),
          inStock ? "in stock" : "out of stock",
          "new",
          formatMetaPrice(pricing.regular, pricing.currency),
          link,
          primaryImage,
          product.brand?.name ?? "TFRC Vita Nova",
          "",
          "",
          pricing.isOnSale && pricing.sale
            ? formatMetaPrice(pricing.sale, pricing.currency)
            : "",
          product.sku ?? "",
        ].map((v) => csvEscape(String(v)))
      );
    }
  }

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

async function generateMetaCatalogCsvFromPrisma(environmentSlug?: string): Promise<string> {
  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      ...(environmentSlug
        ? { environment: { slug: environmentSlug } }
        : {}),
    },
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      brand: true,
      inventory: true,
      prices: true,
      environment: { select: { slug: true } },
    },
  });

  const headers = [
    "id",
    "title",
    "description",
    "availability",
    "condition",
    "price",
    "link",
    "image_link",
    "brand",
    "google_product_category",
    "fb_product_category",
    "sale_price",
    "item_group_id",
  ];

  const rows = products
    .map((product) => {
    const regular = product.prices.find((p) => p.type === "REGULAR");
    const sale = product.prices.find((p) => p.type === "SALE");
    const pricing = getEffectivePrice({
      regular: regular?.amount ?? 0,
      sale: sale?.amount,
      currency: regular?.currency ?? "QAR",
      saleStart: sale?.saleStart,
      saleEnd: sale?.saleEnd,
    });
    const envSlug = product.environment?.slug;
    if (!envSlug) return null;
    const primaryImage = product.images[0]?.url ?? "";
    const inStock = product.inventory?.isInStock ?? true;
    const description =
      product.shortDescription ??
      product.description?.slice(0, 5000) ??
      product.name;

    const link = absoluteUrl(`/${envSlug}/product/${product.slug}`);

    return [
      product.productId,
      product.name,
      description.replace(/\s+/g, " ").trim(),
      inStock ? "in stock" : "out of stock",
      product.condition || "new",
      formatMetaPrice(pricing.regular, pricing.currency),
      link,
      primaryImage,
      product.brand?.name ?? "TFRC Vita Nova",
      product.googleCategory ?? "",
      product.fbCategory ?? "",
      pricing.isOnSale && pricing.sale
        ? formatMetaPrice(pricing.sale, pricing.currency)
        : "",
      product.sku,
    ].map((v) => csvEscape(String(v)));
  })
    .filter((row): row is string[] => row !== null);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export async function getMetaCatalogStats(environmentSlug?: string) {
  const count = await prisma.product.count({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      ...(environmentSlug ? { environment: { slug: environmentSlug } } : {}),
    },
  });
  return { count };
}
