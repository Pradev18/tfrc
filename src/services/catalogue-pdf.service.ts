import prisma from "@/lib/db";
import { ProductStatus } from "@prisma/client";
import { mapProductPrices } from "@/lib/pricing";
import { getCatalogueById } from "@/services/catalogue-admin.service";
import { getShopCategories } from "@/services/shop-category.service";
import { OTHER_SHOP_CATEGORY } from "@/lib/shop-categories";
import { getEnvVisual } from "@/lib/env-visuals";
import { getEnvironmentConfig } from "@/lib/environments";
import { getWhatsAppSettings } from "@/lib/whatsapp.server";
import { buildWhatsAppOfficialChatUrl, generateWhatsAppLinkSync } from "@/lib/whatsapp";
import { getPublicCatalogueSiteUrl } from "@/lib/site-config";
import { normalizeCatalogueImageSrc } from "@/lib/media-url";
import { generateQrDataUrl } from "@/lib/catalogue-pdf-qr";
import {
  compareVariantLabels,
  deriveProductVariantIdentity,
  isHumanReadableSizeLabel,
  productDisplayTitle,
} from "@/lib/product-variants";

export type CataloguePdfSort =
  | "item_no_asc"
  | "item_no_desc"
  | "item_code_asc"
  | "item_code_desc"
  | "name"
  | "updated";

export interface CataloguePdfFilters {
  q?: string;
  shop?: string;
  sort?: CataloguePdfSort;
}

export interface CataloguePdfProduct {
  id: string;
  name: string;
  /** Base display title without size token */
  displayName: string;
  productId: string;
  /** Catalogue sequence number from Excel "No" column (when present). */
  itemNo: number | null;
  size: string | null;
  /** All available size / measurement labels for this card */
  availableSizes: string[];
  price: number;
  priceFrom: boolean;
  currency: string;
  inStock: boolean;
  imageUrl: string | null;
  /** Ordered candidates; PDF generation uses the first image it can fully validate. */
  imageUrls?: string[];
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
    description: string | null;
  };
  /** Absolute store URL for this catalogue (QR + cover). */
  websiteUrl: string;
  whatsappUrl: string;
  /** Digits-only WhatsApp number for display. */
  whatsappPhone: string;
  /** Scannable QR data URIs generated for this catalogue. */
  websiteQrDataUrl: string;
  whatsappQrDataUrl: string;
  /** Active product rows (matches Excel / DB import count). */
  totalProducts: number;
  /** Brochure cards after same-product size variants are grouped. */
  listedCards: number;
  accent: string;
  heading: string;
  muted: string;
  surface: string;
  cta: string;
  categories: CataloguePdfCategory[];
}

const PDF_SORTS = new Set<CataloguePdfSort>([
  "item_no_asc",
  "item_no_desc",
  "item_code_asc",
  "item_code_desc",
  "name",
  "updated",
]);

export function normalizeCataloguePdfFilters(
  input?: CataloguePdfFilters | null
): Required<CataloguePdfFilters> {
  const sort = input?.sort && PDF_SORTS.has(input.sort) ? input.sort : "item_no_asc";
  return {
    q: input?.q?.trim() ?? "",
    shop: input?.shop?.trim() ?? "",
    sort,
  };
}

export function cataloguePdfJobKey(
  catalogueId: string,
  filters?: CataloguePdfFilters | null
): string {
  const normalized = normalizeCataloguePdfFilters(filters);
  return [
    catalogueId,
    normalized.sort,
    normalized.q.toLowerCase(),
    normalized.shop,
  ].join("|");
}

type ProductRow = {
  id: string;
  name: string;
  productId: string;
  itemNo: number | null;
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

function compareItemNo(
  a: { itemNo?: number | null; productId?: string },
  b: { itemNo?: number | null; productId?: string },
  direction: "asc" | "desc"
): number {
  const an = a.itemNo;
  const bn = b.itemNo;
  if (an == null && bn == null) {
    return String(a.productId ?? "").localeCompare(String(b.productId ?? ""), undefined, {
      numeric: true,
    });
  }
  if (an == null) return 1;
  if (bn == null) return -1;
  const diff = an - bn;
  if (diff !== 0) return direction === "asc" ? diff : -diff;
  return String(a.productId ?? "").localeCompare(String(b.productId ?? ""), undefined, {
    numeric: true,
  });
}

function sortPdfCards(
  cards: CataloguePdfProduct[],
  sort: CataloguePdfSort
): CataloguePdfProduct[] {
  const list = [...cards];
  switch (sort) {
    case "item_no_desc":
      return list.sort((a, b) => compareItemNo(a, b, "desc"));
    case "item_code_asc":
      return list.sort((a, b) =>
        String(a.productId).localeCompare(String(b.productId), undefined, { numeric: true })
      );
    case "item_code_desc":
      return list.sort((a, b) =>
        String(b.productId).localeCompare(String(a.productId), undefined, { numeric: true })
      );
    case "name":
      return list.sort((a, b) =>
        a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" })
      );
    case "updated":
      // DB already ordered by updatedAt; keep relative order within the group.
      return list;
    case "item_no_asc":
    default:
      return list.sort((a, b) => compareItemNo(a, b, "asc"));
  }
}

function isItemFilterSort(sort: CataloguePdfSort): boolean {
  return (
    sort === "item_no_asc" ||
    sort === "item_no_desc" ||
    sort === "item_code_asc" ||
    sort === "item_code_desc"
  );
}

/** Prefer the sibling whose item no / code matches the active sort direction. */
function pickSortPrimary(
  siblings: ProductRow[],
  sort: CataloguePdfSort
): ProductRow {
  const ranked = [...siblings];
  switch (sort) {
    case "item_no_desc":
      ranked.sort((a, b) => compareItemNo(a, b, "desc"));
      return ranked[0]!;
    case "item_code_asc":
      ranked.sort((a, b) =>
        String(a.productId).localeCompare(String(b.productId), undefined, { numeric: true })
      );
      return ranked[0]!;
    case "item_code_desc":
      ranked.sort((a, b) =>
        String(b.productId).localeCompare(String(a.productId), undefined, { numeric: true })
      );
      return ranked[0]!;
    case "item_no_asc":
      ranked.sort((a, b) => compareItemNo(a, b, "asc"));
      return ranked[0]!;
    default:
      return siblings.find((item) => item.isVariantPrimary) ?? siblings[0]!;
  }
}

function prismaOrderBy(sort: CataloguePdfSort) {
  switch (sort) {
    case "item_no_desc":
      return [{ itemNo: "desc" as const }, { productId: "desc" as const }];
    case "item_code_asc":
      return [{ productId: "asc" as const }];
    case "item_code_desc":
      return [{ productId: "desc" as const }];
    case "name":
      return [{ name: "asc" as const }];
    case "updated":
      return [{ updatedAt: "desc" as const }];
    case "item_no_asc":
    default:
      return [{ itemNo: "asc" as const }, { productId: "asc" as const }];
  }
}

function toPdfProduct(
  product: ProductRow,
  catalogue: { slug: string; name: string },
  whatsappSettings: Awaited<ReturnType<typeof getWhatsAppSettings>>,
  siteUrl: string,
  availableSizes: string[],
  displayName: string,
  price: number,
  priceFrom: boolean,
  imageCandidates?: string[]
): CataloguePdfProduct {
  const { pricing } = mapProductPrices(product);
  const name = productDisplayTitle(product.name, product.productId);

  const imageUrls = [
    ...new Set((imageCandidates ?? product.images.map((image) => image.url)).filter(Boolean)),
  ];

  return {
    id: product.id,
    name,
    displayName,
    productId: product.productId,
    itemNo: product.itemNo ?? null,
    size: product.variantLabel,
    availableSizes,
    price,
    priceFrom,
    currency: pricing.currency,
    inStock: product.inventory?.isInStock !== false,
    imageUrl: imageUrls[0] ?? null,
    imageUrls,
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
  siteUrl: string,
  sort: CataloguePdfSort
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

    const primary = isItemFilterSort(sort)
      ? pickSortPrimary(siblings, sort)
      : siblings.find((item) => item.isVariantPrimary) ?? siblings[0]!;
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

    const card = toPdfProduct(
      primary,
      catalogue,
      whatsappSettings,
      siteUrl,
      readableSizes,
      displayName,
      minPrice,
      priceFrom,
      [
        ...primary.images.map((image) => image.url),
        ...siblings
          .filter((item) => item.id !== primary.id)
          .flatMap((item) => item.images.map((image) => image.url)),
      ]
    );
    // Keep the sort key honest across the whole size group.
    if (sort === "item_no_asc" || sort === "item_no_desc") {
      const nos = siblings.map((s) => s.itemNo).filter((n): n is number => n != null);
      if (nos.length) {
        card.itemNo = sort === "item_no_desc" ? Math.max(...nos) : Math.min(...nos);
      }
    }
    cards.push(card);
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

  return sortPdfCards(cards, sort);
}

export async function getCataloguePdfPayload(
  catalogueId: string,
  filtersInput?: CataloguePdfFilters | null
): Promise<CataloguePdfPayload | null> {
  /**
   * Builds a PDF payload for whichever catalogueId is requested.
   * Visual tokens come from getEnvVisual(slug) with DEFAULT_ENV_VISUAL fallback
   * for unknown/future catalogues — never a PawMart-only code path.
   */
  const filters = normalizeCataloguePdfFilters(filtersInput);
  const catalogue = await getCatalogueById(catalogueId);
  if (!catalogue) return null;

  const siteUrl = getPublicCatalogueSiteUrl();
  const productWhere = {
    environmentId: catalogueId,
    deletedAt: null,
    status: ProductStatus.ACTIVE,
    ...(filters.shop === OTHER_SHOP_CATEGORY.slug
      ? {
          OR: [
            { shopCategorySlug: OTHER_SHOP_CATEGORY.slug },
            { shopCategorySlug: null },
          ],
        }
      : filters.shop
        ? { shopCategorySlug: filters.shop }
        : {}),
    ...(filters.q
      ? {
          AND: [
            {
              OR: [
                { name: { contains: filters.q } },
                { productId: { contains: filters.q } },
                { sku: { contains: filters.q } },
              ],
            },
          ],
        }
      : {}),
  };

  const [shopCategories, products, whatsappSettings] = await Promise.all([
    getShopCategories(catalogue.slug),
    prisma.product.findMany({
      where: productWhere,
      orderBy: prismaOrderBy(filters.sort),
      include: {
        prices: true,
        inventory: { select: { isInStock: true } },
        images: { orderBy: { sortOrder: "asc" } },
      },
    }),
    getWhatsAppSettings(),
  ]);
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
  const categoryNameBySlug = new Map<string, string>();
  for (const cat of shopCategories) categoryNameBySlug.set(cat.slug, cat.name);
  categoryNameBySlug.set(OTHER_SHOP_CATEGORY.slug, OTHER_SHOP_CATEGORY.name);

  // Attach each DB row to its shop-category slug before collapsing.
  const productsWithCat = products.map((product) => {
    const slug =
      product.shopCategorySlug &&
      (categoryNameBySlug.has(product.shopCategorySlug) ||
        buckets.has(product.shopCategorySlug))
        ? product.shopCategorySlug
        : product.shopCategorySlug === OTHER_SHOP_CATEGORY.slug || !product.shopCategorySlug
          ? OTHER_SHOP_CATEGORY.slug
          : product.shopCategorySlug || OTHER_SHOP_CATEGORY.slug;
    return { product, categorySlug: slug };
  });

  let categories: CataloguePdfCategory[] = [];

  if (isItemFilterSort(filters.sort)) {
    // Match the admin list: global item-no / item-code order first, then keep
    // category headers by grouping contiguous same-category cards so the PDF
    // sequence stays 1,2,3… (not reshuffled by category).
    const sortedRows = [...productsWithCat].sort((a, b) => {
      if (filters.sort === "item_code_asc") {
        return String(a.product.productId).localeCompare(String(b.product.productId), undefined, {
          numeric: true,
        });
      }
      if (filters.sort === "item_code_desc") {
        return String(b.product.productId).localeCompare(String(a.product.productId), undefined, {
          numeric: true,
        });
      }
      return compareItemNo(
        a.product,
        b.product,
        filters.sort === "item_no_desc" ? "desc" : "asc"
      );
    });

    const collapsed = collapseVariantGroups(
      sortedRows.map((row) => row.product),
      catalogueMeta,
      whatsappSettings,
      siteUrl,
      filters.sort
    );

    // Map collapsed cards back to category via product id / productId.
    const catByProductKey = new Map<string, string>();
    for (const row of sortedRows) {
      catByProductKey.set(row.product.id, row.categorySlug);
      catByProductKey.set(row.product.productId, row.categorySlug);
    }

    type Section = CataloguePdfCategory;
    const sections: Section[] = [];
    let current: Section | null = null;

    for (const card of collapsed) {
      const slug =
        catByProductKey.get(card.id) ||
        catByProductKey.get(card.productId) ||
        OTHER_SHOP_CATEGORY.slug;
      const name =
        categoryNameBySlug.get(slug) ||
        slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      if (!current || current.slug !== slug) {
        current = {
          slug,
          name,
          productCount: 0,
          products: [],
        };
        sections.push(current);
      }
      current.products.push(card);
      current.productCount += 1;
    }

    // Collapse identical adjacent headers that share the same slug after
    // variant collapse (already contiguous). Keep as-is for true sequence.
    categories = sections;
  } else {
    for (const cat of shopCategories) {
      const list = buckets.get(cat.slug) ?? [];
      if (list.length === 0) continue;
      const collapsed = collapseVariantGroups(
        list,
        catalogueMeta,
        whatsappSettings,
        siteUrl,
        filters.sort
      );
      categories.push({
        slug: cat.slug,
        name: cat.name,
        productCount: list.length,
        products: collapsed,
      });
    }

    const other = buckets.get(OTHER_SHOP_CATEGORY.slug) ?? [];
    if (other.length > 0 && !categories.some((c) => c.slug === OTHER_SHOP_CATEGORY.slug)) {
      const collapsed = collapseVariantGroups(
        other,
        catalogueMeta,
        whatsappSettings,
        siteUrl,
        filters.sort
      );
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
      const collapsed = collapseVariantGroups(
        list,
        catalogueMeta,
        whatsappSettings,
        siteUrl,
        filters.sort
      );
      categories.push({
        slug,
        name:
          categoryNameBySlug.get(slug) ||
          slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        productCount: list.length,
        products: collapsed,
      });
    }
  }

  const visual = getEnvVisual(catalogue.slug);
  const envConfig = getEnvironmentConfig(catalogue.slug);
  // Cover "Products" matches the Excel / DB active row count (before size-variant collapse).
  const totalProducts = products.length;
  const listedCards = categories.reduce((sum, c) => sum + c.products.length, 0);
  // Prefer the uploaded catalogue logo only (not category hero placeholders).
  const logoUrl = normalizeCatalogueImageSrc(catalogue.logoUrl) || null;
  const websiteUrl = `${siteUrl}/${catalogue.slug}`;
  // Cover WhatsApp QR matches official WA Business QR shape (phone + default greeting from settings).
  const whatsappUrl = buildWhatsAppOfficialChatUrl(
    whatsappSettings.phoneNumber,
    whatsappSettings.defaultGreeting
  );
  const [websiteQrDataUrl, whatsappQrDataUrl] = await Promise.all([
    generateQrDataUrl(websiteUrl),
    generateQrDataUrl(whatsappUrl),
  ]);

  return {
    catalogue: {
      id: catalogue.id,
      name: catalogue.name,
      slug: catalogue.slug,
      logoUrl,
      tagline: catalogue.tagline,
      description:
        catalogue.description?.trim() ||
        envConfig?.description ||
        catalogue.tagline ||
        null,
    },
    websiteUrl,
    whatsappUrl,
    whatsappPhone: whatsappSettings.phoneNumber.replace(/\D/g, ""),
    websiteQrDataUrl,
    whatsappQrDataUrl,
    totalProducts,
    listedCards,
    accent: visual.accent,
    heading: visual.heading,
    muted: visual.muted,
    surface: visual.sectionAlt,
    cta: visual.cta,
    categories,
  };
}
