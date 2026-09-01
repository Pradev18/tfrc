import prisma from "@/lib/db";
import { absoluteUrl } from "@/lib/site-config";
import { getEffectivePrice } from "@/lib/pricing";

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

  const rows = products.map((product) => {
    const regular = product.prices.find((p) => p.type === "REGULAR");
    const sale = product.prices.find((p) => p.type === "SALE");
    const pricing = getEffectivePrice({
      regular: regular?.amount ?? 0,
      sale: sale?.amount,
      currency: regular?.currency ?? "QAR",
      saleStart: sale?.saleStart,
      saleEnd: sale?.saleEnd,
    });
    const envSlug = product.environment?.slug ?? "pawmart";
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
  });

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
