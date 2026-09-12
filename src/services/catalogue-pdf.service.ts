import prisma from "@/lib/db";
import { ProductStatus } from "@prisma/client";
import { mapProductPrices } from "@/lib/pricing";
import { getCatalogueById } from "@/services/catalogue-admin.service";
import { getShopCategories } from "@/services/shop-category.service";
import { OTHER_SHOP_CATEGORY } from "@/lib/shop-categories";
import { getEnvVisual } from "@/lib/env-visuals";
import { getWhatsAppSettings } from "@/lib/whatsapp.server";
import { buildWhatsAppUrl, generateWhatsAppLinkSync } from "@/lib/whatsapp";
import { getSiteUrl } from "@/lib/site-config";
import { normalizeCatalogueImageSrc } from "@/lib/media-url";
import {
  compareVariantLabels,
  deriveProductVariantIdentity,
  isHumanReadableSizeLabel,
  productDisplayTitle,
} from "@/lib/product-variants";

export interface CataloguePdfProduct {
  id: string;
  name: string;
  /** Base display title without size token */
  displayName: string;
  productId: string;
  size: string | null;
  /** All available size / measurement labels for this card */
  availableSizes: string[];
  price: number;
  priceFrom: boolean;
  currency: string;
  inStock: boolean;
  imageUrl: string | null;
  whatsappUrl: string;
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
  whatsappUrl: string;
  generatedAt: string;
  /** Active product rows (matches Excel / DB import count). */
  totalProducts: number;
  /** Brochure cards after same-product size variants are grouped. */
  listedCards: number;
  accent: string;
  heading: string;
  muted: string;
  surface: string;
  categories: CataloguePdfCategory[];
}

type ProductRow = {
  id: string;
  name: string;
  productId: string;
  slug: string;
  variantGroupKey: string | null;
  variantLabel: string | null;
  isVariantPrimary: boolean;
  shopCategorySlug: string | null;
  prices: Array<{
    type: string;
    amount: number;
    currency: string;
    saleStart: Date | null;
    saleEnd: Date | null;
  }>;
  inventory: { isInStock: boolean } | null;
  images: Array<{ url: string }>;
};

function toPdfProduct(
  product: ProductRow,
  catalogue: { slug: string; name: string },
  whatsappSettings: Awaited<ReturnType<typeof getWhatsAppSettings>>,
  siteUrl: string,
  availableSizes: string[],
  displayName: string,
  price: number,
  priceFrom: boolean
): CataloguePdfProduct {
  const { pricing } = mapProductPrices(product);
  const name = productDisplayTitle(product.name, product.productId);

  return {
    id: product.id,
    name,
    displayName,
    productId: product.productId,
    size: product.variantLabel,
    availableSizes,
    price,
    priceFrom,
    currency: pricing.currency,
    inStock: product.inventory?.isInStock !== false,
    imageUrl: product.images[0]?.url ?? null,
    whatsappUrl: generateWhatsAppLinkSync(
      whatsappSettings,
      {
        name: displayName,
        productId: product.productId,
        regularPrice: pricing.regular,
        salePrice: pricing.sale,
        currency: pricing.currency,
        slug: product.slug,
        environmentSlug: catalogue.slug,
        environmentName: catalogue.name,
        size:
          availableSizes.length > 1
            ? availableSizes.join(", ")
            : product.variantLabel ?? undefined,
      },
      siteUrl
    ),
  };
}

function collapseVariantGroups(
  products: ProductRow[],
  catalogue: { slug: string; name: string },
  whatsappSettings: Awaited<ReturnType<typeof getWhatsAppSettings>>,
  siteUrl: string
): CataloguePdfProduct[] {
  const groups = new Map<string, ProductRow[]>();
  const ungrouped: ProductRow[] = [];

  for (const product of products) {
    if (product.variantGroupKey) {
      const list = groups.get(product.variantGroupKey) ?? [];
      list.push(product);
      groups.set(product.variantGroupKey, list);
    } else {
      ungrouped.push(product);
    }
  }

  const cards: CataloguePdfProduct[] = [];

  for (const siblings of groups.values()) {
    siblings.sort((a, b) => compareVariantLabels(a.variantLabel, b.variantLabel));
    const readableSizes = [
      ...new Set(
        siblings
          .map((item) => item.variantLabel?.trim())
          .filter((label): label is string => isHumanReadableSizeLabel(label))
      ),
    ];
    readableSizes.sort(compareVariantLabels);

    // Same-name / colour twins with only item-code labels → separate PDF cards
    // so each image stays visible. Real S/M/L or mm sizes collapse to one card.
    if (readableSizes.length === 0) {
      for (const product of siblings) {
        const { pricing } = mapProductPrices(product);
        const name = productDisplayTitle(product.name, product.productId);
        cards.push(
          toPdfProduct(
            product,
            catalogue,
            whatsappSettings,
            siteUrl,
            [],
            name,
            pricing.displayPrice,
            false
          )
        );
      }
      continue;
    }

    const primary =
      siblings.find((item) => item.isVariantPrimary) ?? siblings[0]!;
    const prices = siblings.map((item) => mapProductPrices(item).pricing.displayPrice);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceFrom = maxPrice - minPrice > 0.009;

    const identity = deriveProductVariantIdentity({
      title: primary.name,
      productId: primary.productId,
    });
    const displayName =
      identity.baseName.length >= 3
        ? identity.baseName
        : productDisplayTitle(primary.name, primary.productId);

    cards.push(
      toPdfProduct(
        primary,
        catalogue,
        whatsappSettings,
        siteUrl,
        readableSizes,
        displayName,
        minPrice,
        priceFrom
      )
    );
  }

  for (const product of ungrouped) {
    const { pricing } = mapProductPrices(product);
    const name = productDisplayTitle(product.name, product.productId);
    cards.push(
      toPdfProduct(
        product,
        catalogue,
        whatsappSettings,
        siteUrl,
        isHumanReadableSizeLabel(product.variantLabel)
          ? [product.variantLabel!.trim()]
          : [],
        name,
        pricing.displayPrice,
        false
      )
    );
  }

  cards.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }));
  return cards;
}

export async function getCataloguePdfPayload(
  catalogueId: string
): Promise<CataloguePdfPayload | null> {
  const catalogue = await getCatalogueById(catalogueId);
  if (!catalogue) return null;

  const [shopCategories, products, whatsappSettings] = await Promise.all([
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
    getWhatsAppSettings(),
  ]);
  const siteUrl = getSiteUrl();

  const buckets = new Map<string, ProductRow[]>();
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
    buckets.get(slug)!.push(product);
  }

  const catalogueMeta = { slug: catalogue.slug, name: catalogue.name };
  const categories: CataloguePdfCategory[] = [];

  for (const cat of shopCategories) {
    const list = buckets.get(cat.slug) ?? [];
    if (list.length === 0) continue;
    const collapsed = collapseVariantGroups(list, catalogueMeta, whatsappSettings, siteUrl);
    categories.push({
      slug: cat.slug,
      name: cat.name,
      productCount: list.length,
      products: collapsed,
    });
  }

  const other = buckets.get(OTHER_SHOP_CATEGORY.slug) ?? [];
  if (other.length > 0 && !categories.some((c) => c.slug === OTHER_SHOP_CATEGORY.slug)) {
    const collapsed = collapseVariantGroups(other, catalogueMeta, whatsappSettings, siteUrl);
    categories.push({
      slug: OTHER_SHOP_CATEGORY.slug,
      name: OTHER_SHOP_CATEGORY.name,
      productCount: other.length,
      products: collapsed,
    });
  }

  for (const [slug, list] of buckets) {
    if (list.length === 0) continue;
    if (categories.some((c) => c.slug === slug)) continue;
    const collapsed = collapseVariantGroups(list, catalogueMeta, whatsappSettings, siteUrl);
    categories.push({
      slug,
      name: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      productCount: list.length,
      products: collapsed,
    });
  }

  const visual = getEnvVisual(catalogue.slug);
  // Cover "Products" matches the Excel / DB active row count (before size-variant collapse).
  const totalProducts = products.length;
  const listedCards = categories.reduce((sum, c) => sum + c.products.length, 0);
  // Prefer the uploaded catalogue logo only (not category hero placeholders).
  const logoUrl = normalizeCatalogueImageSrc(catalogue.logoUrl) || null;

  return {
    catalogue: {
      id: catalogue.id,
      name: catalogue.name,
      slug: catalogue.slug,
      logoUrl,
      tagline: catalogue.tagline,
    },
    whatsappUrl: buildWhatsAppUrl(
      whatsappSettings.phoneNumber,
      `${whatsappSettings.defaultGreeting}\n\nI'd like to order from ${catalogue.name}.`
    ),
    generatedAt: new Date().toISOString(),
    totalProducts,
    listedCards,
    accent: visual.accent,
    heading: visual.heading,
    muted: visual.muted,
    surface: visual.sectionAlt,
    categories,
  };
}
