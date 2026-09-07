import prisma from "@/lib/db";
import { ProductStatus } from "@prisma/client";
import { mapProductPrices } from "@/lib/pricing";
import { getCatalogueById } from "@/services/catalogue-admin.service";
import { getShopCategories } from "@/services/shop-category.service";
import { OTHER_SHOP_CATEGORY } from "@/lib/shop-categories";
import { getEnvVisual } from "@/lib/env-visuals";

export interface CataloguePdfProduct {
  id: string;
  name: string;
  productId: string;
  size: string | null;
  price: number;
  currency: string;
  inStock: boolean;
  imageUrl: string | null;
}

export interface CataloguePdfCategory {
  slug: string;
  name: string;
  productCount: number;
  products: CataloguePdfProduct[];
}

export interface CataloguePdfPayload {
  catalogue: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    tagline: string | null;
  };
  generatedAt: string;
  totalProducts: number;
  accent: string;
  heading: string;
  muted: string;
  surface: string;
  categories: CataloguePdfCategory[];
}

function cleanName(name: string, productId: string): string {
  const escaped = productId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return name.replace(new RegExp(`(?:\\s+${escaped})+$`, "i"), "").trim();
}

export async function getCataloguePdfPayload(
  catalogueId: string
): Promise<CataloguePdfPayload | null> {
  const catalogue = await getCatalogueById(catalogueId);
  if (!catalogue) return null;

  const [shopCategories, products] = await Promise.all([
    getShopCategories(catalogue.slug),
    prisma.product.findMany({
      where: {
        environmentId: catalogueId,
        deletedAt: null,
        status: ProductStatus.ACTIVE,
      },
      orderBy: [{ name: "asc" }],
      include: {
        prices: true,
        inventory: { select: { isInStock: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
    }),
  ]);

  const buckets = new Map<string, CataloguePdfProduct[]>();
  for (const cat of shopCategories) buckets.set(cat.slug, []);
  buckets.set(OTHER_SHOP_CATEGORY.slug, []);

  for (const product of products) {
    const slug =
      product.shopCategorySlug && buckets.has(product.shopCategorySlug)
        ? product.shopCategorySlug
        : product.shopCategorySlug === OTHER_SHOP_CATEGORY.slug || !product.shopCategorySlug
          ? OTHER_SHOP_CATEGORY.slug
          : product.shopCategorySlug;

    if (!buckets.has(slug)) buckets.set(slug, []);
    const { pricing } = mapProductPrices(product);
    buckets.get(slug)!.push({
      id: product.id,
      name: cleanName(product.name, product.productId),
      productId: product.productId,
      size: product.variantLabel,
      price: pricing.displayPrice,
      currency: pricing.currency,
      inStock: product.inventory?.isInStock !== false,
      imageUrl: product.images[0]?.url ?? null,
    });
  }

  const categories: CataloguePdfCategory[] = [];
  for (const cat of shopCategories) {
    const list = buckets.get(cat.slug) ?? [];
    if (list.length === 0) continue;
    categories.push({
      slug: cat.slug,
      name: cat.name,
      productCount: list.length,
      products: list,
    });
  }

  const other = buckets.get(OTHER_SHOP_CATEGORY.slug) ?? [];
  if (other.length > 0 && !categories.some((c) => c.slug === OTHER_SHOP_CATEGORY.slug)) {
    categories.push({
      slug: OTHER_SHOP_CATEGORY.slug,
      name: OTHER_SHOP_CATEGORY.name,
      productCount: other.length,
      products: other,
    });
  }

  // Include any unexpected shopCategorySlug buckets
  for (const [slug, list] of buckets) {
    if (list.length === 0) continue;
    if (categories.some((c) => c.slug === slug)) continue;
    categories.push({
      slug,
      name: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      productCount: list.length,
      products: list,
    });
  }

  const visual = getEnvVisual(catalogue.slug);
  const totalProducts = categories.reduce((sum, c) => sum + c.productCount, 0);

  return {
    catalogue: {
      id: catalogue.id,
      name: catalogue.name,
      slug: catalogue.slug,
      logoUrl: catalogue.logoUrl,
      tagline: catalogue.tagline,
    },
    generatedAt: new Date().toISOString(),
    totalProducts,
    accent: visual.accent,
    heading: visual.heading,
    muted: visual.muted,
    surface: visual.sectionAlt,
    categories,
  };
}
